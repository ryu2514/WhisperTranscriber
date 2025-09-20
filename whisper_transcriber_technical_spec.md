# Whisper完全無料文字起こしツール 技術仕様書

## 技術スタック

### フロントエンド
- **フレームワーク**: React 18.2+ with TypeScript
- **UI Library**: Material-UI (MUI) v5
- **状態管理**: Zustand
- **ファイルアップロード**: React Dropzone
- **HTTP客户端**: Axios
- **ビルドツール**: Vite
- **型チェック**: TypeScript 5.0+

### バックエンド
- **ランタイム**: Node.js 18+
- **フレームワーク**: Express.js with TypeScript
- **音声処理**: FFmpeg (動画から音声抽出)
- **API統合**: OpenAI Whisper API
- **ファイルストレージ**: AWS S3 (一時保存)
- **データベース**: PostgreSQL (処理履歴・統計)
- **認証**: JWT (将来的なユーザー管理用)

### インフラストラクチャ
- **ホスティング**: Vercel (フロントエンド) + Railway (バックエンド)
- **CDN**: Cloudflare
- **ファイルストレージ**: AWS S3
- **データベース**: Railway PostgreSQL
- **監視**: Sentry (エラー追跡)
- **ログ**: Winston

## API設計仕様

### 1. ファイルアップロードAPI

```typescript
POST /api/upload
Content-Type: multipart/form-data

Request:
{
  file: File, // 音声・動画ファイル
  language?: string, // 'ja' | 'en' | 'auto' (default: 'auto')
  includeTimestamps?: boolean // default: true
}

Response:
{
  success: boolean,
  data: {
    uploadId: string,
    filename: string,
    fileSize: number,
    duration?: number, // 音声長(秒)
    status: 'uploaded'
  },
  error?: string
}
```

### 2. 文字起こし処理API

```typescript
POST /api/transcribe/{uploadId}

Request:
{
  options: {
    format: 'text' | 'srt' | 'vtt' | 'json',
    speakerDetection?: boolean,
    medicalTerms?: boolean
  }
}

Response:
{
  success: boolean,
  data: {
    transcriptionId: string,
    status: 'processing' | 'completed' | 'failed',
    estimatedTime?: number // 推定完了時間(秒)
  },
  error?: string
}
```

### 3. 進捗確認API

```typescript
GET /api/transcribe/{transcriptionId}/status

Response:
{
  success: boolean,
  data: {
    status: 'processing' | 'completed' | 'failed',
    progress: number, // 0-100
    result?: {
      text: string,
      segments?: Array<{
        start: number,
        end: number,
        text: string,
        speaker?: string
      }>,
      confidence?: number
    }
  },
  error?: string
}
```

### 4. 結果取得API

```typescript
GET /api/transcribe/{transcriptionId}/result
Query: ?format=text|srt|vtt|json

Response:
{
  success: boolean,
  data: {
    format: string,
    content: string | object,
    downloadUrl?: string // 大きなファイルの場合
  },
  error?: string
}
```

## データベース設計

### テーブル設計

```sql
-- ファイルアップロード履歴
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  duration INTEGER, -- 音声長(秒)
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, -- 24時間後削除
  ip_address INET,
  user_agent TEXT
);

-- 文字起こし処理履歴
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  language VARCHAR(10),
  options JSONB, -- 処理オプション
  result JSONB, -- 処理結果
  confidence REAL,
  processing_time INTEGER, -- 処理時間(秒)
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- システム統計
CREATE TABLE usage_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  total_uploads INTEGER DEFAULT 0,
  total_transcriptions INTEGER DEFAULT 0,
  total_processing_time INTEGER DEFAULT 0, -- 秒
  average_confidence REAL,
  error_count INTEGER DEFAULT 0,
  UNIQUE(date)
);

-- インデックス
CREATE INDEX idx_uploads_expires_at ON uploads(expires_at);
CREATE INDEX idx_transcriptions_upload_id ON transcriptions(upload_id);
CREATE INDEX idx_transcriptions_status ON transcriptions(status);
CREATE INDEX idx_usage_stats_date ON usage_stats(date);
```

