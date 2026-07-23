import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Extract plain text from an uploaded resume file buffer.
 * Supports: .txt, .md, .json (as text), .docx, .pdf
 */
export async function extractTextFromResumeFile(file) {
  if (!file?.buffer) throw new Error('No file uploaded');

  const originalName = String(file.originalname || 'resume').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  const buffer = file.buffer;

  const isPdf =
    mime.includes('pdf') || originalName.endsWith('.pdf');
  const isDocx =
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    originalName.endsWith('.docx') ||
    originalName.endsWith('.doc');
  const isText =
    mime.startsWith('text/') ||
    originalName.endsWith('.txt') ||
    originalName.endsWith('.md') ||
    originalName.endsWith('.json');

  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = String(result?.text || '').trim();
      if (!text) throw new Error('Could not extract text from PDF');
      return { text, sourceType: 'pdf' };
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    const text = String(result?.value || '').trim();
    if (!text) throw new Error('Could not extract text from Word document');
    return { text, sourceType: 'docx' };
  }

  if (isText) {
    const text = buffer.toString('utf8').trim();
    if (!text) throw new Error('File is empty');
    return { text, sourceType: 'text' };
  }

  throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT resume.');
}
