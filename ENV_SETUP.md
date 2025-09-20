# Environment Setup Guide

このガイドでは、WhisperTranscriberの各サービスの環境変数設定手順を詳しく説明します。

## 1. Supabase Database Setup

### アカウント作成とプロジェクト設定
1. [Supabase](https://supabase.com) にアクセス
2. "Start your project" をクリックしてアカウント作成
3. 新しいプロジェクトを作成:
   - **Name**: `whisper-transcriber`
   - **Database Password**: 強固なパスワードを設定
   - **Region**: `Northeast Asia (Tokyo)`

### データベーススキーマの作成
1. Supabase Dashboard → SQL Editor
2. `database/migrations/001_initial_schema.sql` の内容をコピー&ペースト
3. "Run" をクリックして実行

### 接続情報の取得
1. Settings → Database
2. 以下の情報をコピー:
   - **Connection string**: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
   - **Direct URL**: `postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres`

```bash
# Supabase接続情報（例）
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.abcdefghijklmnop.supabase.co:5432/postgres
```

## 2. Upstash Redis Setup

### アカウント作成とデータベース設定
1. [Upstash Console](https://console.upstash.com) にアクセス
2. GitHub/Google アカウントでサインアップ
3. "Create Database" をクリック:
   - **Name**: `whisper-transcriber-queue`
   - **Type**: `Regional`
   - **Region**: `Asia Pacific (Tokyo)`
   - **TLS**: `Enabled`

### 接続情報の取得
1. Database → Details タブ
2. 以下の情報をコピー:
   - **REST URL**: `https://xxx-xxxxx.upstash.io`
   - **REST TOKEN**: `AXXxX...`

```bash
# Upstash Redis接続情報（例）
UPSTASH_REDIS_REST_URL=https://refined-flamingo-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXx
```

## 3. OpenAI API Setup

### API キーの取得
1. [OpenAI Platform](https://platform.openai.com) にアクセス
2. アカウント作成・ログイン
3. API keys → "Create new secret key"
4. キー名: `whisper-transcriber-prod`
5. 権限: `All` または `Whisper API` のみ

### 使用量制限の設定
1. Settings → Limits
2. 月間使用制限を設定（例: $50）
3. 通知設定を有効化

```bash
# OpenAI API設定（例）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4. Render Deployment Setup

### リポジトリの準備
```bash
# Gitリポジトリの初期化
git init
git add .
git commit -m "Initial commit: WhisperTranscriber production ready"

# GitHubにプッシュ
git remote add origin https://github.com/YOUR_USERNAME/whisper-transcriber.git
git push -u origin main
```

### Render Blueprint デプロイ
1. [Render Dashboard](https://dashboard.render.com) にアクセス
2. "New" → "Blueprint" を選択
3. GitHub リポジトリを接続
4. `render.yaml` が自動検出される
5. "Apply" をクリック

### 環境変数の設定
デプロイ後、以下の環境変数を手動で設定:

#### Backend Service
```bash
# 手動設定が必要な環境変数
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
UPSTASH_REDIS_REST_URL=https://refined-flamingo-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXxXXXx

# 自動設定される環境変数
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:5432/postgres
CORS_ORIGIN=https://whisper-transcriber.onrender.com
JWT_SECRET=auto-generated-value
```

## 5. セキュリティ設定

### Supabase セキュリティ
1. Authentication → Settings
2. "Enable email confirmations" を有効化
3. "Enable phone confirmations" を無効化
4. JWT Settings で有効期限を設定

### Upstash セキュリティ
1. Database → Security
2. IP制限を設定（本番サーバーのIPのみ許可）
3. TLS接続を強制

### OpenAI セキュリティ
1. API Keys で使用量監視を有効化
2. Organization Settings でチーム制限を設定
3. Billing で使用量アラートを設定

## 6. モニタリング設定

### Render モニタリング
```bash
# ヘルスチェックURL
https://whisper-transcriber-api.onrender.com/api/health

# ログ監視
render logs --service whisper-transcriber-backend --tail
```

### Supabase モニタリング
1. Reports → API で使用量確認
2. Logs でクエリパフォーマンス監視
3. Database → Performance で接続数監視

### Upstash モニタリング
1. Database → Metrics で接続数確認
2. Commands で実行コマンド監視
3. Memory usage で使用量確認

## 7. バックアップとリカバリ

### データベースバックアップ
```sql
-- 定期バックアップクエリ（Supabase Dashboard → SQL Editor）
SELECT NOW() as backup_time,
       COUNT(*) as total_transcriptions,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transcriptions,
       AVG(rating) as average_rating
FROM transcriptions t
LEFT JOIN feedback f ON f.transcription_id = t.id;
```

### 設定バックアップ
```bash
# 環境変数のバックアップ（機密情報は除く）
cp .env.production .env.production.backup.$(date +%Y%m%d)

# データベーススキーマのバックアップ
cp database/migrations/001_initial_schema.sql backup/schema_$(date +%Y%m%d).sql
```

## 8. トラブルシューティング

### よくある問題と解決方法

#### Database Connection Error
```bash
# 接続文字列の確認
echo $DATABASE_URL

# Supabase Project Settings → Database で接続情報を再確認
# ファイアウォール設定の確認
```

#### Redis Connection Error
```bash
# Upstash接続情報の確認
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# Upstash Console → Database → Details で情報を再確認
```

#### OpenAI API Error
```bash
# API キーの確認
echo $OPENAI_API_KEY | head -c 10

# OpenAI Platform → Usage で使用量・制限を確認
# Billing でクレジット残高を確認
```

#### Build/Deploy Error
```bash
# Render Build Logs の確認
# package.json の依存関係確認
# TypeScript エラーの修正
```

## 9. 本番環境最適化

### パフォーマンス設定
```bash
# Node.js メモリ制限
NODE_OPTIONS=--max-old-space-size=512

# ファイル処理制限
MAX_FILE_SIZE=524288000  # 500MB
MAX_DURATION=10800       # 3時間

# レート制限
ENABLE_RATE_LIMITING=true
```

### セキュリティ強化
```bash
# セキュリティヘッダー
HELMET_ENABLED=true
CORS_STRICT_MODE=true

# ファイルクリーンアップ
ENABLE_FILE_CLEANUP=true
```

このガイドに従って環境を設定することで、WhisperTranscriberを安全かつ効率的に本番環境で運用できます。