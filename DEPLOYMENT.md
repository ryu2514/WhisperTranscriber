# WhisperTranscriber 本番環境デプロイメントガイド

このガイドでは、WhisperTranscriberを本番環境にデプロイする手順を説明します。

## 前提条件

1. GitHub アカウント
2. Render アカウント
3. Supabase アカウント
4. Upstash アカウント
5. OpenAI アカウント（API キー取得済み）

## デプロイメント手順

### 1. GitHub リポジトリの準備

```bash
# リポジトリの初期化
git init
git add .
git commit -m "Initial commit: WhisperTranscriber complete implementation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/whisper-transcriber.git
git push -u origin main
```

### 2. Supabase データベースのセットアップ

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. 新しいプロジェクトを作成: `whisper-transcriber`
3. データベース URL と API キーを取得
4. SQL Editor で以下のスキーマを実行:

```sql
-- Users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcriptions table
CREATE TABLE transcriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    duration REAL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    transcription_text TEXT,
    confidence_score REAL,
    language VARCHAR(10),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback table
CREATE TABLE feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transcription_id UUID REFERENCES transcriptions(id),
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error logs table
CREATE TABLE error_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    stack_trace TEXT,
    user_agent TEXT,
    ip_address INET,
    url TEXT,
    severity VARCHAR(20) DEFAULT 'error',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX idx_transcriptions_status ON transcriptions(status);
CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at);
CREATE INDEX idx_feedback_transcription_id ON feedback(transcription_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);
```

### 3. Upstash Redis のセットアップ

1. [Upstash Console](https://console.upstash.com/) にログイン
2. 新しい Redis データベースを作成: `whisper-transcriber-queue`
3. リージョン: `Asia Pacific (Tokyo)` を選択
4. REST URL と TOKEN を取得

### 4. Render デプロイメント

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. "New" → "Blueprint" を選択
3. GitHub リポジトリを接続
4. `render.yaml` ファイルが自動検出される
5. 以下の環境変数を手動設定:

#### Backend 環境変数
- `OPENAI_API_KEY`: OpenAI API キー
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST Token
- `DATABASE_URL`: Supabase データベース URL（自動設定）

#### Frontend 環境変数
フロントエンドは静的サイトのため、ビルド時に `.env.production` が使用されます。

### 5. DNS 設定（オプション）

独自ドメインを使用する場合:
1. Render Dashboard で Custom Domain を設定
2. DNS レコードを追加:
   - `CNAME whisper-transcriber.yourdomain.com` → `whisper-transcriber.onrender.com`
   - `CNAME api.yourdomain.com` → `whisper-transcriber-api.onrender.com`

### 6. SSL 証明書

Render は自動的に Let's Encrypt SSL 証明書を提供します。
独自ドメインを使用する場合も、自動的に SSL が設定されます。

## 環境変数の完全リスト

### Backend (.env.production)
```
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://user:pass@host:port/db
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
OPENAI_API_KEY=sk-xxx
CORS_ORIGIN=https://whisper-transcriber.onrender.com
MAX_FILE_SIZE=524288000
MAX_DURATION=10800
ENABLE_RATE_LIMITING=true
ENABLE_FILE_CLEANUP=true
JWT_SECRET=auto-generated-by-render
```

### Frontend (.env.production)
```
VITE_API_BASE_URL=https://whisper-transcriber-api.onrender.com
VITE_APP_NAME=WhisperTranscriber
VITE_APP_VERSION=1.0.0
VITE_ENABLE_PWA=true
VITE_MAX_FILE_SIZE=524288000
VITE_ENABLE_ERROR_REPORTING=true
```

## デプロイ後の確認事項

1. **ヘルスチェック**: `https://whisper-transcriber-api.onrender.com/api/health`
2. **フロントエンド**: `https://whisper-transcriber.onrender.com`
3. **ファイルアップロード**: 小さなテスト音声ファイルでテスト
4. **音声変換**: 実際の音声ファイルで文字起こしテスト
5. **フィードバック**: フィードバック送信機能のテスト

## 監視とメンテナンス

### ログ監視
- Render Dashboard のログを定期確認
- エラーレートの監視
- パフォーマンスメトリクスの確認

### データベースメンテナンス
- Supabase のバックアップ確認
- 古いファイルの自動削除確認
- インデックスのパフォーマンス監視

### セキュリティ
- 依存関係の定期更新
- セキュリティアラートの監視
- HTTPS 証明書の更新確認（自動）

## トラブルシューティング

### よくある問題

1. **ビルドエラー**:
   - 依存関係の確認
   - Node.js バージョンの確認
   - TypeScript エラーの修正

2. **データベース接続エラー**:
   - Supabase の接続文字列確認
   - ファイアウォール設定確認

3. **Redis 接続エラー**:
   - Upstash の URL とトークン確認
   - ネットワーク接続確認

4. **OpenAI API エラー**:
   - API キーの有効性確認
   - レート制限の確認
   - 利用料金の確認

## パフォーマンス最適化

1. **CDN**: 静的アセットの配信最適化
2. **キャッシュ**: Redis キャッシュの活用
3. **画像最適化**: WebP 形式の採用
4. **コード分割**: 動的インポートの活用

## バックアップ戦略

1. **データベース**: Supabase 自動バックアップ
2. **ファイル**: 24時間自動削除のため不要
3. **設定**: GitHub リポジトリにバックアップ済み

このガイドに従って、WhisperTranscriberを安全かつ効率的に本番環境にデプロイできます。