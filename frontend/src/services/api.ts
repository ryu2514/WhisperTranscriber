import axios from 'axios'
import type { ApiResponse, UploadResult, TranscriptionOptions, ProcessingStatus, TranscriptionResult } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for large file uploads
})

export class ApiService {
  static async uploadFile(
    file: File,
    options: TranscriptionOptions,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<UploadResult>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', options.language)
    formData.append('includeTimestamps', options.includeTimestamps.toString())
    formData.append('speakerDetection', options.speakerDetection.toString())
    formData.append('medicalTerms', options.medicalTerms.toString())

    try {
      const response = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(progress)
          }
        },
      })

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || 'アップロードに失敗しました',
        }
      }
      return {
        success: false,
        error: 'ネットワークエラーが発生しました',
      }
    }
  }

  static async startTranscription(uploadId: string): Promise<ApiResponse<{ transcriptionId: string }>> {
    try {
      const response = await api.post(`/api/transcribe/${uploadId}`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || '文字起こし開始に失敗しました',
        }
      }
      return {
        success: false,
        error: 'ネットワークエラーが発生しました',
      }
    }
  }

  static async getTranscriptionStatus(transcriptionId: string): Promise<ApiResponse<ProcessingStatus>> {
    try {
      const response = await api.get(`/api/transcribe/${transcriptionId}/status`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || '状況確認に失敗しました',
        }
      }
      return {
        success: false,
        error: 'ネットワークエラーが発生しました',
      }
    }
  }

  static async getTranscriptionResult(transcriptionId: string): Promise<ApiResponse<TranscriptionResult>> {
    try {
      const response = await api.get(`/api/transcribe/${transcriptionId}/result`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || '結果取得に失敗しました',
        }
      }
      return {
        success: false,
        error: 'ネットワークエラーが発生しました',
      }
    }
  }

  static async exportResult(
    transcriptionId: string,
    format: 'text' | 'srt' | 'vtt' | 'json' | 'markdown'
  ): Promise<ApiResponse<{ content: string; downloadUrl?: string }>> {
    try {
      const response = await api.get(`/api/transcribe/${transcriptionId}/result?format=${format}`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || 'エクスポートに失敗しました',
        }
      }
      return {
        success: false,
        error: 'ネットワークエラーが発生しました',
      }
    }
  }
}