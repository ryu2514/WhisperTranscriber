import { Router, Request, Response } from 'express'
import { database } from '../models/database'
import { queueService } from '../services/queueService'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { ExportFormat, TranscriptionOptions } from '../types'

const router = Router()

// Start transcription
router.post('/:uploadId', asyncHandler(async (req: Request, res: Response) => {
  const { uploadId } = req.params

  // Get upload record
  const upload = await database.getUploadById(uploadId)

  if (!upload) {
    throw createError('Upload not found', 404, 'UPLOAD_NOT_FOUND')
  }

  // Check if upload has expired
  if (new Date() > upload.expires_at) {
    throw createError('Upload has expired', 410, 'UPLOAD_EXPIRED')
  }

  try {
    // Parse options from request body
    const options: TranscriptionOptions = {
      language: (req.body.language as 'auto' | 'ja' | 'en') || 'auto',
      includeTimestamps: req.body.includeTimestamps !== false, // Default to true
      speakerDetection: req.body.speakerDetection === true,
      medicalTerms: req.body.medicalTerms !== false, // Default to true for therapist use
    }

    // Create transcription record
    const transcription = await database.createTranscription({
      upload_id: uploadId,
      language: options.language === 'auto' ? undefined : options.language,
      options,
    })

    // Add transcription job to queue
    await queueService.addTranscriptionJob({
      transcriptionId: transcription.id,
      uploadId: uploadId,
      s3Key: upload.s3_key,
      options,
    })

    logger.info(`Transcription queued: ${transcription.id} for upload: ${uploadId}`)

    // Estimate processing time based on file size and duration
    const estimatedTime = Math.ceil((upload.duration || upload.file_size / 1000000) * 0.1) // ~10% of audio length

    res.json({
      success: true,
      data: {
        transcriptionId: transcription.id,
        status: 'processing',
        estimatedTime,
      },
    })
  } catch (error) {
    logger.error('Failed to start transcription:', error)
    throw createError('Failed to start transcription', 500, 'TRANSCRIPTION_START_ERROR')
  }
}))

// Get transcription status
router.get('/:transcriptionId/status', asyncHandler(async (req: Request, res: Response) => {
  const { transcriptionId } = req.params

  const transcription = await database.getTranscriptionById(transcriptionId)

  if (!transcription) {
    throw createError('Transcription not found', 404, 'TRANSCRIPTION_NOT_FOUND')
  }

  // Mock progress for development
  let progress = 0
  if (transcription.status === 'processing') {
    // Simulate progress based on time elapsed
    const elapsed = Date.now() - transcription.created_at.getTime()
    progress = Math.min(95, Math.floor(elapsed / 1000 / 60 * 20)) // ~20% per minute, max 95%
  } else if (transcription.status === 'completed') {
    progress = 100
  }

  res.json({
    success: true,
    data: {
      status: transcription.status,
      progress,
      estimatedTime: transcription.status === 'processing' ? Math.max(0, 300 - progress * 3) : undefined,
      currentStage: transcription.status === 'processing' ? 'Whisper API処理中' : undefined,
      error: transcription.error_message,
    },
  })
}))

// Get transcription result
router.get('/:transcriptionId/result', asyncHandler(async (req: Request, res: Response) => {
  const { transcriptionId } = req.params
  const format = (req.query.format as ExportFormat) || 'text'

  const result = await database.getTranscriptionWithUpload(transcriptionId)

  if (!result) {
    throw createError('Transcription not found', 404, 'TRANSCRIPTION_NOT_FOUND')
  }

  const { transcription, upload } = result

  if (transcription.status !== 'completed') {
    throw createError('Transcription not completed yet', 400, 'TRANSCRIPTION_NOT_READY')
  }

  if (!transcription.result) {
    throw createError('Transcription result not available', 500, 'RESULT_NOT_AVAILABLE')
  }

  // Format the result based on requested format
  let content: string
  let mimeType: string

  switch (format) {
    case 'srt':
      content = formatAsSRT(transcription.result.segments || [])
      mimeType = 'text/plain'
      break
    case 'vtt':
      content = formatAsVTT(transcription.result.segments || [])
      mimeType = 'text/vtt'
      break
    case 'json':
      content = JSON.stringify(transcription.result, null, 2)
      mimeType = 'application/json'
      break
    case 'markdown':
      content = formatAsMarkdown(transcription.result, upload.original_name)
      mimeType = 'text/markdown'
      break
    case 'text':
    default:
      content = transcription.result.text
      mimeType = 'text/plain'
      break
  }

  res.json({
    success: true,
    data: {
      transcriptionId: transcription.id,
      filename: upload.original_name,
      text: transcription.result.text,
      segments: transcription.result.segments,
      confidence: transcription.confidence,
      status: transcription.status,
      progress: 100,
      format,
      content,
      mimeType,
    },
  })
}))

// Helper functions for formatting
function formatAsSRT(segments: any[]): string {
  return segments.map((segment, index) => {
    const startTime = formatSRTTime(segment.start)
    const endTime = formatSRTTime(segment.end)
    return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`
  }).join('\n')
}

function formatAsVTT(segments: any[]): string {
  const header = 'WEBVTT\n\n'
  const content = segments.map((segment) => {
    const startTime = formatVTTTime(segment.start)
    const endTime = formatVTTTime(segment.end)
    return `${startTime} --> ${endTime}\n${segment.text}\n`
  }).join('\n')
  return header + content
}

function formatAsMarkdown(result: any, filename: string): string {
  const header = `# 文字起こし結果: ${filename}\n\n`
  const metadata = `**処理日時**: ${new Date().toLocaleString('ja-JP')}\n**認識精度**: ${result.confidence ? Math.round(result.confidence * 100) + '%' : '不明'}\n\n---\n\n`
  return header + metadata + result.text
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export default router