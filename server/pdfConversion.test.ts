import { describe, expect, it } from "vitest";
import { validateImageBase64, optimizeImageForAI } from "./lib/pdfToImage";

describe("Image Validation", () => {
  it("should detect PNG files correctly", async () => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]).toString('base64');
    const result = await validateImageBase64(pngHeader);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/png");
  });

  it("should detect JPEG files correctly", async () => {
    // JPEG magic bytes: FF D8 FF
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]).toString('base64');
    const result = await validateImageBase64(jpegHeader);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("should detect PDF files correctly", async () => {
    // PDF magic bytes: %PDF (25 50 44 46)
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]).toString('base64');
    const result = await validateImageBase64(pdfHeader);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("application/pdf");
  });

  it("should handle base64 with data URL prefix", async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('base64');
    const dataUrl = `data:image/png;base64,${pngHeader}`;
    const result = await validateImageBase64(dataUrl);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/png");
  });

  it("should detect WebP files correctly", async () => {
    // WebP magic bytes: RIFF....WEBP
    const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString('base64');
    const result = await validateImageBase64(webpHeader);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe("image/webp");
  });
});

describe("PDF Processing Logic", () => {
  it("should correctly identify PDF mime type", () => {
    const isPdf = (mimeType: string) => mimeType === 'application/pdf';
    expect(isPdf('application/pdf')).toBe(true);
    expect(isPdf('image/png')).toBe(false);
    expect(isPdf('image/jpeg')).toBe(false);
  });

  it("should correctly identify image mime types", () => {
    const isImage = (mimeType: string) => mimeType.startsWith('image/');
    expect(isImage('image/png')).toBe(true);
    expect(isImage('image/jpeg')).toBe(true);
    expect(isImage('image/webp')).toBe(true);
    expect(isImage('application/pdf')).toBe(false);
  });
});
