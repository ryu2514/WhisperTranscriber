import { create } from 'zustand'
import type { TranscriptionOptions, UploadResult, TranscriptionResult } from '../types'

interface UploadState {
  // Upload state
  file: File | null
  uploadProgress: number
  uploadStatus: 'idle' | 'uploading' | 'completed' | 'error'
  uploadResult: UploadResult | null

  // Options state
  options: TranscriptionOptions

  // Transcription state
  transcriptionResult: TranscriptionResult | null

  // Error state
  error: string | null

  // Actions
  setFile: (file: File | null) => void
  setUploadProgress: (progress: number) => void
  setUploadStatus: (status: 'idle' | 'uploading' | 'completed' | 'error') => void
  setUploadResult: (result: UploadResult | null) => void
  setOptions: (options: Partial<TranscriptionOptions>) => void
  setTranscriptionResult: (result: TranscriptionResult | null) => void
  setError: (error: string | null) => void
  resetUpload: () => void
}

export const useUploadStore = create<UploadState>((set) => ({
  // Initial state
  file: null,
  uploadProgress: 0,
  uploadStatus: 'idle',
  uploadResult: null,
  options: {
    language: 'auto',
    includeTimestamps: true,
    speakerDetection: false,
    medicalTerms: true,
  },
  transcriptionResult: null,
  error: null,

  // Actions
  setFile: (file) => set({ file }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setUploadStatus: (status) => set({ uploadStatus: status }),
  setUploadResult: (result) => set({ uploadResult: result }),
  setOptions: (newOptions) =>
    set((state) => ({
      options: { ...state.options, ...newOptions }
    })),
  setTranscriptionResult: (result) => set({ transcriptionResult: result }),
  setError: (error) => set({ error }),
  resetUpload: () => set({
    file: null,
    uploadProgress: 0,
    uploadStatus: 'idle',
    uploadResult: null,
    transcriptionResult: null,
    error: null,
  }),
}))