import { Request, Response, NextFunction } from 'express'
import { createError } from './errorHandler'

// ファイルアップロードバリデーション
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const file = req.file

  if (!file) {
    throw createError('ファイルが選択されていません', 400, 'FILE_REQUIRED')
  }

  // ファイルサイズチェック（500MB）
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '524288000')
  if (file.size > maxSize) {
    throw createError(`ファイルサイズが制限を超えています（最大${Math.round(maxSize / 1024 / 1024)}MB）`, 400, 'FILE_TOO_LARGE')
  }

  // MIMEタイプチェック
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/webm',
    'audio/ogg',
    'video/mp4',
    'video/webm'
  ]

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw createError('サポートされていないファイル形式です', 400, 'INVALID_FILE_TYPE')
  }

  // ファイル名の検証
  const filename = file.originalname
  if (!/^[\w\-. ]+\.(mp3|wav|m4a|mp4|webm|ogg)$/i.test(filename)) {
    throw createError('ファイル名に無効な文字が含まれています', 400, 'INVALID_FILENAME')
  }

  next()
}

// 文字起こしオプションバリデーション
export const validateTranscriptionOptions = (req: Request, res: Response, next: NextFunction) => {
  const { language, includeTimestamps, speakerDetection, medicalTerms } = req.body

  // 言語チェック
  if (language && !['auto', 'ja', 'en'].includes(language)) {
    throw createError('無効な言語設定です', 400, 'INVALID_LANGUAGE')
  }

  // ブール値チェック
  if (includeTimestamps !== undefined && typeof includeTimestamps !== 'boolean') {
    throw createError('タイムスタンプ設定は真偽値である必要があります', 400, 'INVALID_TIMESTAMPS')
  }

  if (speakerDetection !== undefined && typeof speakerDetection !== 'boolean') {
    throw createError('話者検出設定は真偽値である必要があります', 400, 'INVALID_SPEAKER_DETECTION')
  }

  if (medicalTerms !== undefined && typeof medicalTerms !== 'boolean') {
    throw createError('医療用語設定は真偽値である必要があります', 400, 'INVALID_MEDICAL_TERMS')
  }

  next()
}

// フィードバックバリデーション
export const validateFeedback = (req: Request, res: Response, next: NextFunction) => {
  const { rating, accuracy, usability, speed, comment, profession, useCase, email } = req.body

  // 評価値チェック
  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw createError('評価は1-5の数値である必要があります', 400, 'INVALID_RATING')
  }

  // 詳細評価チェック
  const detailRatings = { accuracy, usability, speed }
  for (const [key, value] of Object.entries(detailRatings)) {
    if (value !== undefined && (typeof value !== 'number' || value < 1 || value > 5)) {
      throw createError(`${key}の評価は1-5の数値である必要があります`, 400, 'INVALID_DETAIL_RATING')
    }
  }

  // コメントチェック
  if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
    throw createError('コメントは必須です', 400, 'COMMENT_REQUIRED')
  }

  if (comment.length > 2000) {
    throw createError('コメントは2000文字以内で入力してください', 400, 'COMMENT_TOO_LONG')
  }

  // 職業フィールドチェック
  if (profession && (typeof profession !== 'string' || profession.length > 100)) {
    throw createError('職業は100文字以内で入力してください', 400, 'PROFESSION_TOO_LONG')
  }

  // 用途フィールドチェック
  if (useCase && (typeof useCase !== 'string' || useCase.length > 500)) {
    throw createError('用途は500文字以内で入力してください', 400, 'USE_CASE_TOO_LONG')
  }

  // メールアドレスチェック
  if (email && typeof email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw createError('有効なメールアドレスを入力してください', 400, 'INVALID_EMAIL')
    }
  }

  next()
}

// XSS対策：入力値のサニタイズ
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>]/g, '') // HTMLタグの除去
      .replace(/[&]/g, '&amp;') // エスケープ処理
      .trim()
  }

  // リクエストボディの文字列フィールドをサニタイズ
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitizeString(value)
      }
    }
  }

  next()
}

// SQLインジェクション対策：危険な文字パターンの検出
export const detectSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /('|('')|;|--|\/\*|\*\/)/,
  ]

  const checkString = (str: string): boolean => {
    return dangerousPatterns.some(pattern => pattern.test(str))
  }

  // リクエストボディとクエリパラメータをチェック
  const allInputs = { ...req.body, ...req.query, ...req.params }

  for (const [key, value] of Object.entries(allInputs)) {
    if (typeof value === 'string' && checkString(value)) {
      throw createError('不正な入力が検出されました', 400, 'MALICIOUS_INPUT')
    }
  }

  next()
}

// レート制限バイパス対策
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  // User-Agentの検証
  const userAgent = req.headers['user-agent']
  if (!userAgent || userAgent.length < 10) {
    throw createError('無効なリクエストです', 400, 'INVALID_REQUEST')
  }

  // 異常に大きなヘッダーサイズの検出
  const headerSize = JSON.stringify(req.headers).length
  if (headerSize > 8192) { // 8KB制限
    throw createError('リクエストヘッダーが大きすぎます', 400, 'HEADERS_TOO_LARGE')
  }

  next()
}