## セキュリティ仕様

### 1. ファイルアップロードセキュリティ

```typescript
// ファイル検証
const allowedMimeTypes = [
  'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/flac',
  'video/mp4', 'video/quicktime', 'video/x-msvideo'
];

const maxFileSize = 500 * 1024 * 1024; // 500MB
const maxDuration = 3 * 60 * 60; // 3時間

// セキュリティヘッダー
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

### 2. API レート制限

```typescript
import rateLimit from 'express-rate-limit';

// アップロードAPI制限
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 10, // 最大10ファイル/15分
  message: 'アップロード回数が制限を超えました。15分後に再試行してください。'
});

// 一般API制限
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100 // 最大100リクエスト/15分
});
```

### 3. データ自動削除

```typescript
// 毎時実行：期限切れファイル削除
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  try {
    // データベースから期限切れレコード取得
    const expiredUploads = await db.query(`
      SELECT s3_key FROM uploads
      WHERE expires_at < NOW()
    `);

    // S3からファイル削除
    for (const upload of expiredUploads.rows) {
      await s3.deleteObject({
        Bucket: process.env.S3_BUCKET,
        Key: upload.s3_key
      }).promise();
    }

    // データベースレコード削除
    await db.query(`
      DELETE FROM uploads
      WHERE expires_at < NOW()
    `);

    console.log(`Deleted ${expiredUploads.rows.length} expired files`);
  } catch (error) {
    console.error('Cleanup job failed:', error);
  }
});
```

## 音声処理フロー

### 1. ファイル前処理

```typescript
import ffmpeg from 'fluent-ffmpeg';

async function preprocessAudio(inputPath: string, outputPath: string): Promise<AudioInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(16000)
      .audioChannels(1)
      .format('mp3')
      .on('end', () => {
        // 音声情報取得
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          if (err) reject(err);
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitrate: metadata.format.bit_rate
          });
        });
      })
      .on('error', reject)
      .save(outputPath);
  });
}
```

### 2. Whisper API統合

```typescript
import OpenAI from 'openai';

class WhisperService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async transcribe(audioPath: string, options: TranscribeOptions): Promise<TranscriptionResult> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        language: options.language === 'auto' ? undefined : options.language,
        response_format: options.includeTimestamps ? 'verbose_json' : 'json',
        temperature: 0.2 // 一貫性重視
      });

      return {
        text: transcription.text,
        segments: transcription.segments,
        language: transcription.language
      };
    } catch (error) {
      throw new WhisperAPIError('文字起こし処理に失敗しました', error);
    }
  }
}
```

### 3. 医療用語後処理

```typescript
// 医療・セラピー専門用語辞書
const medicalTerms = {
  '理学療法': ['りがくりょうほう', 'りがく療法'],
  '作業療法': ['さぎょうりょうほう', 'さぎょう療法'],
  '仙腸関節': ['せんちょうかんせつ'],
  '腰椎分離症': ['ようついぶんりしょう'],
  'ACL': ['えーしーえる', 'エーシーエル'],
  // ... 他の用語
};

