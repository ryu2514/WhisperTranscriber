import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { apiTester } from '../utils/apiTester'
import { logger } from '../utils/logger'

const router = Router()

// Run comprehensive API tests
router.get('/test/all', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Starting comprehensive API tests')

  const results = await apiTester.runAllTests()

  const overallStatus = results.every(r => r.status === 'success') ? 'healthy' :
                       results.some(r => r.status === 'error') ? 'unhealthy' : 'degraded'

  res.json({
    success: true,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      warnings: results.filter(r => r.status === 'warning').length,
      errors: results.filter(r => r.status === 'error').length,
      averageResponseTime: results
        .filter(r => r.responseTime)
        .reduce((sum, r) => sum + (r.responseTime || 0), 0) /
        results.filter(r => r.responseTime).length || 0
    }
  })
}))

// Test OpenAI API specifically
router.get('/test/openai', asyncHandler(async (req: Request, res: Response) => {
  const isValid = await apiTester.validateOpenAIKey()

  if (!process.env.OPENAI_API_KEY) {
    res.json({
      success: true,
      status: 'warning',
      message: 'OpenAI API key not configured - using mock service',
      configured: false
    })
    return
  }

  if (!isValid) {
    res.status(400).json({
      success: false,
      status: 'error',
      message: 'OpenAI API key is invalid or has insufficient permissions',
      configured: true,
      valid: false
    })
    return
  }

  res.json({
    success: true,
    status: 'healthy',
    message: 'OpenAI API key is valid and working',
    configured: true,
    valid: true
  })
}))

// Get cost estimation for transcription
router.post('/test/cost-estimate', asyncHandler(async (req: Request, res: Response) => {
  const { fileSizeBytes, durationSeconds } = req.body

  if (!fileSizeBytes || !durationSeconds) {
    res.status(400).json({
      success: false,
      error: 'fileSizeBytes and durationSeconds are required'
    })
    return
  }

  const estimatedCost = await apiTester.estimateTranscriptionCost(fileSizeBytes, durationSeconds)

  res.json({
    success: true,
    fileSizeBytes,
    durationSeconds,
    estimatedCostUSD: estimatedCost,
    pricePerMinute: 0.006,
    currency: 'USD'
  })
}))

// Test database connectivity
router.get('/test/database', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { database } = await import('../models/database')
    await database.testConnection()

    res.json({
      success: true,
      status: 'healthy',
      message: 'Database connection is working correctly'
    })

  } catch (error: any) {
    logger.error('Database test failed:', error)

    res.status(500).json({
      success: false,
      status: 'error',
      message: `Database connection failed: ${error.message}`
    })
  }
}))

// Test Redis/Queue connectivity
router.get('/test/redis', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { queueService } = await import('../services/queueService')
    const health = await queueService.getHealthStatus()

    res.json({
      success: true,
      status: health.redis.status === 'healthy' ? 'healthy' : 'error',
      message: health.redis.status === 'healthy'
        ? 'Redis connection is working correctly'
        : `Redis connection issues: ${health.redis.error}`,
      details: health.redis
    })

  } catch (error: any) {
    logger.error('Redis test failed:', error)

    res.status(500).json({
      success: false,
      status: 'error',
      message: `Redis connection test failed: ${error.message}`
    })
  }
}))

export default router