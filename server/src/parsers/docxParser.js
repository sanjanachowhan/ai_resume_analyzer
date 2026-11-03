import mammoth from 'mammoth';
import { assertSafeZip } from '../utils/zipInspector.js';

export async function extractDocxText(buffer) {
  assertSafeZip(buffer); // refuse zip bombs before opening the archive
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}
