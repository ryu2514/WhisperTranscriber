import React from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Divider,
} from '@mui/material'
import { ArrowBack, PlayArrow } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { FileUpload } from '../components/FileUpload'
import { useUploadStore } from '../store/useUploadStore'
import { ApiService } from '../services/api'

export const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    file,
    options,
    uploadStatus,
    error,
    setOptions,
    setUploadStatus,
    setUploadProgress,
    setUploadResult,
    setError,
  } = useUploadStore()

  const handleStartTranscription = async () => {
    if (!file) {
      setError('ファイルを選択してください')
      return
    }

    setUploadStatus('uploading')
    setError(null)

    try {
      const result = await ApiService.uploadFile(
        file,
        options,
        (progress) => setUploadProgress(progress)
      )

      if (result.success && result.data) {
        setUploadResult(result.data)
        setUploadStatus('completed')

        // Start transcription
        const transcriptionResult = await ApiService.startTranscription(result.data.uploadId)

        if (transcriptionResult.success && transcriptionResult.data) {
          navigate(`/processing/${transcriptionResult.data.transcriptionId}`)
        } else {
          setError(transcriptionResult.error || '文字起こし開始に失敗しました')
          setUploadStatus('error')
        }
      } else {
        setError(result.error || 'アップロードに失敗しました')
        setUploadStatus('error')
      }
    } catch (error) {
      setError('予期しないエラーが発生しました')
      setUploadStatus('error')
    }
  }

  const isUploading = uploadStatus === 'uploading'
  const canStartTranscription = file && !isUploading

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          ホームに戻る
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          音声・動画ファイルアップロード
        </Typography>
        <Typography variant="body1" color="text.secondary">
          文字起こしを行うファイルを選択し、オプションを設定してください。
        </Typography>
      </Box>

      {/* File Upload Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          ファイル選択
        </Typography>
        <FileUpload />
      </Paper>

      {/* Options Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          文字起こしオプション
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Language Selection */}
          <FormControl fullWidth>
            <InputLabel>言語設定</InputLabel>
            <Select
              value={options.language}
              label="言語設定"
              onChange={(e) => setOptions({ language: e.target.value as 'auto' | 'ja' | 'en' })}
              disabled={isUploading}
            >
              <MenuItem value="auto">自動検出</MenuItem>
              <MenuItem value="ja">日本語</MenuItem>
              <MenuItem value="en">英語</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          {/* Feature Toggles */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={options.includeTimestamps}
                  onChange={(e) => setOptions({ includeTimestamps: e.target.checked })}
                  disabled={isUploading}
                />
              }
              label="タイムスタンプを含める"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              各文章の開始・終了時間を記録します（字幕作成に便利）
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={options.speakerDetection}
                  onChange={(e) => setOptions({ speakerDetection: e.target.checked })}
                  disabled={isUploading}
                />
              }
              label="話者分離を試行（実験的機能）"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              複数人の会話を識別して分離します（精度は保証されません）
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={options.medicalTerms}
                  onChange={(e) => setOptions({ medicalTerms: e.target.checked })}
                  disabled={isUploading}
                />
              }
              label="医療・セラピー専門用語辞書を適用"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              理学療法・作業療法関連の専門用語認識を向上させます
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Processing Info */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          処理について
        </Typography>
        <Typography variant="body2">
          • 1時間の音声は約5分で文字起こし完了<br />
          • 処理中は他のページに移動しても続行されます<br />
          • ファイルは24時間後に自動削除されます<br />
          • 最大ファイルサイズ: 500MB、最大長さ: 3時間
        </Typography>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Start Button */}
      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={handleStartTranscription}
          disabled={!canStartTranscription}
          sx={{ minWidth: 200 }}
        >
          {isUploading ? '処理中...' : '文字起こし開始'}
        </Button>
      </Box>
    </Container>
  )
}