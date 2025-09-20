import Bull from 'bull'
import { logger } from '../utils/logger'
import { database } from '../models/database'
import { s3Service } from '../services/s3Service'
import { whisperService } from '../services/whisperService'
import { mockService } from '../services/mockService'
import { JobData, JobResult } from '../types'

class QueueService {
  private transcriptionQueue: Bull.Queue<JobData>

  constructor() {
    // Initialize Redis connection for Bull
    let redisConfig: any

    if (process.env.UPSTASH_REDIS_URL) {
      // Production: Use Upstash Redis with standard Redis protocol
      const redisUrl = new URL(process.env.UPSTASH_REDIS_URL)
      redisConfig = {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port) || 6379,
        password: redisUrl.password,
        username: redisUrl.username || 'default',
        tls: process.env.NODE_ENV === 'production' ? {} : undefined,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: true,
      }
    } else {
      // Development: Local Redis or in-memory fallback
      redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: process.env.NODE_ENV === 'development' ? 1 : 3,
      }
    }

    this.transcriptionQueue = new Bull('transcription', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 50,     // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    this.setupJobProcessors()
    this.setupEventHandlers()
  }

  private setupJobProcessors(): void {
    // Process transcription jobs
    this.transcriptionQueue.process('transcribe', 2, async (job) => {
      return this.processTranscriptionJob(job.data)
    })
  }

  private setupEventHandlers(): void {
    // Job started
    this.transcriptionQueue.on('active', (job) => {
      logger.info(`Transcription job started: ${job.id}`, {
        transcriptionId: job.data.transcriptionId,
      })
    })

    // Job completed
    this.transcriptionQueue.on('completed', (job, result) => {
      logger.info(`Transcription job completed: ${job.id}`, {
        transcriptionId: job.data.transcriptionId,
        success: result.success,
      })
    })

    // Job failed
    this.transcriptionQueue.on('failed', (job, error) => {
      logger.error(`Transcription job failed: ${job.id}`, {
        transcriptionId: job.data.transcriptionId,
        error: error.message,
        stack: error.stack,
      })
    })

    // Job stuck/stalled
    this.transcriptionQueue.on('stalled', (job) => {
      logger.warn(`Transcription job stalled: ${job.id}`, {
        transcriptionId: job.data.transcriptionId,
      })
    })
  }

  async addTranscriptionJob(jobData: JobData): Promise<Bull.Job<JobData>> {
    try {
      logger.info('Adding transcription job to queue', {
        transcriptionId: jobData.transcriptionId,
        uploadId: jobData.uploadId,
      })

      const job = await this.transcriptionQueue.add('transcribe', jobData, {
        priority: 1, // Normal priority
        delay: 0,    // Process immediately
      })

      // Update transcription status to processing
      await database.updateTranscriptionStatus(jobData.transcriptionId, 'processing')

      return job
    } catch (error) {
      logger.error('Failed to add transcription job to queue', error)
      throw error
    }
  }

  private async processTranscriptionJob(jobData: JobData): Promise<JobResult> {
    const { transcriptionId, uploadId, s3Key, options } = jobData

    try {
      logger.info('Processing transcription job', {
        transcriptionId,
        uploadId,
        s3Key,
      })

      // Step 1: Download file from S3
      logger.debug('Downloading file from S3', { s3Key })
      const audioBuffer = await s3Service.getFile(s3Key)

      if (!audioBuffer) {
        throw new Error(`Failed to download file from S3: ${s3Key}`)
      }

      // Step 2: Process with Whisper API or Mock Service
      logger.debug('Starting transcription', {
        bufferSize: audioBuffer.length,
        options,
      })

      const startTime = Date.now()
      let transcriptionResult

      if (mockService.shouldUseMock()) {
        logger.info('Using mock transcription service')
        transcriptionResult = await mockService.mockTranscription(audioBuffer, options)
      } else {
        logger.info('Using Whisper API')
        transcriptionResult = await whisperService.transcribeAudio(audioBuffer, options)
      }

      const processingTime = Math.floor((Date.now() - startTime) / 1000)

      logger.info('Whisper transcription completed', {
        transcriptionId,
        processingTime,
        textLength: transcriptionResult.text.length,
        confidence: transcriptionResult.confidence,
      })

      // Step 3: Update database with results
      const result = {
        transcriptionId,
        text: transcriptionResult.text,
        segments: transcriptionResult.segments,
        confidence: transcriptionResult.confidence,
        status: 'completed' as const,
        progress: 100,
        filename: `transcription_${transcriptionId}`,
      }

      await database.updateTranscriptionStatus(
        transcriptionId,
        'completed',
        result
      )

      // Step 4: Update usage statistics
      await database.updateUsageStats(
        new Date(),
        0, // uploads
        1, // transcriptions
        processingTime,
        transcriptionResult.confidence
      )

      return {
        success: true,
        transcription: {
          text: transcriptionResult.text,
          segments: transcriptionResult.segments,
          confidence: transcriptionResult.confidence,
        },
      }

    } catch (error) {
      logger.error('Transcription job processing failed', {
        transcriptionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Update database with error
      await database.updateTranscriptionStatus(
        transcriptionId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Processing failed'
      )

      // Update error statistics
      await database.updateUsageStats(
        new Date(),
        0, // uploads
        0, // transcriptions
        0, // processing time
        undefined, // confidence
        1 // errors
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      }
    }
  }

  // Get queue statistics
  async getQueueStats(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.transcriptionQueue.getWaiting(),
      this.transcriptionQueue.getActive(),
      this.transcriptionQueue.getCompleted(),
      this.transcriptionQueue.getFailed(),
      this.transcriptionQueue.getDelayed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    }
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<{
    status: string
    progress: number
    data?: any
    error?: string
  }> {
    try {
      const job = await this.transcriptionQueue.getJob(jobId)

      if (!job) {
        throw new Error('Job not found')
      }

      const state = await job.getState()
      const progress = job.progress()

      return {
        status: state,
        progress: typeof progress === 'number' ? progress : 0,
        data: job.returnvalue,
        error: job.failedReason,
      }
    } catch (error) {
      throw new Error(`Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clean up old jobs
  async cleanupJobs(): Promise<void> {
    try {
      logger.info('Starting queue cleanup')

      // Remove completed jobs older than 24 hours
      await this.transcriptionQueue.clean(24 * 60 * 60 * 1000, 'completed')

      // Remove failed jobs older than 7 days
      await this.transcriptionQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed')

      logger.info('Queue cleanup completed')
    } catch (error) {
      logger.error('Queue cleanup failed', error)
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    logger.info('Closing queue service')
    await this.transcriptionQueue.close()
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can get queue stats instead of adding a test job
      await this.getQueueStats()
      return true
    } catch (error) {
      logger.error('Queue health check failed', error)
      return false
    }
  }

  // Get health status for API testing
  async getHealthStatus(): Promise<{
    redis: {
      status: 'healthy' | 'unhealthy'
      error?: string
    }
    queue: {
      status: 'healthy' | 'unhealthy'
      stats?: any
    }
  }> {
    try {
      const stats = await this.getQueueStats()
      return {
        redis: {
          status: 'healthy'
        },
        queue: {
          status: 'healthy',
          stats
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Queue health status check failed', error)

      return {
        redis: {
          status: 'unhealthy',
          error: errorMessage
        },
        queue: {
          status: 'unhealthy'
        }
      }
    }
  }
}

export const queueService = new QueueService()

// Setup periodic cleanup (every 6 hours)
setInterval(() => {
  queueService.cleanupJobs()
}, 6 * 60 * 60 * 1000)

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing queue service')
  await queueService.close()
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing queue service')
  await queueService.close()
})