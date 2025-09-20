import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })

  // Default error values
  let statusCode = error.statusCode || 500
  let message = error.message || 'Internal server error'
  const code = error.code

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation error'
  } else if (error.name === 'CastError') {
    statusCode = 400
    message = 'Invalid data format'
  } else if (error.name === 'MulterError') {
    statusCode = 400
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large'
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files'
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field'
    }
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong'
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(code && { code }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
    }),
  })
}

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export const createError = (message: string, statusCode: number = 500, code?: string): AppError => {
  const error = new Error(message) as AppError
  error.statusCode = statusCode
  error.code = code
  return error
}