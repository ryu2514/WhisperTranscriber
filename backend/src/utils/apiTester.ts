import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { logger } from './logger'

interface APITestResult {
  service: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: any
  responseTime?: number
}

export class APITester {
  private results: APITestResult[] = []

  async runAllTests(): Promise<APITestResult[]> {
    this.results = []

    logger.info('Starting API connectivity tests...')

    await this.testOpenAIAPI()
    await this.testDatabaseConnection()
    await this.testRedisConnection()

    logger.info('API tests completed', { results: this.results })
    return this.results
  }

  private async testOpenAIAPI(): Promise<void> {
    const startTime = Date.now()

    try {
      if (!process.env.OPENAI_API_KEY) {
        this.results.push({
          service: 'OpenAI API',
          status: 'warning',
          message: 'OpenAI API key not configured - using mock service',
          details: { configured: false }
        })
        return
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })

      // Test 1: List available models
      const models = await openai.models.list()
      const whisperModels = models.data.filter(model =>
        model.id.includes('whisper')
      )

      if (whisperModels.length === 0) {
        this.results.push({
          service: 'OpenAI API',
          status: 'error',
          message: 'No Whisper models available with current API key',
          details: { availableModels: models.data.map(m => m.id) }
        })
        return
      }

      // Test 2: Create a test audio file for transcription
      const testAudioPath = await this.createTestAudioFile()

      // Test 3: Perform actual transcription test
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(testAudioPath),
        model: 'whisper-1',
        language: 'ja',
        response_format: 'verbose_json'
      })

      // Clean up test file
      fs.unlinkSync(testAudioPath)

      const responseTime = Date.now() - startTime

      this.results.push({
        service: 'OpenAI API',
        status: 'success',
        message: 'OpenAI Whisper API is working correctly',
        details: {
          availableWhisperModels: whisperModels.map(m => m.id),
          testTranscription: transcription.text,
          confidence: transcription.segments?.[0]?.avg_logprob || 'N/A'
        },
        responseTime
      })

    } catch (error: any) {
      const responseTime = Date.now() - startTime

      this.results.push({
        service: 'OpenAI API',
        status: 'error',
        message: `OpenAI API test failed: ${error.message}`,
        details: {
          errorType: error.type || 'unknown',
          errorCode: error.code || 'unknown',
          statusCode: error.status || 'unknown'
        },
        responseTime
      })
    }
  }

  private async createTestAudioFile(): Promise<string> {
    // Create a minimal WAV file for testing (1 second of silence)
    const testAudioPath = path.join(__dirname, '../../uploads/test_audio.wav')

    // Ensure uploads directory exists
    const uploadsDir = path.dirname(testAudioPath)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // WAV file header for 1 second of silence at 44.1kHz, 16-bit mono
    const sampleRate = 44100
    const duration = 1 // seconds
    const samples = sampleRate * duration
    const dataSize = samples * 2 // 16-bit = 2 bytes per sample

    const header = Buffer.alloc(44)

    // RIFF header
    header.write('RIFF', 0)
    header.writeUInt32LE(36 + dataSize, 4)
    header.write('WAVE', 8)

    // fmt chunk
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16) // chunk size
    header.writeUInt16LE(1, 20)  // audio format (PCM)
    header.writeUInt16LE(1, 22)  // channels
    header.writeUInt32LE(sampleRate, 24) // sample rate
    header.writeUInt32LE(sampleRate * 2, 28) // byte rate
    header.writeUInt16LE(2, 32)  // block align
    header.writeUInt16LE(16, 34) // bits per sample

    // data chunk
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    // Create data (silence)
    const data = Buffer.alloc(dataSize, 0)

    // Write to file
    fs.writeFileSync(testAudioPath, Buffer.concat([header, data]))

    return testAudioPath
  }

  private async testDatabaseConnection(): Promise<void> {
    const startTime = Date.now()

    try {
      const { database } = await import('../models/database')

      // Test basic connectivity
      await database.testConnection()

      const responseTime = Date.now() - startTime

      this.results.push({
        service: 'Database',
        status: 'success',
        message: 'Database connection is working correctly',
        responseTime
      })

    } catch (error: any) {
      const responseTime = Date.now() - startTime

      this.results.push({
        service: 'Database',
        status: 'error',
        message: `Database connection failed: ${error.message}`,
        details: { errorCode: error.code },
        responseTime
      })
    }
  }

  private async testRedisConnection(): Promise<void> {
    const startTime = Date.now()

    try {
      const { queueService } = await import('../services/queueService')

      // Test Redis health through queue service
      const health = await queueService.getHealthStatus()

      const responseTime = Date.now() - startTime

      this.results.push({
        service: 'Redis Queue',
        status: health.redis.status === 'healthy' ? 'success' : 'error',
        message: health.redis.status === 'healthy'
          ? 'Redis connection is working correctly'
          : `Redis connection issues: ${health.redis.error}`,
        details: health.redis,
        responseTime
      })

    } catch (error: any) {
      const responseTime = Date.now() - startTime

      this.results.push({
        service: 'Redis Queue',
        status: 'error',
        message: `Redis connection test failed: ${error.message}`,
        responseTime
      })
    }
  }

  // Helper method to check API key validity without making expensive calls
  async validateOpenAIKey(): Promise<boolean> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return false
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })

      // Simple, cheap API call to validate key
      await openai.models.list()
      return true

    } catch (error: any) {
      logger.warn('OpenAI API key validation failed', { error: error.message })
      return false
    }
  }

  // Helper method to estimate API costs
  async estimateTranscriptionCost(fileSizeBytes: number, durationSeconds: number): Promise<number> {
    // OpenAI Whisper pricing: $0.006 per minute
    const pricePerMinute = 0.006
    const durationMinutes = durationSeconds / 60
    return durationMinutes * pricePerMinute
  }
}

export const apiTester = new APITester()