import { Router, Request, Response } from 'express'
import { upload, validateFileSize, generateUniqueFilename, getFileInfo, getFileDuration } from '../services/fileService'
import { s3Service } from '../services/s3Service'
import { database } from '../models/database'
import { uploadLimiter } from '../middleware/rateLimiter'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { validateFileUpload, sanitizeInput, detectSQLInjection, validateRequest } from '../middleware/validation'
import { logger } from '../utils/logger'
import { TranscriptionOptions } from '../types'

const router = Router()

// Apply security middleware
router.use(validateRequest)
router.use(sanitizeInput)
router.use(detectSQLInjection)
router.use(uploadLimiter.middleware)

router.post('/', upload.single('file'), validateFileUpload, asyncHandler(async (req: Request, res: Response) => {
  const file = req.file

  if (!file) {
    throw createError('No file uploaded', 400, 'NO_FILE')
  }

  // Validate file size
  validateFileSize(file)

  // Get file info
  const fileInfo = getFileInfo(file)
  logger.info(`Processing file upload: ${fileInfo.originalName} (${fileInfo.sizeFormatted})`)

  // Parse options from form data
  const options: TranscriptionOptions = {
    language: (req.body.language as 'auto' | 'ja' | 'en') || 'auto',
    includeTimestamps: req.body.includeTimestamps === 'true',
    speakerDetection: req.body.speakerDetection === 'true',
    medicalTerms: req.body.medicalTerms === 'true',
  }

  try {
    // Generate unique filename for S3
    const s3Key = generateUniqueFilename(fileInfo.originalName)

    // Upload to S3
    const s3Url = await s3Service.uploadFile(s3Key, fileInfo.buffer, fileInfo.mimetype)
    logger.debug(`File uploaded to S3: ${s3Url}`)

    // Get file duration (placeholder for now)
    const duration = await getFileDuration(fileInfo.buffer, fileInfo.mimetype)

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Save upload record to database
    const uploadRecord = await database.createUpload({
      filename: s3Key,
      original_name: fileInfo.originalName,
      file_size: fileInfo.size,
      mime_type: fileInfo.mimetype,
      s3_key: s3Key,
      duration: duration || null,
      expires_at: expiresAt,
      ip_address: req.ip || null,
      user_agent: req.get('User-Agent') || null,
    })

    // Update usage statistics
    await database.updateUsageStats(new Date(), 1)

    logger.info(`Upload completed: ${uploadRecord.id}`)

    // Return success response
    res.json({
      success: true,
      data: {
        uploadId: uploadRecord.id,
        filename: uploadRecord.original_name,
        fileSize: uploadRecord.file_size,
        duration: uploadRecord.duration,
        status: 'uploaded' as const,
      },
    })
  } catch (error) {
    logger.error('Upload processing failed:', error)

    if (error instanceof Error && 'code' in error) {
      throw error
    }

    throw createError('Failed to process file upload', 500, 'UPLOAD_PROCESSING_ERROR')
  }
}))

// Endpoint to get upload info
router.get('/:uploadId', asyncHandler(async (req: Request, res: Response) => {
  const { uploadId } = req.params

  const upload = await database.getUploadById(uploadId)

  if (!upload) {
    throw createError('Upload not found', 404, 'UPLOAD_NOT_FOUND')
  }

  // Check if upload has expired
  if (new Date() > upload.expires_at) {
    throw createError('Upload has expired', 410, 'UPLOAD_EXPIRED')
  }

  res.json({
    success: true,
    data: {
      uploadId: upload.id,
      filename: upload.original_name,
      fileSize: upload.file_size,
      duration: upload.duration,
      uploadedAt: upload.uploaded_at,
      expiresAt: upload.expires_at,
    },
  })
}))

export default router