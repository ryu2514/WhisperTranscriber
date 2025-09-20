export interface UploadResult {
  uploadId: string
  filename: string
  fileSize: number
  duration?: number
  status: 'uploaded'
}

export interface TranscriptionOptions {
  language: 'auto' | 'ja' | 'en'
  includeTimestamps: boolean
  speakerDetection: boolean
  medicalTerms: boolean
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface TranscriptionResult {
  transcriptionId: string
  text: string
  segments?: TranscriptionSegment[]
  confidence?: number
  status: 'processing' | 'completed' | 'failed'
  progress: number
  estimatedTime?: number
  filename: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export type ExportFormat = 'text' | 'srt' | 'vtt' | 'json' | 'markdown'

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'failed'
  progress: number
  estimatedTime?: number
  currentStage?: string
  error?: string
}