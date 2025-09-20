import { Router, Request, Response } from 'express'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { validateRequest, sanitizeInput, detectSQLInjection } from '../middleware/validation'
import { logger } from '../utils/logger'

const router = Router()

// Apply security middleware
router.use(validateRequest)
router.use(sanitizeInput)
router.use(detectSQLInjection)

interface ErrorReport {
  message: string
  stack?: string
  componentStack?: string
  timestamp: string
  userAgent: string
  url: string
}

// フロントエンドエラー報告
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const errorData: ErrorReport = req.body

  // バリデーション
  if (!errorData.message || typeof errorData.message !== 'string') {
    throw createError('エラーメッセージは必須です', 400, 'MESSAGE_REQUIRED')
  }

  if (errorData.message.length > 1000) {
    throw createError('エラーメッセージが長すぎます', 400, 'MESSAGE_TOO_LONG')
  }

  if (!errorData.timestamp) {
    throw createError('タイムスタンプは必須です', 400, 'TIMESTAMP_REQUIRED')
  }

  // エラーレベルの判定
  let errorLevel = 'error'
  const message = errorData.message.toLowerCase()

  if (message.includes('network') || message.includes('fetch')) {
    errorLevel = 'warn'
  } else if (message.includes('timeout')) {
    errorLevel = 'warn'
  } else if (message.includes('permission') || message.includes('unauthorized')) {
    errorLevel = 'error'
  } else if (message.includes('chunk') || message.includes('loading')) {
    errorLevel = 'warn'
  }

  // ログに記録
  logger[errorLevel as keyof typeof logger]('Frontend error reported', {
    message: errorData.message,
    stack: errorData.stack,
    componentStack: errorData.componentStack,
    timestamp: errorData.timestamp,
    userAgent: errorData.userAgent,
    url: errorData.url,
    ip: req.ip,
  })

  // 緊急度の高いエラーの場合は特別な処理
  if (errorLevel === 'error' && (
    message.includes('security') ||
    message.includes('malicious') ||
    message.includes('injection')
  )) {
    logger.error('SECURITY ALERT: Potential security threat detected', {
      errorData,
      ip: req.ip,
      headers: req.headers,
    })
  }

  res.json({
    success: true,
    message: 'エラーレポートを受け付けました',
  })
}))

// エラー統計取得（管理者用）
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  // 本来はデータベースから統計を取得
  // 簡易版としてログファイルベースの対応
  const stats = {
    totalErrors: 0,
    errorsByType: {},
    recentErrors: [],
    timestamp: new Date().toISOString(),
  }

  res.json({
    success: true,
    data: stats,
  })
}))

export default router