import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { database } from './models/database'
import { queueService } from './services/queueService'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { rateLimiter } from './middleware/rateLimiter'
import uploadRoutes from './routes/upload'
import transcriptionRoutes from './routes/transcription'
import healthRoutes from './routes/health'
import feedbackRoutes from './routes/feedback'
import errorRoutes from './routes/errors'
import apiTestRoutes from './routes/apiTest'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CORS_ORIGIN || 'http://localhost:3000'],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // ファイルアップロードのため
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
}))

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}))

// Rate limiting
if (process.env.ENABLE_RATE_LIMITING === 'true') {
  app.use(rateLimiter)
}

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/transcribe', transcriptionRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/errors', errorRoutes)
app.use('/api', apiTestRoutes)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'WhisperTranscriber API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

// Server initialization
async function startServer() {
  try {
    // Initialize database
    await database.initialize()
    logger.info('Database connection established')

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  await database.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')
  await database.close()
  process.exit(0)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server
startServer()