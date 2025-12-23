import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

// TESTING_MODE: Controls whether subscription checks are bypassed
// Automatically disabled in production, enabled in development
const TESTING_MODE = process.env.NODE_ENV !== 'production';
import {
  getUserById,
  updateUserSubscription,
  getUserByStripeCustomerId,
  checkUserUsageLimit,
  incrementUserUsage,
  checkAnonymousUsageLimit,
  incrementAnonymousUsage,
  createConversion,
  updateConversion,
  getConversionById,
  getUserConversions,
  getConversionsByBatchId,
  getAllTemplates,
  getTemplateBySlug,
  seedTemplates,
} from "./db";
import { extractTablesFromPDF, extractTablesFromMultiplePages, analyzeDocument, extractWithGuidance, type UserGuidance } from "./lib/ai-extractor";
import { getTemplate, getAllTemplates as getServerTemplates, EXTRACTION_TEMPLATES } from "./lib/templates";
import { validateImageBase64, convertPdfToImages } from "./lib/pdfToImage";
import { tablesToExcel, spreadsheetDataToExcel } from "./lib/excel";
import { createCheckoutSession, createPortalSession, getStripeConfig } from "./lib/stripe";
import { storagePut } from "./storage";
import { v4 as uuidv4 } from "uuid";

/**
 * Smart sheet name truncation that preserves meaningful content
 * Excel sheet names are limited to 31 characters
 */
