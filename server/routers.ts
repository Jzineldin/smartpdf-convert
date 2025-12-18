import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
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
  getAllTemplates,
  getTemplateBySlug,
  seedTemplates,
} from "./db";
import { extractTablesFromPDF } from "./lib/openrouter";
import { tablesToExcel, spreadsheetDataToExcel } from "./lib/excel";
import { createCheckoutSession, createPortalSession, getStripeConfig } from "./lib/stripe";
import { storagePut } from "./storage";
import { v4 as uuidv4 } from "uuid";

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
      return user;
    }),

    getUsage: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) return null;

      const usageCheck = await checkUserUsageLimit(ctx.user.id);
      
      return {
        conversionsToday: user.conversionsToday,
        conversionsThisMonth: user.conversionsThisMonth,
        totalConversions: user.totalConversions,
        subscriptionStatus: user.subscriptionStatus,
        remaining: usageCheck.remaining,
        dailyLimit: user.subscriptionStatus === 'pro' ? -1 : 3,
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
        if (ctx.user) {
          return await checkUserUsageLimit(ctx.user.id);
        }
        
        // For anonymous users, use IP address
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket?.remoteAddress || '127.0.0.1';
        return await checkAnonymousUsageLimit(ip);
      }),

    // Process PDF and extract tables
    process: publicProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string().default('image/png'),
        anonymousId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket?.remoteAddress || '127.0.0.1';

        // Check usage limits
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

        // Validate file size (20MB limit)
        if (input.fileSize > 20 * 1024 * 1024) {
          return {
            success: false,
            error: 'File too large. Maximum size is 20MB.',
            errorCode: 'FILE_TOO_LARGE',
          };
        }

        // Create conversion record
        const conversion = await createConversion({
          userId: ctx.user?.id || null,
          anonymousId: input.anonymousId || null,
          ipAddress: ip,
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
          // Extract tables using AI
          const result = await extractTablesFromPDF(
            input.fileBase64,
            input.fileName,
            input.mimeType
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
