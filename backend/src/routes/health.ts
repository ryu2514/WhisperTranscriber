import { Router } from 'express'
import { database } from '../models/database'
import { queueService } from '../services/queueService'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const checks = {
    server: true,
    database: false,
    queue: false,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  }

  try {
    // Check database connection
    checks.database = await database.healthCheck()
  } catch (error) {
    checks.database = false
  }

  try {
    // Check queue service
    checks.queue = await queueService.healthCheck()
  } catch (error) {
    checks.queue = false
  }

  // Determine health: allow degraded (e.g., Redis not configured) without failing
  const status = (checks.server && checks.database && checks.queue)
    ? 'healthy'
    : (checks.server && checks.database)
      ? 'degraded'
      : 'unhealthy'

  res.status(status === 'unhealthy' ? 503 : 200).json({
    status,
    checks,
  })
}))

router.get('/metrics', asyncHandler(async (req, res) => {
  // Basic metrics endpoint (could be enhanced with Prometheus format)
  const queueStats = await queueService.getQueueStats()

  const metrics = {
    process_uptime_seconds: process.uptime(),
    process_memory_usage_bytes: process.memoryUsage(),
    nodejs_version: process.version,
    timestamp: Date.now(),
    queue_stats: queueStats,
  }

  res.set('Content-Type', 'application/json')
  res.json(metrics)
}))

router.get('/queue', asyncHandler(async (req, res) => {
  const stats = await queueService.getQueueStats()

  res.json({
    success: true,
    data: stats,
  })
}))

export default router
