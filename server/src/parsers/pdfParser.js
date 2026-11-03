// PDF.js is the PDF engine used by Firefox. It is actively maintained and reads far more kinds of PDF
// than the old "pdf-parse" package, which bundled a 2018 version of it.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pageText } from './pdfText.js';

const MAX_PAGES = 30; // a resume or job posting is a few pages; this stops huge PDFs from hogging the server
const READ_TIMEOUT_MS = 20000; // a damaged PDF must never leave a request hanging

async function readPages(task) {
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(pageText(content.items));
    page.cleanup();
  }
  return pages.join('\n\n');
}

export async function extractPdfText(buffer) {
  const task = getDocument({
    data: new Uint8Array(buffer), // a copy: PDF.js takes ownership of the memory it is given
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });

  let timer;
  const work = readPages(task);
  work.catch(() => {}); // if the timeout wins, a late failure here must not become an unhandled rejection
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Reading the PDF took too long')), READ_TIMEOUT_MS);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    task.destroy().catch(() => {});
  }
}
