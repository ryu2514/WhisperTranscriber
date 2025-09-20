import OpenAI from 'openai'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'
import { TranscriptionSegment, TranscriptionOptions } from '../types'
import * as fs from 'fs'
import * as path from 'path'
import { createWriteStream } from 'fs'
import { promisify } from 'util'

interface WhisperResponse {
  text: string
  segments?: Array<{
    start: number
    end: number
    text: string
    no_speech_prob?: number
  }>
  language?: string
}

class WhisperService {
  private openai: OpenAI | null = null
  private medicalTerms: Map<string, string>

  constructor() {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      logger.warn('OpenAI API key not configured - WhisperService will be disabled')
    } else {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    }

    // Initialize medical terms dictionary
    this.medicalTerms = new Map([
      // 理学療法関連
      ['りがくりょうほう', '理学療法'],
      ['りがく療法', '理学療法'],
      ['さぎょうりょうほう', '作業療法'],
      ['さぎょう療法', '作業療法'],
      ['ぶつりりょうほう', '物理療法'],
      ['ぶつり療法', '物理療法'],
      ['うんどうりょうほう', '運動療法'],
      ['うんどう療法', '運動療法'],

      // 解剖学用語
      ['せんちょうかんせつ', '仙腸関節'],
      ['ようついぶんりしょう', '腰椎分離症'],
      ['けんこうこつ', '肩甲骨'],
      ['だいたいこつ', '大腿骨'],
      ['けいついこつ', '頸椎骨'],
      ['きょうつい', '胸椎'],
      ['ようつい', '腰椎'],

      // 疾患・症状
      ['へんけいせいしつかんせつしょう', '変形性膝関節症'],
      ['へんけいせいこかんせつしょう', '変形性股関節症'],
      ['かたかんせつしゅういえん', '肩関節周囲炎'],
      ['けんばんそんしょう', '腱板損傷'],
      ['おすぐっどびょう', 'オスグッド病'],
      ['あしかんせつないはんねんざ', '足関節内反捻挫'],
      ['せきちゅうかんきょうさくしょう', '脊柱管狭窄症'],

      // 評価・検査
      ['えむえむてぃー', 'MMT'],
      ['ろむ', 'ROM'],
      ['びーおーえす', 'BOS'],
      ['しーおーじー', 'COG'],
      ['えふあいえむ', 'FIM'],

      // 治療手技
      ['ぴーえぬえふ', 'PNF'],
      ['えむえふあーる', 'MFR'],
      ['じぇーえむてぃー', 'JMT'],
      ['えすえるあーる', 'SLR'],

      // 英語略語
      ['えーしーえる', 'ACL'],
      ['ぴーしーえる', 'PCL'],
      ['えむしーえる', 'MCL'],
      ['えるしーえる', 'LCL'],
    ])
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<{
    text: string
    segments?: TranscriptionSegment[]
    confidence?: number
    language?: string
  }> {
    try {
      if (!this.openai) {
        throw createError('Whisper service is not available - OpenAI API key not configured', 503, 'SERVICE_UNAVAILABLE')
      }

      logger.info('Starting Whisper API transcription', {
        bufferSize: audioBuffer.length,
        options,
      })

      // Create temporary file for Whisper API
      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      const tempFilePath = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`)

      // Write buffer to temporary file
      await promisify(fs.writeFile)(tempFilePath, audioBuffer)

      try {
        // Prepare Whisper API request
        const transcriptionRequest: any = {
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          temperature: 0.2, // Lower temperature for more consistent output
          response_format: options.includeTimestamps ? 'verbose_json' : 'json',
        }

        // Set language if not auto-detect
        if (options.language !== 'auto') {
          transcriptionRequest.language = options.language
        }

        // Add prompt for better recognition of medical terms (if enabled)
        if (options.medicalTerms) {
          transcriptionRequest.prompt = this.getMedicalTermsPrompt()
        }

        logger.debug('Sending request to Whisper API', transcriptionRequest)

        // Call Whisper API
        const response = await this.openai!.audio.transcriptions.create(transcriptionRequest)

        logger.info('Whisper API transcription completed', {
          textLength: response.text?.length || 0,
          hasSegments: 'segments' in response,
        })

        // Process the response
        let processedText = response.text
        let segments: TranscriptionSegment[] | undefined

        // Apply medical terms correction if enabled
        if (options.medicalTerms) {
          processedText = this.correctMedicalTerms(processedText)
        }

        // Process segments if available
        if ('segments' in response && Array.isArray(response.segments)) {
          segments = response.segments.map((segment: any) => ({
            start: segment.start,
            end: segment.end,
            text: options.medicalTerms ? this.correctMedicalTerms(segment.text) : segment.text,
            speaker: options.speakerDetection ? this.detectSpeaker(segment) : undefined,
          }))

          // If medical terms correction was applied, reconstruct full text from segments
          if (options.medicalTerms && segments) {
            processedText = segments.map(s => s.text).join(' ')
          }
        }

        // Calculate average confidence if segments are available
        let confidence: number | undefined
        if ('segments' in response && Array.isArray(response.segments)) {
          const confidenceScores = response.segments
            .map((s: any) => 1 - (s.no_speech_prob || 0))
            .filter((score: number) => !isNaN(score))

          if (confidenceScores.length > 0) {
            confidence = confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length
          }
        }

        return {
          text: processedText,
          segments,
          confidence,
          language: ('language' in response && typeof response.language === 'string') ? response.language : options.language,
        }

      } finally {
        // Clean up temporary file
        try {
          await promisify(fs.unlink)(tempFilePath)
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary file', { tempFilePath, error: cleanupError })
        }
      }

    } catch (error) {
      logger.error('Whisper API transcription failed', error)

      if (error instanceof Error) {
        // Handle specific OpenAI errors
        if (error.message.includes('rate limit')) {
          throw createError('API rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
        }
        if (error.message.includes('quota')) {
          throw createError('API quota exceeded. Please contact support.', 402, 'QUOTA_EXCEEDED')
        }
        if (error.message.includes('file format')) {
          throw createError('Unsupported audio format for transcription.', 400, 'UNSUPPORTED_FORMAT')
        }
      }

      throw createError('Audio transcription failed', 500, 'WHISPER_API_ERROR')
    }
  }

  private getMedicalTermsPrompt(): string {
    // Create a prompt that includes common medical terms to improve recognition
    const commonTerms = [
      '理学療法', '作業療法', '運動療法', '物理療法',
      '仙腸関節', '腰椎分離症', '肩甲骨', '変形性膝関節症',
      '変形性股関節症', '肩関節周囲炎', '腱板損傷', 'オスグッド病',
      '足関節内反捻挫', '脊柱管狭窄症', 'ACL', 'PCL', 'MCL', 'LCL',
      'MMT', 'ROM', 'PNF', 'MFR', 'JMT', 'SLR'
    ]

    return `この音声は理学療法・作業療法・リハビリテーション医学に関する内容です。以下の専門用語が含まれる可能性があります: ${commonTerms.join(', ')}`
  }

  private correctMedicalTerms(text: string): string {
    let correctedText = text

    // Apply medical terms corrections
    for (const [incorrect, correct] of this.medicalTerms) {
      const regex = new RegExp(incorrect, 'gi')
      correctedText = correctedText.replace(regex, correct)
    }

    // Additional post-processing for common misrecognitions
    correctedText = correctedText
      // Fix common number misrecognitions
      .replace(/(\d+)\s*度/g, '$1度')
      .replace(/(\d+)\s*回/g, '$1回')
      .replace(/(\d+)\s*セット/g, '$1セット')
      // Fix common anatomical term patterns
      .replace(/左\s+(\w+)/g, '左$1')
      .replace(/右\s+(\w+)/g, '右$1')
      // Fix exercise terminology
      .replace(/ストレッチング/g, 'ストレッチ')
      .replace(/エクササイズ/g, 'エクササイズ')

    return correctedText
  }

  private detectSpeaker(segment: any): string | undefined {
    // Simple speaker detection based on audio characteristics
    // In a real implementation, this would use more sophisticated techniques
    // For now, we'll use a simple heuristic based on timing and speech patterns

    // If there's a significant pause before this segment, it might be a new speaker
    const pauseThreshold = 2.0 // seconds

    if (segment.start > pauseThreshold) {
      // Check for speaking patterns that might indicate different speakers
      if (segment.text.includes('質問') || segment.text.includes('お聞きしたい')) {
        return '質問者'
      }
      if (segment.text.includes('はい') || segment.text.includes('そうですね')) {
        return '回答者'
      }
    }

    return undefined
  }

  // Method to test API connectivity
  async testConnection(): Promise<boolean> {
    try {
      // Create a minimal test file (1 second of silence)
      const testBuffer = Buffer.alloc(44100 * 2) // 1 second of 16-bit silence at 44.1kHz

      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      const testFilePath = path.join(tempDir, 'test_whisper_connection.wav')

      // Create a minimal WAV file header + data
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x08, 0x00, 0x00, // File size - 8
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6D, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Subchunk1Size
        0x01, 0x00,             // AudioFormat
        0x01, 0x00,             // NumChannels
        0x44, 0xAC, 0x00, 0x00, // SampleRate
        0x88, 0x58, 0x01, 0x00, // ByteRate
        0x02, 0x00,             // BlockAlign
        0x10, 0x00,             // BitsPerSample
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x08, 0x00, 0x00  // Subchunk2Size
      ])

      const wavFile = Buffer.concat([wavHeader, testBuffer])
      await promisify(fs.writeFile)(testFilePath, wavFile)

      try {
        await this.openai!.audio.transcriptions.create({
          file: fs.createReadStream(testFilePath),
          model: 'whisper-1',
        })

        return true
      } finally {
        await promisify(fs.unlink)(testFilePath)
      }
    } catch (error) {
      logger.error('Whisper API connection test failed', error)
      return false
    }
  }
}

export const whisperService = new WhisperService()