function correctMedicalTerms(text: string): string {
  let corrected = text;

  Object.entries(medicalTerms).forEach(([correct, variations]) => {
    variations.forEach(variation => {
      const regex = new RegExp(variation, 'gi');
      corrected = corrected.replace(regex, correct);
    });
  });

  return corrected;
}
```

## フロントエンド実装仕様

### 1. ファイルアップロードコンポーネント

```typescript
// components/FileUpload.tsx
interface FileUploadProps {
  onUploadComplete: (result: UploadResult) => void;
  onProgress: (progress: number) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, onProgress }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac'],
      'video/*': ['.mp4', '.mov', '.avi']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    onDrop: handleFileUpload
  });

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
          onProgress(progress);
        }
      });

      onUploadComplete(response.data);
    } catch (error) {
      // エラーハンドリング
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'grey.300',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease'
      }}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <CircularProgress />
      ) : (
        <>
          <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            音声・動画ファイルをここにドロップ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            または、クリックしてファイルを選択
          </Typography>
        </>
      )}
    </Box>
  );
};
```

### 2. 文字起こし結果コンポーネント

```typescript
// components/TranscriptionResult.tsx
interface TranscriptionResultProps {
  result: TranscriptionData;
  onEdit: (editedText: string) => void;
  onExport: (format: ExportFormat) => void;
}

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({
  result,
  onEdit,
  onExport
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState(result.text);

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'between', mb: 2 }}>
        <Typography variant="h6">文字起こし結果</Typography>
        <Box>
          <Button onClick={() => setEditMode(!editMode)}>
            {editMode ? '完了' : '編集'}
          </Button>
          <Button onClick={() => onExport('srt')}>SRT出力</Button>
          <Button onClick={() => onExport('text')}>テキスト出力</Button>
        </Box>
      </Box>

      {editMode ? (
        <TextField
          multiline
          fullWidth
          rows={10}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onBlur={() => onEdit(editedText)}
        />
      ) : (
        <Typography
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            maxHeight: 400,
            overflow: 'auto',
            bgcolor: 'grey.50',
            p: 2,
            borderRadius: 1
          }}
        >
          {result.text}
        </Typography>
      )}

      {result.confidence && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            認識精度: {Math.round(result.confidence * 100)}%
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
```

## 出力フォーマット仕様

### 1. SRT字幕ファイル

```typescript
function generateSRT(segments: TranscriptionSegment[]): string {
  return segments.map((segment, index) => {
    const startTime = formatSRTTime(segment.start);
    const endTime = formatSRTTime(segment.end);

    return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
  }).join('\n');
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}
```

### 2. Markdown出力

```typescript
function generateMarkdown(result: TranscriptionResult): string {
  const header = `# 文字起こし結果\n\n`;
  const metadata = `**ファイル名**: ${result.filename}\n**処理日時**: ${new Date().toLocaleString('ja-JP')}\n**認識精度**: ${Math.round(result.confidence * 100)}%\n\n---\n\n`;

  // セミナー形式の場合は見出し付きで整形
  const formattedText = result.text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // 質問形式の検出
      if (line.endsWith('？') || line.endsWith('?')) {
        return `### ${line}\n`;
      }
      // 話者切り替えの検出
      if (line.startsWith('はい') || line.startsWith('そうですね')) {
        return `\n${line}`;
      }
      return line;
    })
    .join('\n\n');

  return header + metadata + formattedText;
}
```

## エラーハンドリング

### エラー分類と対応

```typescript
// カスタムエラー定義
export class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

// エラー種別
export const ErrorCodes = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  WHISPER_API_ERROR: 'WHISPER_API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

// エラーハンドリングミドルウェア
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', error);

  if (error instanceof TranscriptionError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  // 想定外のエラー
  res.status(500).json({
    success: false,
    error: 'サーバー内部エラーが発生しました'
  });
});
```

## 監視・ログ仕様

### アプリケーション監視

```typescript
// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
  try {
    // データベース接続確認
    await db.query('SELECT 1');

    // S3接続確認
    await s3.headBucket({ Bucket: process.env.S3_BUCKET }).promise();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// メトリクス収集
import { collectDefaultMetrics, register } from 'prom-client';
collectDefaultMetrics();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

## デプロイ・運用仕様

### 環境変数設定

```bash
# .env.production
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/whisper_transcriber
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-1
S3_BUCKET=whisper-transcriber-files
SENTRY_DSN=https://...@sentry.io/...
CORS_ORIGIN=https://whispertranscriber.com
```

### Docker設定

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# システム依存関係
RUN apk add --no-cache ffmpeg

# 依存関係インストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションコピー
COPY . .
RUN npm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

---

**作成日**: 2025年9月19日
**バージョン**: 1.0
**次回更新**: システム実装開始時