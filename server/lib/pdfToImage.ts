import { fromBuffer } from 'pdf2pic';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export interface ConvertedPage {
  pageNumber: number;
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface PdfConversionResult {
  success: boolean;
  pages: ConvertedPage[];
  totalPages: number;
  error?: string;
}

/**
 * Get the actual page count from a PDF using pdf-lib
 */
async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return 0;
  }
}

/**
 * Convert PDF pages to PNG images using pdf2pic (GraphicsMagick/Ghostscript)
 */
export async function convertPdfToImages(pdfBase64: string, maxPages: number = 10): Promise<PdfConversionResult> {
  try {
    // Clean the base64 string
    let cleanBase64 = pdfBase64;
    if (pdfBase64.includes(',')) {
      cleanBase64 = pdfBase64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const pdfBuffer = Buffer.from(cleanBase64, 'base64');
    
    console.log(`Converting PDF to images, buffer size: ${pdfBuffer.length} bytes`);

    // Get actual page count from PDF
    const actualPageCount = await getPdfPageCount(pdfBuffer);
    console.log(`PDF has ${actualPageCount} page(s)`);

    if (actualPageCount === 0) {
      return {
        success: false,
        pages: [],
        totalPages: 0,
        error: 'Could not read PDF. The file may be corrupted or password-protected.',
      };
    }

    // Only process up to the actual page count or maxPages, whichever is smaller
    const pagesToProcess = Math.min(actualPageCount, maxPages);

    // Configure pdf2pic
    const options = {
      density: 150, // DPI - higher = better quality but larger files
      saveFilename: 'page',
      savePath: '/tmp',
      format: 'png',
      width: 1200,
      height: 1600,
    };

    const converter = fromBuffer(pdfBuffer, options);
    
    const pages: ConvertedPage[] = [];
    
    // Process only existing pages
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      try {
        const result = await converter(pageNum, { responseType: 'base64' });
        
        if (result && result.base64) {
          pages.push({
            pageNumber: pageNum,
            base64: result.base64,
            mimeType: 'image/png',
          });
          console.log(`Converted page ${pageNum} of ${actualPageCount}`);
        }
      } catch (pageError: any) {
        console.error(`Error converting page ${pageNum}:`, pageError.message);
        // Continue with other pages even if one fails
      }
    }

    if (pages.length === 0) {
      return {
        success: false,
        pages: [],
        totalPages: actualPageCount,
        error: 'Could not extract any pages from the PDF. The file may be corrupted or use unsupported features.',
      };
    }

    return {
      success: true,
      pages,
      totalPages: actualPageCount,
    };
  } catch (error: any) {
    console.error('PDF conversion error:', error);
    return {
      success: false,
      pages: [],
      totalPages: 0,
      error: error.message || 'Failed to convert PDF to images',
    };
  }
}

/**
 * Validate that a base64 string is a valid image or PDF
 */
export async function validateImageBase64(base64: string): Promise<{
  valid: boolean;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: string;
}> {
  try {
    let cleanBase64 = base64;
    if (base64.includes(',')) {
      cleanBase64 = base64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Check file signature for common types
    const signature = buffer.slice(0, 8).toString('hex');
    
    let mimeType = 'application/octet-stream';
    
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (signature.startsWith('89504e47')) {
      mimeType = 'image/png';
    }
    // JPEG signature: FF D8 FF
    else if (signature.startsWith('ffd8ff')) {
      mimeType = 'image/jpeg';
    }
    // PDF signature: 25 50 44 46 (%PDF)
    else if (signature.startsWith('25504446')) {
      mimeType = 'application/pdf';
    }
    // GIF signature: 47 49 46 38
    else if (signature.startsWith('47494638')) {
      mimeType = 'image/gif';
    }
    // WebP signature: 52 49 46 46 ... 57 45 42 50
    else if (signature.startsWith('52494646')) {
      mimeType = 'image/webp';
    }

    // If it's an image, get dimensions using sharp
    if (mimeType.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer).metadata();
        return {
          valid: true,
          mimeType,
          width: metadata.width,
          height: metadata.height,
        };
      } catch {
        return {
          valid: true,
          mimeType,
        };
      }
    }

    return {
      valid: true,
      mimeType,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid base64 data',
    };
  }
}

/**
 * Optimize an image for AI processing
 * Resizes large images and converts to PNG
 */
export async function optimizeImageForAI(base64: string, maxWidth: number = 2000): Promise<{
  success: boolean;
  base64?: string;
  mimeType?: string;
  error?: string;
}> {
  try {
    let cleanBase64 = base64;
    if (base64.includes(',')) {
      cleanBase64 = base64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Use sharp to resize and optimize
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    let processedImage = image;
    
    // Resize if too large
    if (metadata.width && metadata.width > maxWidth) {
      processedImage = image.resize(maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    
    // Convert to PNG for best compatibility
    const outputBuffer = await processedImage.png({ quality: 90 }).toBuffer();
    
    return {
      success: true,
      base64: outputBuffer.toString('base64'),
      mimeType: 'image/png',
    };
  } catch (error: any) {
    console.error('Image optimization error:', error);
    return {
      success: false,
      error: error.message || 'Failed to optimize image',
    };
  }
}
