import multer from 'multer'
import { Request } from 'express'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

// File type validation
const allowedMimeTypes = [
  'audio/mpeg',      // MP3
  'audio/wav',       // WAV
  'audio/mp4',       // M4A
  'audio/flac',      // FLAC
  'video/mp4',       // MP4
  'video/quicktime', // MOV
  'video/x-msvideo', // AVI
]

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '524288000') // 500MB default
const maxDuration = parseInt(process.env.MAX_DURATION || '10800') // 3 hours default

// Multer configuration for memory storage
const storage = multer.memoryStorage()

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  logger.debug(`File upload attempt: ${file.originalname}, MIME: ${file.mimetype}`)

  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = createError(
      `Unsupported file type: ${file.mimetype}. Supported types: ${allowedMimeTypes.join(', ')}`,
      400,
      'UNSUPPORTED_FORMAT'
    )
    return cb(error)
  }

  cb(null, true)
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 1,
  },
})

export const validateFileSize = (file: Express.Multer.File): void => {
  if (file.size > maxFileSize) {
    throw createError(
      `File size ${file.size} exceeds maximum allowed size of ${maxFileSize} bytes`,
      400,
      'FILE_TOO_LARGE'
    )
  }
}

export const generateUniqueFilename = (originalname: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = originalname.split('.').pop()
  return `${timestamp}-${random}.${extension}`
}

export const getFileDuration = async (buffer: Buffer, mimetype: string): Promise<number | undefined> => {
  // This is a placeholder - in a real implementation, you would use ffprobe
  // to get the actual duration of the audio/video file
  // For now, we'll return undefined as duration detection requires FFmpeg
  return undefined
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getFileInfo = (file: Express.Multer.File) => {
  return {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    buffer: file.buffer,
  }
}