import React from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  ErrorOutline,
  Home,
  Refresh,
  Help,
  CheckCircle,
  Email,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'

interface ErrorState {
  error?: string
  code?: string
}

export const ErrorPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ErrorState | null

  const errorMessage = state?.error || '予期しないエラーが発生しました'
  const errorCode = state?.code

  const getErrorSolutions = (code?: string): string[] => {
    switch (code) {
      case 'FILE_TOO_LARGE':
        return [
          'ファイルを500MB以下に圧縮してください',
          '動画の場合は音声のみを抽出してください',
          '複数の短いファイルに分割してください',
        ]
      case 'UNSUPPORTED_FORMAT':
        return [
          '対応形式（MP3, WAV, M4A, MP4, MOV, AVI）に変換してください',
          'ファイルが破損していないか確認してください',
        ]
      case 'PROCESSING_FAILED':
        return [
          '音声の品質を確認してください（ノイズが多すぎる場合）',
          'ファイルが破損していないか確認してください',
          '時間をおいて再試行してください',
        ]
      case 'WHISPER_API_ERROR':
        return [
          'しばらく時間をおいて再試行してください',
          'ファイルサイズを小さくしてみてください',
          'ネットワーク接続を確認してください',
        ]
      case 'RATE_LIMIT_EXCEEDED':
        return [
          '15分後に再試行してください',
          '一度に多くのファイルを処理している場合は時間をあけてください',
        ]
      default:
        return [
          'ページを再読み込みしてください',
          'ファイルサイズと形式を確認してください',
          'ネットワーク接続を確認してください',
          '時間をおいて再試行してください',
        ]
    }
  }

  const solutions = getErrorSolutions(errorCode)

  const getErrorTitle = (code?: string): string => {
    switch (code) {
      case 'FILE_TOO_LARGE':
        return 'ファイルサイズが大きすぎます'
      case 'UNSUPPORTED_FORMAT':
        return 'サポートされていないファイル形式です'
      case 'PROCESSING_FAILED':
        return '処理中にエラーが発生しました'
      case 'WHISPER_API_ERROR':
        return 'AI処理サービスでエラーが発生しました'
      case 'RATE_LIMIT_EXCEEDED':
        return 'リクエスト制限に達しました'
      default:
        return 'エラーが発生しました'
    }
  }

  const handleRetry = () => {
    navigate('/upload')
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          {getErrorTitle(errorCode)}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          申し訳ございませんが、問題が発生しました
        </Typography>
      </Box>

      {/* Error Details */}
      <Alert severity="error" sx={{ mb: 3 }}>
        <Typography variant="body1" gutterBottom>
          {errorMessage}
        </Typography>
        {errorCode && (
          <Typography variant="caption" color="text.secondary">
            エラーコード: {errorCode}
          </Typography>
        )}
      </Alert>

      {/* Solutions */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          💡 解決方法
        </Typography>
        <List>
          {solutions.map((solution, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary={solution} />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Supported Formats Info */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          📋 対応ファイル形式・制限
        </Typography>
        <Typography variant="body2">
          <strong>対応形式:</strong> MP3, WAV, M4A, FLAC (音声) / MP4, MOV, AVI (動画)<br />
          <strong>最大サイズ:</strong> 500MB<br />
          <strong>最大長さ:</strong> 3時間<br />
          <strong>推奨品質:</strong> 明瞭な音声、ノイズが少ない音源
        </Typography>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRetry}
          size="large"
        >
          もう一度試す
        </Button>
        <Button
          variant="outlined"
          startIcon={<Home />}
          onClick={handleGoHome}
          size="large"
        >
          ホームに戻る
        </Button>
        <Button
          variant="outlined"
          startIcon={<Help />}
          href="#help"
          size="large"
        >
          ヘルプを見る
        </Button>
      </Box>

      {/* Help Section */}
      <Paper sx={{ p: 3, mt: 4 }} id="help">
        <Typography variant="h6" gutterBottom>
          🆘 それでも解決しない場合
        </Typography>
        <Typography variant="body2" paragraph>
          上記の解決方法を試しても問題が解決しない場合は、以下の方法でお問い合わせください：
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Email color="primary" />
          <Typography variant="body2">
            <strong>メール:</strong> support@example.com
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          お問い合わせの際は、エラーメッセージとエラーコード（表示されている場合）をお知らせください。
        </Typography>
      </Paper>

      {/* Usage Stats */}
      <Paper sx={{ p: 3, mt: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary">
          WhisperTranscriberは完全無料のサービスです。<br />
          セラピスト・医療従事者の学習をサポートすることを目的としています。
        </Typography>
      </Paper>
    </Container>
  )
}