-- WhisperTranscriber Database Schema
-- Execute this SQL in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(500),
    duration REAL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    transcription_text TEXT,
    confidence_score REAL,
    language VARCHAR(10) DEFAULT 'ja',
    model_used VARCHAR(50) DEFAULT 'whisper-1',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transcription_id UUID REFERENCES transcriptions(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    accuracy INTEGER CHECK (accuracy >= 1 AND accuracy <= 5),
    usability INTEGER CHECK (usability >= 1 AND usability <= 5),
    speed INTEGER CHECK (speed >= 1 AND speed <= 5),
    comment TEXT NOT NULL,
    profession VARCHAR(100),
    use_case VARCHAR(200),
    would_recommend BOOLEAN DEFAULT false,
    allow_contact BOOLEAN DEFAULT false,
    email VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    additional_features TEXT,
    improvement_suggestions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message TEXT NOT NULL,
    stack_trace TEXT,
    component_stack TEXT,
    user_agent TEXT,
    ip_address INET,
    url TEXT,
    severity VARCHAR(20) DEFAULT 'error' CHECK (severity IN ('info', 'warn', 'error', 'fatal')),
    session_id VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health logs table
CREATE TABLE IF NOT EXISTS health_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    response_time_ms INTEGER,
    memory_usage_mb REAL,
    cpu_usage_percent REAL,
    active_connections INTEGER,
    queue_size INTEGER,
    error_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage statistics table (for analytics)
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL,
    total_uploads INTEGER DEFAULT 0,
    total_transcriptions INTEGER DEFAULT 0,
    total_processing_time_seconds INTEGER DEFAULT 0,
    average_file_size_mb REAL DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_status ON transcriptions(status);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_transcriptions_deleted_at ON transcriptions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_feedback_transcription_id ON feedback(transcription_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_health_logs_service_created ON health_logs(service_name, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcriptions_updated_at BEFORE UPDATE ON transcriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Policies for transcriptions table
CREATE POLICY "Users can view own transcriptions" ON transcriptions
    FOR SELECT USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert own transcriptions" ON transcriptions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can update own transcriptions" ON transcriptions
    FOR UPDATE USING (auth.uid()::text = user_id::text OR user_id IS NULL);

-- Policies for feedback table (allow anonymous feedback)
CREATE POLICY "Anyone can insert feedback" ON feedback
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view feedback" ON feedback
    FOR SELECT USING (true);

-- Policies for error logs (allow anonymous error reporting)
CREATE POLICY "Anyone can insert error logs" ON error_logs
    FOR INSERT WITH CHECK (true);

-- Function to automatically clean up old files
CREATE OR REPLACE FUNCTION cleanup_old_transcriptions()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    UPDATE transcriptions
    SET deleted_at = NOW()
    WHERE created_at < NOW() - INTERVAL '24 hours'
    AND deleted_at IS NULL;

    GET DIAGNOSTICS cleanup_count = ROW_COUNT;

    INSERT INTO health_logs (service_name, status, metadata)
    VALUES ('file_cleanup', 'healthy', jsonb_build_object('cleaned_up_count', cleanup_count));

    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system statistics
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE (
    total_transcriptions BIGINT,
    completed_transcriptions BIGINT,
    failed_transcriptions BIGINT,
    average_processing_time REAL,
    total_feedback_count BIGINT,
    average_rating REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_transcriptions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::BIGINT as completed_transcriptions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::BIGINT as failed_transcriptions,
        AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)))::REAL as average_processing_time,
        (SELECT COUNT(*)::BIGINT FROM feedback) as total_feedback_count,
        (SELECT AVG(rating)::REAL FROM feedback) as average_rating
    FROM transcriptions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial data
INSERT INTO usage_stats (date) VALUES (CURRENT_DATE) ON CONFLICT (date) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts and session management';
COMMENT ON TABLE transcriptions IS 'Audio transcription jobs and results';
COMMENT ON TABLE feedback IS 'User feedback and ratings';
COMMENT ON TABLE error_logs IS 'Application error tracking';
COMMENT ON TABLE health_logs IS 'System health monitoring';
COMMENT ON TABLE usage_stats IS 'Daily usage statistics';

COMMENT ON COLUMN transcriptions.status IS 'Transcription job status: pending, processing, completed, failed';
COMMENT ON COLUMN transcriptions.deleted_at IS 'Soft delete timestamp for file cleanup';
COMMENT ON COLUMN feedback.rating IS 'Overall rating from 1-5 stars';
COMMENT ON COLUMN error_logs.severity IS 'Error severity level: info, warn, error, fatal';