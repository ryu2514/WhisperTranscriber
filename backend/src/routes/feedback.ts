import { Router, Request, Response } from 'express'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { validateFeedback, sanitizeInput, detectSQLInjection, validateRequest } from '../middleware/validation'
import { database } from '../models/database'
import { logger } from '../utils/logger'

const router = Router()

// Apply security middleware
router.use(validateRequest)
router.use(sanitizeInput)
router.use(detectSQLInjection)

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
  transcriptionId?: string
  timestamp: string
  userAgent: string
}

// フィードバック送信
router.post('/', validateFeedback, asyncHandler(async (req: Request, res: Response) => {
  const feedbackData: FeedbackData = req.body

  // バリデーション
  if (!feedbackData.rating || feedbackData.rating < 1 || feedbackData.rating > 5) {
    throw createError('評価は1-5の範囲で入力してください', 400, 'INVALID_RATING')
  }

  if (!feedbackData.comment || feedbackData.comment.trim().length === 0) {
    throw createError('コメントは必須です', 400, 'COMMENT_REQUIRED')
  }

  if (feedbackData.comment.length > 2000) {
    throw createError('コメントは2000文字以内で入力してください', 400, 'COMMENT_TOO_LONG')
  }

  try {
    // フィードバックをデータベースに保存
    const feedback = await database.saveFeedback({
      rating: feedbackData.rating,
      accuracy: feedbackData.accuracy || null,
      usability: feedbackData.usability || null,
      speed: feedbackData.speed || null,
      comment: feedbackData.comment.trim(),
      profession: feedbackData.profession?.trim() || null,
      use_case: feedbackData.useCase?.trim() || null,
      would_recommend: feedbackData.wouldRecommend || false,
      allow_contact: feedbackData.allowContact || false,
      email: feedbackData.allowContact ? feedbackData.email?.trim() || null : null,
      transcription_id: feedbackData.transcriptionId || null,
      user_agent: feedbackData.userAgent || null,
      ip_address: req.ip || null,
      created_at: new Date(feedbackData.timestamp),
    })

    logger.info('Feedback received', {
      feedbackId: feedback.id,
      rating: feedbackData.rating,
      profession: feedbackData.profession,
      transcriptionId: feedbackData.transcriptionId,
    })

    res.json({
      success: true,
      message: 'フィードバックを受け付けました',
      data: {
        id: feedback.id,
      },
    })
  } catch (error) {
    logger.error('Failed to save feedback:', error)
    throw createError('フィードバックの保存に失敗しました', 500, 'FEEDBACK_SAVE_ERROR')
  }
}))

// フィードバック統計取得（管理者用）
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await database.getFeedbackStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error('Failed to get feedback stats:', error)
    throw createError('統計の取得に失敗しました', 500, 'STATS_ERROR')
  }
}))

// 最近のフィードバック取得（管理者用）
router.get('/recent', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  if (limit > 100) {
    throw createError('取得件数は100件以下にしてください', 400, 'LIMIT_TOO_LARGE')
  }

  try {
    const feedbacks = await database.getRecentFeedback(limit, offset)

    res.json({
      success: true,
      data: feedbacks,
    })
  } catch (error) {
    logger.error('Failed to get recent feedback:', error)
    throw createError('フィードバックの取得に失敗しました', 500, 'FEEDBACK_ERROR')
  }
}))

export default router