function smartTruncateSheetName(name: string, suffix: string = ''): string {
  const maxLength = 31;
  const availableLength = maxLength - suffix.length;

  if (name.length <= availableLength) {
    return name + suffix;
  }

  // Try to truncate at word boundary
  let truncated = name.substring(0, availableLength);

  // Find the last space to avoid cutting mid-word
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > availableLength * 0.6) {
    // Only use word boundary if we keep at least 60% of the length
    truncated = truncated.substring(0, lastSpace);
  }

  // Remove trailing special characters
  truncated = truncated.replace(/[\s\-_.,]+$/, '');

  return truncated + suffix;
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // User profile and subscription
  user: router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) return null;

      // In testing mode, override subscription status to 'pro'
      if (TESTING_MODE) {
        return { ...user, subscriptionStatus: 'pro' as const };
      }
      return user;
    }),

    getUsage: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) return null;

      const usageCheck = await checkUserUsageLimit(ctx.user.id);

      // In testing mode, show as Pro user with unlimited conversions
      const isPro = TESTING_MODE || user.subscriptionStatus === 'pro';

      return {
        conversionsToday: user.conversionsToday,
        conversionsThisMonth: user.conversionsThisMonth,
        totalConversions: user.totalConversions,
        subscriptionStatus: isPro ? 'pro' : user.subscriptionStatus,
        remaining: isPro ? -1 : usageCheck.remaining,
        dailyLimit: isPro ? -1 : 3,
      };
    }),
  }),

  // Stripe payments
  stripe: router({
    getConfig: publicProcedure.query(() => {
      return getStripeConfig();
    }),

    createCheckout: protectedProcedure
      .input(z.object({
        successUrl: z.string(),
        cancelUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (!user || !user.email) {
          return { success: false, error: 'User email required' };
        }

        return await createCheckoutSession(
          ctx.user.id,
          user.email,
          input.successUrl,
          input.cancelUrl
        );
      }),

    createPortal: protectedProcedure
      .input(z.object({ returnUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (!user?.stripeCustomerId) {
          return { success: false, error: 'No subscription found' };
        }

        return await createPortalSession(user.stripeCustomerId, input.returnUrl);
      }),
  }),

  // PDF Conversion
  conversion: router({
    // Check usage before upload
    checkUsage: publicProcedure
      .input(z.object({ anonymousId: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (TESTING_MODE) {
          return { allowed: true, remaining: -1 }; // -1 means unlimited
        }

        if (ctx.user) {
          return await checkUserUsageLimit(ctx.user.id);
        }

        // For anonymous users, use IP address
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket?.remoteAddress || '127.0.0.1';
        return await checkAnonymousUsageLimit(ip);
      }),

    // Get available templates
    getTemplates: publicProcedure.query(async ({ ctx }) => {
      // In testing mode, everyone is Pro
      const isPro = TESTING_MODE || (ctx.user ? (await getUserById(ctx.user.id))?.subscriptionStatus === 'pro' : false);
      return {
        templates: EXTRACTION_TEMPLATES.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          isPro: t.isPro,
        })),
        userIsPro: isPro,
      };
    }),

    // Analyze document and generate questions (NEW - Intelligent Flow)
    analyze: publicProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        mimeType: z.string().default('image/png'),
      }))
      .mutation(async ({ input }) => {
        try {
          // For PDFs, convert SAMPLE pages for comprehensive analysis
          let imageBase64: string | string[] = input.fileBase64;
          let imageMimeType = input.mimeType;
          let pageNumbers: number[] = [1];
          let documentTotalPages = 1; // Track total pages for the document

          if (input.mimeType === 'application/pdf') {
            // First, get total page count
            const pdfConversion = await convertPdfToImages(input.fileBase64, 1);
            if (!pdfConversion.success || pdfConversion.pages.length === 0) {
              return {
                success: false,
                error: 'Failed to analyze PDF. Please try uploading an image instead.',
              };
            }

            const totalPages = pdfConversion.totalPages;
            documentTotalPages = totalPages;

            // Calculate sample pages to analyze
            // For 2-page document: pages 1, 2 (ALL pages)
            // For 3-5 page document: pages 1, middle, last
            // For 11-page document: pages 1, 3, 6, 9, 11
            const samplePageNumbers: number[] = [1]; // Always include page 1

            if (totalPages === 2) {
              // For 2-page documents, ALWAYS analyze both pages
              samplePageNumbers.push(2);
            } else if (totalPages >= 3) {
              // Add middle page
              const middlePage = Math.ceil(totalPages / 2);
              if (!samplePageNumbers.includes(middlePage)) {
                samplePageNumbers.push(middlePage);
              }
              // Always add last page for 3+ page documents
              if (!samplePageNumbers.includes(totalPages)) {
                samplePageNumbers.push(totalPages);
              }
            }

            if (totalPages >= 10) {
              // For 10+ pages, also add 25% and 75% positions
              const quarterPage = Math.ceil(totalPages * 0.25);
              const threeQuarterPage = Math.ceil(totalPages * 0.75);
              if (!samplePageNumbers.includes(quarterPage)) {
                samplePageNumbers.push(quarterPage);
              }
              if (!samplePageNumbers.includes(threeQuarterPage)) {
                samplePageNumbers.push(threeQuarterPage);
              }
            }

            // Sort page numbers
            samplePageNumbers.sort((a, b) => a - b);

            // Limit to max 5 sample pages
            const pagesToAnalyze = samplePageNumbers.slice(0, 5);

            console.log(`PDF has ${totalPages} pages, sampling pages: ${pagesToAnalyze.join(', ')}`);

            // Convert the sample pages
            const maxPageToConvert = Math.max(...pagesToAnalyze);
            const fullConversion = await convertPdfToImages(input.fileBase64, maxPageToConvert);

            if (!fullConversion.success) {
              return {
                success: false,
                error: 'Failed to convert PDF pages for analysis.',
              };
            }

            // Extract the sample pages we need
            const sampleImages: string[] = [];
            for (const pageNum of pagesToAnalyze) {
              const page = fullConversion.pages.find(p => p.pageNumber === pageNum);
              if (page) {
                sampleImages.push(page.base64);
              }
            }

            if (sampleImages.length === 0) {
              return {
                success: false,
                error: 'Failed to extract sample pages for analysis.',
              };
            }

            imageBase64 = sampleImages.length === 1 ? sampleImages[0] : sampleImages;
            imageMimeType = 'image/png';
            pageNumbers = pagesToAnalyze;
          }

          console.log('Calling analyzeDocument for:', input.fileName, 'totalPages:', documentTotalPages);
          const analysis = await analyzeDocument(imageBase64, input.fileName, imageMimeType, pageNumbers, documentTotalPages);
          console.log('Analysis result:', JSON.stringify(analysis, null, 2).substring(0, 500));
          return {
            success: true,
            analysis,
          };
        } catch (error: any) {
          console.error('Analysis error:', error);
          return {
            success: false,
            error: error.message || 'Failed to analyze document',
          };
        }
      }),

    // Extract with user guidance (NEW - Intelligent Flow)
    extractWithGuidance: publicProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string().default('image/png'),
        anonymousId: z.string().optional(),
        guidance: z.object({
          answers: z.record(z.string(), z.unknown()),
          acceptedSuggestions: z.array(z.string()),
          freeformInstructions: z.string().optional(),
          extractionMode: z.enum([
            'invoice_extract',
            'bank_extract',
            'expense_extract',
            'inventory_extract',
            'sales_extract',
            'table_extract',
            'clean_summarize',
          ]).optional(),
          outputPreferences: z.object({
            combineRelatedTables: z.boolean(),
            outputLanguage: z.enum(['auto', 'english', 'swedish', 'german', 'spanish', 'french']),
            skipDiagrams: z.boolean(),
            skipImages: z.boolean(),
            symbolMapping: z.record(z.string(), z.string()).optional(),
          }).optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket?.remoteAddress || '127.0.0.1';

        // Check usage limits (skip in testing mode)
        if (!TESTING_MODE) {
          let usageCheck;
          if (ctx.user) {
            usageCheck = await checkUserUsageLimit(ctx.user.id);
          } else {
            usageCheck = await checkAnonymousUsageLimit(ip);
          }

          if (!usageCheck.allowed) {
            return {
              success: false,
              error: usageCheck.message,
              errorCode: 'USAGE_LIMIT_EXCEEDED',
            };
          }
        }

        // Create conversion record
        const conversion = await createConversion({
          userId: ctx.user?.id ?? null,
          anonymousId: input.anonymousId ?? null,
          ipAddress: ip ?? null,
          originalFilename: input.fileName,
          fileSizeBytes: input.fileSize,
          status: 'processing',
        });

        if (!conversion) {
          return {
            success: false,
            error: 'Failed to create conversion record',
            errorCode: 'DB_ERROR',
          };
        }

        try {
          // Handle PDF files by converting to images first
          if (input.mimeType === 'application/pdf') {
            const pdfConversion = await convertPdfToImages(input.fileBase64, 10);

            if (!pdfConversion.success || pdfConversion.pages.length === 0) {
              await updateConversion(conversion.id, {
                status: 'failed',
                errorCode: 'PDF_CONVERSION_FAILED',
                errorMessage: pdfConversion.error || 'Failed to convert PDF',
              });
              return {
                success: false,
                conversionId: conversion.id,
                error: pdfConversion.error || 'Failed to convert PDF',
                errorCode: 'PDF_CONVERSION_FAILED',
              };
            }

            // For multi-page PDFs, extract each page with guidance
            const allTables: any[] = [];
            const allWarnings: any[] = [];
            let totalConfidence = 0;

            for (let i = 0; i < pdfConversion.pages.length; i++) {
              const page = pdfConversion.pages[i];
              const result = await extractWithGuidance(
                page.base64,
                `${input.fileName} (Page ${page.pageNumber})`,
                'image/png',
                input.guidance as UserGuidance
              );

              if (result.success) {
                const tablesWithPageNum = result.tables.map(table => ({
                  ...table,
                  pageNumber: page.pageNumber,
                  sheetName: pdfConversion.pages.length > 1
                    ? smartTruncateSheetName(table.sheetName, ` (P${page.pageNumber})`)
                    : smartTruncateSheetName(table.sheetName),
                }));
                allTables.push(...tablesWithPageNum);
                allWarnings.push(...result.warnings);
                totalConfidence += result.confidence;
              }
            }

            const avgConfidence = pdfConversion.pages.length > 0 ? totalConfidence / pdfConversion.pages.length : 0;

            await updateConversion(conversion.id, {
              status: 'review',
              extractedTables: allTables,
              tableCount: allTables.length,
              rowCount: allTables.reduce((sum, t) => sum + t.rows.length, 0),
              aiConfidenceScore: String(avgConfidence),
              aiWarnings: allWarnings,
              pageCount: pdfConversion.totalPages,
            });

            if (ctx.user) {
              await incrementUserUsage(ctx.user.id);
            } else {
              await incrementAnonymousUsage(ip);
            }

            return {
              success: true,
              conversionId: conversion.id,
              tables: allTables,
              warnings: allWarnings,
              confidence: avgConfidence,
              pageCount: pdfConversion.totalPages,
            };
          }

          // For non-PDF files (images)
          const result = await extractWithGuidance(
            input.fileBase64,
            input.fileName,
            input.mimeType,
            input.guidance as UserGuidance
          );

          if (!result.success) {
            await updateConversion(conversion.id, {
              status: 'failed',
              errorCode: result.errorCode,
              errorMessage: result.error,
            });

            return {
              success: false,
              conversionId: conversion.id,
              error: result.error,
              errorCode: result.errorCode,
            };
          }

          await updateConversion(conversion.id, {
            status: 'review',
            extractedTables: result.tables,
            tableCount: result.tables.length,
            rowCount: result.tables.reduce((sum, t) => sum + t.rows.length, 0),
            aiConfidenceScore: String(result.confidence),
            aiWarnings: result.warnings,
          });

          if (ctx.user) {
            await incrementUserUsage(ctx.user.id);
          } else {
            await incrementAnonymousUsage(ip);
          }

          return {
            success: true,
            conversionId: conversion.id,
            tables: result.tables,
            warnings: result.warnings,
            confidence: result.confidence,
            appliedGuidance: result.appliedGuidance,
          };
        } catch (error) {
          console.error('Guided extraction error:', error);
          await updateConversion(conversion.id, {
            status: 'failed',
            errorCode: 'INTERNAL_ERROR',
            errorMessage: 'An unexpected error occurred',
          });

          return {
            success: false,
            conversionId: conversion.id,
            error: 'An unexpected error occurred. Please try again.',
            errorCode: 'INTERNAL_ERROR',
          };
        }
      }),

    // Process PDF and extract tables
    process: publicProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string().default('image/png'),
        anonymousId: z.string().optional(),
        templateId: z.string().default('generic'),
        isSampleDemo: z.boolean().default(false),
        batchId: z.string().optional(), // For grouping batch uploads
      }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket?.remoteAddress || '127.0.0.1';

        // Check usage limits (skip in testing mode)
        if (!TESTING_MODE) {
          let usageCheck;
          if (ctx.user) {
            usageCheck = await checkUserUsageLimit(ctx.user.id);
          } else {
            usageCheck = await checkAnonymousUsageLimit(ip);
          }

          if (!usageCheck.allowed) {
            return {
              success: false,
              error: usageCheck.message,
              errorCode: 'USAGE_LIMIT_EXCEEDED',
            };
          }
        }

        // Validate file size (20MB limit)
        if (input.fileSize > 20 * 1024 * 1024) {
          return {
            success: false,
            error: 'File too large. Maximum size is 20MB.',
            errorCode: 'FILE_TOO_LARGE',
          };
        }

        // Get template and validate Pro access
        const template = getTemplate(input.templateId);
        if (!template) {
          return {
            success: false,
            error: 'Invalid template selected',
            errorCode: 'INVALID_TEMPLATE',
          };
        }

        // Check if user has Pro access for Pro templates (allow sample demos)
        if (template.isPro && !input.isSampleDemo && !TESTING_MODE) {
          if (!ctx.user) {
            return {
              success: false,
              error: 'Pro templates require a Pro subscription. Please sign in and upgrade.',
              errorCode: 'PRO_REQUIRED',
            };
          }
          const user = await getUserById(ctx.user.id);
          if (user?.subscriptionStatus !== 'pro') {
            return {
              success: false,
              error: 'Pro templates require a Pro subscription. Upgrade to unlock specialized extraction.',
              errorCode: 'PRO_REQUIRED',
            };
          }
        }

        // Create conversion record
        const conversion = await createConversion({
          userId: ctx.user?.id ?? null,
          anonymousId: input.anonymousId ?? null,
          ipAddress: ip ?? null,
          originalFilename: input.fileName,
          fileSizeBytes: input.fileSize,
          status: 'processing',
          batchId: input.batchId ?? null,
        });

        if (!conversion) {
          return {
            success: false,
            error: 'Failed to create conversion record',
            errorCode: 'DB_ERROR',
          };
        }

        try {
          // Validate and detect file type
          const validation = await validateImageBase64(input.fileBase64);
          console.log('File validation:', validation);
          
          // Use detected mime type or fall back to provided
          const actualMimeType = validation.mimeType || input.mimeType;
          
          // Handle PDF files by converting to images first
          let imageBase64 = input.fileBase64;
          let imageMimeType = actualMimeType;
          
          // Handle PDF files - convert all pages and extract from each
          if (actualMimeType === 'application/pdf') {
            console.log('Converting PDF to images...');
            const pdfConversion = await convertPdfToImages(input.fileBase64, 10); // Max 10 pages
            
            if (!pdfConversion.success || pdfConversion.pages.length === 0) {
              await updateConversion(conversion.id, {
                status: 'failed',
                errorCode: 'PDF_CONVERSION_FAILED',
                errorMessage: pdfConversion.error || 'Failed to convert PDF to images',
              });

              return {
                success: false,
                conversionId: conversion.id,
                error: pdfConversion.error || 'Failed to convert PDF. Please try uploading a screenshot of the PDF instead.',
                errorCode: 'PDF_CONVERSION_FAILED',
              };
            }
            
            console.log(`PDF converted successfully, processing ${pdfConversion.totalPages} page(s)...`);
            
            // Extract tables from all pages
            const pages = pdfConversion.pages.map(p => ({
              pageNumber: p.pageNumber,
              base64: p.base64,
              mimeType: 'image/png',
            }));
            
            const result = await extractTablesFromMultiplePages(pages, input.fileName, undefined, template.systemPrompt);
            
            if (!result.success) {
              await updateConversion(conversion.id, {
                status: 'failed',
                errorCode: result.errorCode,
                errorMessage: result.error,
              });

              return {
                success: false,
                conversionId: conversion.id,
                error: result.error,
                errorCode: result.errorCode,
              };
            }

            // Update conversion with multi-page results
            await updateConversion(conversion.id, {
              status: 'review',
              extractedTables: result.tables,
              tableCount: result.tables.length,
              rowCount: result.tables.reduce((sum, t) => sum + t.rows.length, 0),
              processingTimeMs: result.processingTime,
              aiConfidenceScore: String(result.confidence),
              aiWarnings: result.warnings,
              pageCount: pdfConversion.totalPages,
            });

            // Increment usage
            if (ctx.user) {
              await incrementUserUsage(ctx.user.id);
            } else {
              await incrementAnonymousUsage(ip);
            }

            return {
              success: true,
              conversionId: conversion.id,
              tables: result.tables,
              warnings: result.warnings,
              confidence: result.confidence,
              processingTime: result.processingTime,
              pageCount: pdfConversion.totalPages,
            };
          }
          
          // For non-PDF files (images), extract directly
          const result = await extractTablesFromPDF(
            imageBase64,
            input.fileName,
            imageMimeType,
            template.systemPrompt
          );

          if (!result.success) {
            await updateConversion(conversion.id, {
              status: 'failed',
              errorCode: result.errorCode,
              errorMessage: result.error,
            });

            return {
              success: false,
              conversionId: conversion.id,
              error: result.error,
              errorCode: result.errorCode,
            };
          }

          // Update conversion with results
          await updateConversion(conversion.id, {
            status: 'review',
            extractedTables: result.tables,
            tableCount: result.tables.length,
            rowCount: result.tables.reduce((sum, t) => sum + t.rows.length, 0),
            processingTimeMs: result.processingTime,
            aiConfidenceScore: String(result.confidence),
            aiWarnings: result.warnings,
          });

          // Increment usage
          if (ctx.user) {
            await incrementUserUsage(ctx.user.id);
          } else {
            await incrementAnonymousUsage(ip);
          }

          return {
            success: true,
            conversionId: conversion.id,
            tables: result.tables,
            warnings: result.warnings,
            confidence: result.confidence,
            processingTime: result.processingTime,
          };
        } catch (error) {
          console.error('Conversion error:', error);
          await updateConversion(conversion.id, {
            status: 'failed',
            errorCode: 'INTERNAL_ERROR',
            errorMessage: 'An unexpected error occurred',
          });

          return {
            success: false,
            conversionId: conversion.id,
            error: 'An unexpected error occurred. Please try again.',
            errorCode: 'INTERNAL_ERROR',
          };
        }
      }),

    // Get conversion by ID
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getConversionById(input.id);
      }),

    // Get all conversions in a batch
    getBatch: publicProcedure
      .input(z.object({ batchId: z.string() }))
      .query(async ({ input }) => {
        return await getConversionsByBatchId(input.batchId);
      }),

    // Get user's conversion history
    history: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ ctx, input }) => {
        return await getUserConversions(ctx.user.id, input?.limit || 20);
      }),

    // Export to Excel
    export: publicProcedure
      .input(z.object({
        conversionId: z.number().optional(),
        sheets: z.array(z.object({
          name: z.string(),
          data: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
        })),
        fileName: z.string().default('export'),
      }))
      .mutation(async ({ input }) => {
        try {
          const buffer = spreadsheetDataToExcel({ sheets: input.sheets });
          
          // Upload to S3
          const fileKey = `exports/${uuidv4()}-${input.fileName}.xlsx`;
          const { url } = await storagePut(fileKey, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

          // Update conversion if provided
          if (input.conversionId) {
            await updateConversion(input.conversionId, {
              status: 'completed',
              xlsxStoragePath: url,
            });
          }

          return { success: true, url };
        } catch (error) {
          console.error('Export error:', error);
          return { success: false, error: 'Failed to export Excel file' };
        }
      }),

    // Delete a conversion
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const conversion = await getConversionById(input.id);
        if (!conversion || conversion.userId !== ctx.user.id) {
          throw new Error('Conversion not found or access denied');
        }
        // For now, just mark as deleted by updating status
        // In production, you'd also delete the S3 files
        await updateConversion(input.id, { status: 'failed', errorMessage: 'Deleted by user' });
        return { success: true };
      }),
  }),

  // Templates
  templates: router({
    list: publicProcedure.query(async () => {
      return await getAllTemplates();
    }),

    get: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return await getTemplateBySlug(input.slug);
      }),

    seed: publicProcedure.mutation(async () => {
      await seedTemplates();
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
