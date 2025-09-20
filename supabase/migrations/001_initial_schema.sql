-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create uploads table
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  duration INTEGER,
  s3_key VARCHAR(255) NOT NULL,
  upload_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create transcriptions table
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  language VARCHAR(10),
  status VARCHAR(50) DEFAULT 'pending',
  result JSONB,
  confidence DECIMAL(3,2),
  processing_time INTEGER,
  error_message TEXT,
  options JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_uploads_created_at ON uploads(created_at);
CREATE INDEX idx_uploads_expires_at ON uploads(expires_at);
CREATE INDEX idx_uploads_s3_key ON uploads(s3_key);
CREATE INDEX idx_transcriptions_upload_id ON transcriptions(upload_id);
CREATE INDEX idx_transcriptions_status ON transcriptions(status);
CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for transcriptions table
CREATE TRIGGER update_transcriptions_updated_at
  BEFORE UPDATE ON transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to cleanup expired uploads
CREATE OR REPLACE FUNCTION cleanup_expired_uploads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM uploads
  WHERE expires_at < NOW()
  AND upload_status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Create a view for transcription results with upload info
CREATE VIEW transcription_results AS
SELECT
  t.id,
  t.upload_id,
  t.language,
  t.status,
  t.result,
  t.confidence,
  t.processing_time,
  t.error_message,
  t.options,
  t.created_at,
  t.updated_at,
  u.filename,
  u.original_name,
  u.file_size,
  u.mime_type,
  u.duration
FROM transcriptions t
JOIN uploads u ON t.upload_id = u.id;