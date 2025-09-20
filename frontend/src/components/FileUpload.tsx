import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material'
import {
  CloudUpload,
  AudioFile,
  VideoFile,
  InsertDriveFile,
} from '@mui/icons-material'
import { useUploadStore } from '../store/useUploadStore'

interface FileUploadProps {
  onUploadComplete?: () => void
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete: _onUploadComplete }) => {
  const {
    file,
    uploadProgress,
    uploadStatus,
    error,
    setFile,
    setError,
  } = useUploadStore()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0]
    if (!uploadedFile) return

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024
    if (uploadedFile.size > maxSize) {
      setError('ファイルサイズが大きすぎます。500MB以下のファイルを選択してください。')
      return
    }

    setFile(uploadedFile)
    setError(null)
  }, [setFile, setError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac'],
      'video/*': ['.mp4', '.mov', '.avi'],
    },
    maxFiles: 1,
    disabled: uploadStatus === 'uploading',
  })

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('audio/')) {
      return <AudioFile sx={{ fontSize: 48, color: 'primary.main' }} />
    } else if (file.type.startsWith('video/')) {
      return <VideoFile sx={{ fontSize: 48, color: 'primary.main' }} />
    }
    return <InsertDriveFile sx={{ fontSize: 48, color: 'primary.main' }} />
  }

  const removeFile = () => {
    setFile(null)
    setError(null)
  }

  return (
    <Box>
      {!file ? (
        <Paper
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 6,
            textAlign: 'center',
            cursor: uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.2s ease',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            '&:hover': {
              borderColor: uploadStatus === 'uploading' ? 'grey.300' : 'primary.main',
              backgroundColor: uploadStatus === 'uploading' ? 'background.paper' : 'action.hover',
            },
          }}
          elevation={0}
        >
          <input {...getInputProps()} />

          {uploadStatus === 'uploading' ? (
            <CircularProgress size={48} />
          ) : (
            <CloudUpload sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          )}

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            {uploadStatus === 'uploading'
              ? 'アップロード中...'
              : isDragActive
              ? 'ファイルをここにドロップ'
              : '音声・動画ファイルをここにドロップ'
            }
          </Typography>

          {uploadStatus !== 'uploading' && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                または、クリックしてファイルを選択
              </Typography>
              <Typography variant="caption" color="text.secondary">
                対応形式: MP3, WAV, M4A, MP4, MOV, AVI (最大500MB, 3時間)
              </Typography>
            </>
          )}
        </Paper>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {getFileIcon(file)}
            <Box sx={{ ml: 2, flexGrow: 1 }}>
              <Typography variant="h6">{file.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(file.size)}
              </Typography>
            </Box>
            {uploadStatus !== 'uploading' && (
              <Button onClick={removeFile} color="error">
                削除
              </Button>
            )}
          </Box>

          {uploadStatus === 'uploading' && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                アップロード中... {uploadProgress}%
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  )
}