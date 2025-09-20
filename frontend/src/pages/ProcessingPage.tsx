import React, { useEffect, useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  LinearProgress,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  CheckCircle,
  RadioButtonUnchecked,
  Refresh,
  Home,
  Cancel,
} from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { ApiService } from '../services/api'
import type { ProcessingStatus } from '../types'

const processingStages = [
  { key: 'uploaded', label: 'ファイルアップロード完了' },
  { key: 'preprocessing', label: '音声前処理中' },
  { key: 'transcribing', label: 'Whisper API処理中' },
  { key: 'postprocessing', label: '結果後処理中' },
  { key: 'completed', label: '処理完了' },
]

export const ProcessingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(true)

  const pollStatus = async () => {
    if (!id) return

    try {
      const response = await ApiService.getTranscriptionStatus(id)

      if (response.success && response.data) {
        setStatus(response.data)
        setError(null)

        if (response.data.status === 'completed') {
          setIsPolling(false)
          navigate(`/result/${id}`)
        } else if (response.data.status === 'failed') {
          setIsPolling(false)
          setError(response.data.error || '処理中にエラーが発生しました')
        }
      } else {
        setError(response.error || 'ステータス取得に失敗しました')
      }
    } catch (error) {
      setError('ネットワークエラーが発生しました')
    }
  }

  useEffect(() => {
    if (!id) {
      navigate('/upload')
      return
    }

    pollStatus()

    const interval = setInterval(() => {
      if (isPolling) {
        pollStatus()
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [id, isPolling])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}分${remainingSeconds}秒`
  }

  const getCurrentStageIndex = (): number => {
    if (!status) return 0

    if (status.progress <= 10) return 1 // preprocessing
    if (status.progress <= 80) return 2 // transcribing
    if (status.progress < 100) return 3 // postprocessing
    return 4 // completed
  }

  const handleRetry = () => {
    setError(null)
    setIsPolling(true)
    pollStatus()
  }

  if (!id) {
    return null
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<Home />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          ホームに戻る
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          音声文字起こし処理中
        </Typography>
        <Typography variant="body1" color="text.secondary">
          AI（Whisper）が音声を解析して文字起こしを行っています。
        </Typography>
      </Box>

      {error ? (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              再試行
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <>
          {/* Progress Section */}
          <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
            <CircularProgress
              variant="determinate"
              value={status?.progress || 0}
              size={80}
              thickness={4}
              sx={{ mb: 2 }}
            />
            <Typography variant="h3" color="primary" gutterBottom>
              {status?.progress || 0}%
            </Typography>
            <Typography variant="h6" gutterBottom>
              🔄 音声を文字起こし中...
            </Typography>

            {status?.estimatedTime && (
              <Typography variant="body2" color="text.secondary">
                推定残り時間: あと{formatTime(status.estimatedTime)}
              </Typography>
            )}
          </Paper>

          {/* Detailed Progress Bar */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              処理進捗
            </Typography>
            <LinearProgress
              variant="determinate"
              value={status?.progress || 0}
              sx={{ height: 8, borderRadius: 4, mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              {status?.progress || 0}% 完了
            </Typography>
          </Paper>

          {/* Processing Stages */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              現在の処理段階
            </Typography>
            <List>
              {processingStages.map((stage, index) => {
                const currentStage = getCurrentStageIndex()
                const isCompleted = index < currentStage
                const isCurrent = index === currentStage

                return (
                  <ListItem key={stage.key}>
                    <ListItemIcon>
                      {isCompleted ? (
                        <CheckCircle color="success" />
                      ) : isCurrent ? (
                        <CircularProgress size={24} />
                      ) : (
                        <RadioButtonUnchecked color="disabled" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={stage.label}
                      sx={{
                        color: isCompleted
                          ? 'success.main'
                          : isCurrent
                          ? 'primary.main'
                          : 'text.disabled'
                      }}
                    />
                  </ListItem>
                )
              })}
            </List>
          </Paper>

          {/* Tips Section */}
          <Paper sx={{ p: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
            <Typography variant="h6" gutterBottom>
              💡 処理中のヒント
            </Typography>
            <Typography variant="body2">
              • この画面を閉じても処理は継続されます<br />
              • 処理完了後、結果画面に自動遷移します<br />
              • 長時間の音声ファイルは処理に時間がかかる場合があります<br />
              • この間にコーヒーでも飲んでお待ちください ☕
            </Typography>
          </Paper>
        </>
      )}

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button
          startIcon={<Refresh />}
          onClick={pollStatus}
          disabled={!isPolling}
        >
          状況更新
        </Button>
        <Button
          startIcon={<Cancel />}
          onClick={() => navigate('/upload')}
          color="secondary"
        >
          新しい文字起こし
        </Button>
      </Box>
    </Container>
  )
}