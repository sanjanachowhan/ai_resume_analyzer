import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);

// Builds an upload middleware for one form field. Files stay in memory only:
// we keep the extracted text, never the file itself.
function makeUpload(fieldName) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new AppError('Only PDF and DOCX files are supported.', 400, 'INVALID_FILE_TYPE'));
      }
      cb(null, true);
    },
  });

  // Wraps multer so its errors become our standard API errors.
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(`File is too large. Maximum size is ${env.MAX_FILE_SIZE_MB} MB.`, 413, 'FILE_TOO_LARGE'));
        }
        return next(new AppError('Invalid file upload.', 400, 'INVALID_UPLOAD'));
      }
      next(err);
    });
  };
}

export const uploadResumeFile = makeUpload('resume');
export const uploadJobFile = makeUpload('file');
