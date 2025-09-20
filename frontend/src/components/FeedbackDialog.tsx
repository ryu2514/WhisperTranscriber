import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Rating,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Send, Star } from '@mui/icons-material'

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
  transcriptionId?: string
}

interface FeedbackData {
  rating: number
  accuracy: number
  usability: number
  speed: number
  comment: string
  profession: string
  useCase: string
  wouldRecommend: boolean
  allowContact: boolean
  email?: string
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open,
  onClose,
  transcriptionId,
}) => {
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    accuracy: 0,
    usability: 0,
    speed: 0,
    comment: '',
    profession: '',
    useCase: '',
    wouldRecommend: false,
    allowContact: false,
    email: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...feedback,
          transcriptionId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          onClose()
          setSubmitted(false)
          setFeedback({
            rating: 0,
            accuracy: 0,
            usability: 0,
            speed: 0,
            comment: '',
            profession: '',
            useCase: '',
            wouldRecommend: false,
            allowContact: false,
            email: '',
          })
        }, 2000)
      }
    } catch (error) {
      console.error('フィードバック送信エラー:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = feedback.rating > 0 && feedback.comment.trim().length > 0

  if (submitted) {
    return (
      <Dialog open={open} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            フィードバックをありがとうございました！
          </Alert>
          <Typography>
            いただいたご意見は、サービス改善のために活用させていただきます。
          </Typography>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        ベータテストフィードバック
        <Typography variant="body2" color="text.secondary">
          サービス改善のため、ご意見をお聞かせください
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* 総合評価 */}
        <Box sx={{ mb: 3 }}>
          <Typography component="legend" gutterBottom>
            総合評価 *
          </Typography>
          <Rating
            value={feedback.rating}
            onChange={(_, value) => setFeedback({ ...feedback, rating: value || 0 })}
            size="large"
            emptyIcon={<Star style={{ opacity: 0.55 }} fontSize="inherit" />}
          />
        </Box>

        {/* 詳細評価 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            詳細評価
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography component="legend">認識精度</Typography>
            <Rating
              value={feedback.accuracy}
              onChange={(_, value) => setFeedback({ ...feedback, accuracy: value || 0 })}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography component="legend">使いやすさ</Typography>
            <Rating
              value={feedback.usability}
              onChange={(_, value) => setFeedback({ ...feedback, usability: value || 0 })}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography component="legend">処理速度</Typography>
            <Rating
              value={feedback.speed}
              onChange={(_, value) => setFeedback({ ...feedback, speed: value || 0 })}
            />
          </Box>
        </Box>

        {/* 職業・用途 */}
        <Box sx={{ mb: 3 }}>
          <TextField
            label="ご職業"
            value={feedback.profession}
            onChange={(e) => setFeedback({ ...feedback, profession: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="例: 理学療法士、作業療法士、言語聴覚士"
          />

          <TextField
            label="主な用途"
            value={feedback.useCase}
            onChange={(e) => setFeedback({ ...feedback, useCase: e.target.value })}
            fullWidth
            placeholder="例: 患者記録、研修資料、カンファレンス記録"
          />
        </Box>

        {/* コメント */}
        <TextField
          label="ご意見・ご要望 *"
          value={feedback.comment}
          onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
          multiline
          rows={4}
          fullWidth
          sx={{ mb: 3 }}
          placeholder="改善点や追加してほしい機能があればお聞かせください"
          required
        />

        {/* 推奨度・連絡許可 */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={feedback.wouldRecommend}
                onChange={(e) => setFeedback({ ...feedback, wouldRecommend: e.target.checked })}
              />
            }
            label="同僚にこのサービスを推奨したいと思いますか？"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={feedback.allowContact}
                onChange={(e) => setFeedback({ ...feedback, allowContact: e.target.checked })}
              />
            }
            label="改善のためのフォローアップにご協力いただけますか？"
          />
        </Box>

        {feedback.allowContact && (
          <TextField
            label="メールアドレス（任意）"
            type="email"
            value={feedback.email}
            onChange={(e) => setFeedback({ ...feedback, email: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={20} /> : <Send />}
        >
          {isSubmitting ? '送信中...' : 'フィードバック送信'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}