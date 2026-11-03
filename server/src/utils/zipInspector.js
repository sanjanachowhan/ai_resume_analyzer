import { AppError } from './AppError.js';

// A DOCX file is a ZIP archive. A "zip bomb" is a tiny file that expands to gigabytes when opened.
// Before the file is opened, we read the sizes the archive declares and refuse anything suspicious.
// (A forged archive can lie about sizes, so this is one layer of protection, next to the 5 MB upload limit.)

const EOCD_SIGNATURE = 0x06054b50; // "end of central directory"
const ENTRY_SIGNATURE = 0x02014b50; // one file inside the archive

export const ZIP_LIMITS = {
  maxEntries: 2000,
  maxUncompressedBytes: 100 * 1024 * 1024, // a normal resume expands to a few MB at most
  maxRatio: 200, // uncompressed / compressed
  ratioCheckFrom: 10 * 1024 * 1024,
};

export function inspectZip(buffer, limits = ZIP_LIMITS) {
  // unsafe = the archive claims a dangerous size; otherwise it is simply not a readable archive.
  const fail = (reason, unsafe = false) => ({ ok: false, reason, unsafe });

  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65535); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return fail('not a valid zip archive');

  const entries = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entries > limits.maxEntries) return fail('too many files inside', true);
  if (directoryOffset + directorySize > buffer.length) return fail('corrupt archive');

  let position = directoryOffset;
  let compressed = 0;
  let uncompressed = 0;
  for (let n = 0; n < entries; n++) {
    if (position + 46 > buffer.length || buffer.readUInt32LE(position) !== ENTRY_SIGNATURE) return fail('corrupt archive');
    compressed += buffer.readUInt32LE(position + 20);
    uncompressed += buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    position += 46 + nameLength + extraLength + commentLength;
  }

  if (uncompressed > limits.maxUncompressedBytes) return fail('expands to too much data', true);
  if (uncompressed > limits.ratioCheckFrom && compressed > 0 && uncompressed / compressed > limits.maxRatio) {
    return fail('suspicious compression ratio', true);
  }
  return { ok: true, entries, uncompressed };
}

export function assertSafeZip(buffer) {
  const result = inspectZip(buffer);
  if (result.ok) return;

  if (result.unsafe) {
    console.error(`Rejected unsafe DOCX: ${result.reason}`);
    throw new AppError('This file looks unsafe and was not processed.', 422, 'UNSAFE_FILE');
  }
  // Not a readable archive at all (for example a damaged or truncated file): the ordinary "corrupted" message.
  console.error(`Unreadable DOCX: ${result.reason}`);
  throw new AppError("We couldn't read this DOCX file. It may be corrupted or password-protected.", 422, 'UNREADABLE_FILE');
}
