import { logger } from '../utils/logger'
import { database } from '../models/database'
import { s3Service } from '../services/s3Service'

class CleanupService {
  private isRunning = false

  async cleanupExpiredFiles(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Cleanup already running, skipping')
      return
    }

    this.isRunning = true

    try {
      logger.info('Starting expired files cleanup')

      // Get expired uploads from database
      const deletedCount = await database.deleteExpiredUploads()

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired file records from database`)
      }

      logger.info('Expired files cleanup completed')
    } catch (error) {
      logger.error('Expired files cleanup failed', error)
    } finally {
      this.isRunning = false
    }
  }

  startScheduledCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupExpiredFiles()
    }, 60 * 60 * 1000)

    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.cleanupExpiredFiles()
    }, 5 * 60 * 1000)

    logger.info('Scheduled file cleanup service started')
  }
}

export const cleanupService = new CleanupService()

// Auto-start if cleanup is enabled
if (process.env.ENABLE_FILE_CLEANUP !== 'false') {
  cleanupService.startScheduledCleanup()
}