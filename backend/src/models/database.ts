import { Pool } from 'pg'
import { DatabaseUpload, DatabaseTranscription, TranscriptionOptions, TranscriptionResult } from '../types'

interface DatabaseFeedback {
  id?: string
  rating: number
  accuracy: number | null
  usability: number | null
  speed: number | null
  comment: string
  profession: string | null
  use_case: string | null
  would_recommend: boolean
  allow_contact: boolean
  email: string | null
  transcription_id: string | null
  user_agent: string | null
  ip_address: string | null
  created_at: Date
}

class Database {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // Supabase specific configuration
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  async initialize(): Promise<void> {
    try {
      await this.createTables()
      console.log('Database initialized successfully')
    } catch (error) {
      console.error('Failed to initialize database:', error)
      console.log('Running in development mode without database')
      // Don't throw error in development mode
      if (process.env.NODE_ENV !== 'development') {
        throw error
      }
    }
  }

  private async createTables(): Promise<void> {
    const createUploadsTable = `
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        duration INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        ip_address INET,
        user_agent TEXT
      );
    `

    const createTranscriptionsTable = `
      CREATE TABLE IF NOT EXISTS transcriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        language VARCHAR(10),
        options JSONB,
        result JSONB,
        confidence REAL,
        processing_time INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `

    const createFeedbackTable = `
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        accuracy INTEGER CHECK (accuracy >= 1 AND accuracy <= 5),
        usability INTEGER CHECK (usability >= 1 AND usability <= 5),
        speed INTEGER CHECK (speed >= 1 AND speed <= 5),
        comment TEXT NOT NULL,
        profession VARCHAR(100),
        use_case TEXT,
        would_recommend BOOLEAN DEFAULT FALSE,
        allow_contact BOOLEAN DEFAULT FALSE,
        email VARCHAR(255),
        transcription_id UUID REFERENCES transcriptions(id) ON DELETE SET NULL,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `

    const createUsageStatsTable = `
      CREATE TABLE IF NOT EXISTS usage_stats (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        total_uploads INTEGER DEFAULT 0,
        total_transcriptions INTEGER DEFAULT 0,
        total_processing_time INTEGER DEFAULT 0,
        average_confidence REAL,
        error_count INTEGER DEFAULT 0,
        UNIQUE(date)
      );
    `

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_uploads_expires_at ON uploads(expires_at);
      CREATE INDEX IF NOT EXISTS idx_transcriptions_upload_id ON transcriptions(upload_id);
      CREATE INDEX IF NOT EXISTS idx_transcriptions_status ON transcriptions(status);
      CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date);
    `

    await this.pool.query(createUploadsTable)
    await this.pool.query(createTranscriptionsTable)
    await this.pool.query(createFeedbackTable)
    await this.pool.query(createUsageStatsTable)
    await this.pool.query(createIndexes)
  }

  // Upload operations
  async createUpload(upload: Omit<DatabaseUpload, 'id' | 'uploaded_at'>): Promise<DatabaseUpload> {
    const query = `
      INSERT INTO uploads (filename, original_name, file_size, mime_type, s3_key, duration, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `
    const values = [
      upload.filename,
      upload.original_name,
      upload.file_size,
      upload.mime_type,
      upload.s3_key,
      upload.duration,
      upload.expires_at,
      upload.ip_address,
      upload.user_agent,
    ]

    const result = await this.pool.query(query, values)
    return result.rows[0] as DatabaseUpload
  }

  async getUploadById(id: string): Promise<DatabaseUpload | null> {
    const query = 'SELECT * FROM uploads WHERE id = $1'
    const result = await this.pool.query(query, [id])
    return result.rows[0] as DatabaseUpload || null
  }

  async deleteExpiredUploads(): Promise<number> {
    const query = 'DELETE FROM uploads WHERE expires_at < NOW() RETURNING s3_key'
    const result = await this.pool.query(query)
    return result.rows.length
  }

  // Transcription operations
  async createTranscription(transcription: {
    upload_id: string
    language?: string
    options: TranscriptionOptions
  }): Promise<DatabaseTranscription> {
    const query = `
      INSERT INTO transcriptions (upload_id, language, options)
      VALUES ($1, $2, $3)
      RETURNING *
    `
    const values = [transcription.upload_id, transcription.language, JSON.stringify(transcription.options)]

    const result = await this.pool.query(query, values)
    return result.rows[0] as DatabaseTranscription
  }

  async updateTranscriptionStatus(
    id: string,
    status: 'processing' | 'completed' | 'failed',
    result?: TranscriptionResult,
    error?: string
  ): Promise<void> {
    const query = `
      UPDATE transcriptions
      SET status = $1, result = $2, error_message = $3, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
      WHERE id = $4
    `
    const values = [status, result ? JSON.stringify(result) : null, error, id]
    await this.pool.query(query, values)
  }

  async getTranscriptionById(id: string): Promise<DatabaseTranscription | null> {
    const query = `
      SELECT t.*, u.filename, u.original_name
      FROM transcriptions t
      JOIN uploads u ON t.upload_id = u.id
      WHERE t.id = $1
    `
    const result = await this.pool.query(query, [id])
    return result.rows[0] as DatabaseTranscription || null
  }

  async getTranscriptionWithUpload(transcriptionId: string): Promise<{
    transcription: DatabaseTranscription
    upload: DatabaseUpload
  } | null> {
    const query = `
      SELECT
        t.*,
        u.id as upload_id,
        u.filename,
        u.original_name,
        u.file_size,
        u.mime_type,
        u.s3_key,
        u.duration,
        u.uploaded_at,
        u.expires_at
      FROM transcriptions t
      JOIN uploads u ON t.upload_id = u.id
      WHERE t.id = $1
    `
    const result = await this.pool.query(query, [transcriptionId])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      transcription: {
        id: row.id,
        upload_id: row.upload_id,
        status: row.status,
        language: row.language,
        options: row.options,
        result: row.result,
        confidence: row.confidence,
        processing_time: row.processing_time,
        error_message: row.error_message,
        created_at: row.created_at,
        completed_at: row.completed_at,
      },
      upload: {
        id: row.upload_id,
        filename: row.filename,
        original_name: row.original_name,
        file_size: row.file_size,
        mime_type: row.mime_type,
        s3_key: row.s3_key,
        duration: row.duration,
        uploaded_at: row.uploaded_at,
        expires_at: row.expires_at,
        ip_address: null,
        user_agent: null,
      },
    }
  }

  // Usage statistics
  async updateUsageStats(
    date: Date,
    uploads: number = 0,
    transcriptions: number = 0,
    processingTime: number = 0,
    confidence?: number,
    errors: number = 0
  ): Promise<void> {
    const query = `
      INSERT INTO usage_stats (date, total_uploads, total_transcriptions, total_processing_time, average_confidence, error_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (date)
      DO UPDATE SET
        total_uploads = usage_stats.total_uploads + $2,
        total_transcriptions = usage_stats.total_transcriptions + $3,
        total_processing_time = usage_stats.total_processing_time + $4,
        average_confidence = CASE
          WHEN $5 IS NOT NULL THEN
            COALESCE((usage_stats.average_confidence * usage_stats.total_transcriptions + $5) / NULLIF(usage_stats.total_transcriptions + 1, 0), $5)
          ELSE usage_stats.average_confidence
        END,
        error_count = usage_stats.error_count + $6
    `
    const values = [date.toISOString().split('T')[0], uploads, transcriptions, processingTime, confidence, errors]
    await this.pool.query(query, values)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  // Feedback operations
  async saveFeedback(feedback: Omit<DatabaseFeedback, 'id'>): Promise<DatabaseFeedback> {
    const query = `
      INSERT INTO feedback (
        rating, accuracy, usability, speed, comment, profession, use_case,
        would_recommend, allow_contact, email, transcription_id, user_agent, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `
    const values = [
      feedback.rating,
      feedback.accuracy,
      feedback.usability,
      feedback.speed,
      feedback.comment,
      feedback.profession,
      feedback.use_case,
      feedback.would_recommend,
      feedback.allow_contact,
      feedback.email,
      feedback.transcription_id,
      feedback.user_agent,
      feedback.ip_address,
      feedback.created_at,
    ]

    const result = await this.pool.query(query, values)
    return result.rows[0]
  }

  async getFeedbackStats(): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_feedback,
        AVG(rating) as avg_rating,
        AVG(accuracy) as avg_accuracy,
        AVG(usability) as avg_usability,
        AVG(speed) as avg_speed,
        COUNT(CASE WHEN would_recommend = true THEN 1 END) as recommendations,
        COUNT(CASE WHEN allow_contact = true THEN 1 END) as contact_allowed,
        COUNT(DISTINCT profession) as profession_count
      FROM feedback
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `
    const result = await this.pool.query(query)
    return result.rows[0]
  }

  async getRecentFeedback(limit: number, offset: number): Promise<DatabaseFeedback[]> {
    const query = `
      SELECT f.*, t.result->>'text' as transcription_text
      FROM feedback f
      LEFT JOIN transcriptions t ON f.transcription_id = t.id
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2
    `
    const result = await this.pool.query(query, [limit, offset])
    return result.rows
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  // Test connection for API testing
  async testConnection(): Promise<void> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT version()')
      console.log('Database version:', result.rows[0].version)
    } finally {
      client.release()
    }
  }
}

export const database = new Database()