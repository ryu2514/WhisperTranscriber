import React, { useEffect, useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  Alert,
  TextField,
  Divider,
  Menu,
  MenuItem,
  IconButton,
  Snackbar,
} from '@mui/material'
import {
  ArrowBack,
  Edit,
  Save,
  MoreVert,
  ContentCopy,
} from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { ApiService } from '../services/api'
import { FeedbackDialog } from '../components/FeedbackDialog'
import type { TranscriptionResult, ExportFormat } from '../types'

export const ResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    if (!id) {
      navigate('/upload')
      return
    }

    fetchResult()
  }, [id])

  const fetchResult = async () => {
    if (!id) return

    try {
      setLoading(true)
      const response = await ApiService.getTranscriptionResult(id)

      if (response.success && response.data) {
        setResult(response.data)
        setEditedText(response.data.text)
        setError(null)
      } else {
        setError(response.error || '結果の取得に失敗しました')
      }
    } catch (error) {
      setError('ネットワークエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = () => {
    if (result) {
      setResult({ ...result, text: editedText })
    }
    setEditMode(false)
    showSnackbar('編集内容を保存しました')
  }

  const handleCancelEdit = () => {
    if (result) {
      setEditedText(result.text)
    }
    setEditMode(false)
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editedText)
      showSnackbar('テキストをクリップボードにコピーしました')
    } catch (error) {
      showSnackbar('コピーに失敗しました')
    }
  }

  const handleExport = async (format: ExportFormat) => {
    if (!id) return

    try {
      const response = await ApiService.exportResult(id, format)

      if (response.success && response.data) {
        // Create download link
        const blob = new Blob([response.data.content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url

        const extensions = {
          text: 'txt',
          srt: 'srt',
          vtt: 'vtt',
          json: 'json',
          markdown: 'md'
        }

        link.download = `transcription.${extensions[format]}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        showSnackbar(`${format.toUpperCase()}形式でダウンロードしました`)
      } else {
        showSnackbar('エクスポートに失敗しました')
      }
    } catch (error) {
      showSnackbar('エクスポートエラーが発生しました')
    }

    setAnchorEl(null)
  }

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message)
    setSnackbarOpen(true)
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6">結果を読み込み中...</Typography>
      </Container>
    )
  }

  if (error || !result) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || '結果が見つかりませんでした'}
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/upload')}
        >
          新しい文字起こし
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/upload')}
          sx={{ mb: 2 }}
        >
          新しい文字起こし
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          文字起こし結果
        </Typography>
      </Box>

      {/* Result Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              📄 {result.filename}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {result.confidence && (
                <Chip
                  label={`精度: ${Math.round(result.confidence * 100)}%`}
                  color="success"
                  size="small"
                />
              )}
              <Chip
                label={`文字数: ${editedText.length}`}
                color="info"
                size="small"
              />
              <Chip
                label="処理完了"
                color="primary"
                size="small"
              />
            </Box>
          </Box>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVert />
          </IconButton>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            startIcon={editMode ? <Save /> : <Edit />}
            onClick={editMode ? handleSaveEdit : () => setEditMode(true)}
            variant={editMode ? 'contained' : 'outlined'}
          >
            {editMode ? '保存' : '編集'}
          </Button>

          {editMode && (
            <Button onClick={handleCancelEdit}>
              キャンセル
            </Button>
          )}

          <Button
            startIcon={<ContentCopy />}
            onClick={handleCopyText}
          >
            コピー
          </Button>
        </Box>
      </Paper>

      {/* Transcription Text */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          文字起こしテキスト
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {editMode ? (
          <TextField
            multiline
            fullWidth
            rows={15}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            placeholder="文字起こし結果を編集してください..."
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              },
            }}
          />
        ) : (
          <Box
            sx={{
              minHeight: 300,
              maxHeight: 500,
              overflow: 'auto',
              bgcolor: 'grey.50',
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <Typography
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '0.95rem',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {editedText}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Segments Display (if available) */}
      {result.segments && result.segments.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            タイムスタンプ付きセグメント
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {result.segments.map((segment, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                  {formatTime(segment.start)} - {formatTime(segment.end)}
                  {segment.speaker && ` | 話者: ${segment.speaker}`}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {segment.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Export Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleExport('text')}>
          📄 テキストファイル (.txt)
        </MenuItem>
        <MenuItem onClick={() => handleExport('srt')}>
          🎬 SRT字幕ファイル (.srt)
        </MenuItem>
        <MenuItem onClick={() => handleExport('vtt')}>
          📺 WebVTT字幕ファイル (.vtt)
        </MenuItem>
        <MenuItem onClick={() => handleExport('markdown')}>
          📝 マークダウンファイル (.md)
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          📊 JSONファイル (.json)
        </MenuItem>
      </Menu>

      {/* Feedback Section */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          サービス改善にご協力ください
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          ベータテスト中のため、皆様のフィードバックが非常に重要です
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setFeedbackOpen(true)}
          sx={{ mb: 3 }}
        >
          📝 フィードバックを送信
        </Button>
      </Box>

      {/* Feedback Dialog */}
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        transcriptionId={id}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  )
}