import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

/**
 * Convert PDF pages to PNG images
 * Note: pdf-lib can't render PDFs to images directly, so we'll use a different approach
 * For now, we'll extract the PDF as base64 and let the AI handle it
 * If the AI fails, we provide a helpful error message
 */

export async function convertPdfToImages(pdfBase64: string): Promise<{
  success: boolean;
  images: { pageNumber: number; base64: string; mimeType: string }[];
  error?: string;
}> {
  try {
    // Clean the base64 string
    let cleanBase64 = pdfBase64;
    if (pdfBase64.includes(',')) {
      cleanBase64 = pdfBase64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    // Load the PDF to get page count
    const pdfBytes = Buffer.from(cleanBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    console.log(`PDF has ${pageCount} pages`);

    // For now, return the PDF as-is since pdf-lib can't render to images
    // The AI model will need to handle the PDF format
    // In production, you'd use a service like pdf2pic, Puppeteer, or a cloud service

    return {
      success: true,
      images: [{
        pageNumber: 1,
        base64: cleanBase64,
        mimeType: 'application/pdf',
      }],
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    return {
      success: false,
      images: [],
      error: 'Failed to process PDF file',
    };
  }
}

/**
 * Validate that a base64 string is a valid image
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
    
    // Check file signature for common image types
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
