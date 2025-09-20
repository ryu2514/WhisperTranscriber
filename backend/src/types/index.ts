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

export interface DatabaseUpload {
  id: string
  filename: string
  original_name: string
  file_size: number
  mime_type: string
  s3_key: string
  duration: number | null
  uploaded_at: Date
  expires_at: Date
  ip_address: string | null
  user_agent: string | null
}

export interface DatabaseTranscription {
  id: string
  upload_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  language?: string
  options: TranscriptionOptions
  result?: TranscriptionResult
  confidence?: number
  processing_time?: number
  error_message?: string
  created_at: Date
  completed_at?: Date
}

export interface JobData {
  transcriptionId: string
  uploadId: string
  s3Key: string
  options: TranscriptionOptions
}

export interface JobResult {
  success: boolean
  transcription?: {
    text: string
    segments?: TranscriptionSegment[]
    confidence?: number
  }
  error?: string
}