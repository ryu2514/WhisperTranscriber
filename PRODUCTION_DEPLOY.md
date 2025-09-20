# WhisperTranscriber 本番環境デプロイメント手順書

## 完了チェックリスト

### 準備段階
- [x] プロジェクト実装完了
- [x] セキュリティ強化実装
- [x] エラーハンドリング実装
- [x] フィードバックシステム実装
- [x] パフォーマンス最適化実装

### デプロイメント設定
- [x] Render.yaml 設定完了
- [x] Dockerfile 作成完了
- [x] 環境変数設定ファイル準備完了
- [x] データベースマイグレーション準備完了

## デプロイメント手順

### Step 1: サービスアカウント準備

#### 1.1 Supabase アカウント作成
```bash
# 1. https://supabase.com にアクセス
# 2. "Start your project" でアカウント作成
# 3. 新規プロジェクト作成:
#    - Name: whisper-transcriber
#    - Region: Northeast Asia (Tokyo)
#    - Password: 強固なパスワード設定
```

#### 1.2 Upstash Redis アカウント作成
```bash
# 1. https://console.upstash.com にアクセス
# 2. GitHub/Google アカウントでサインアップ
# 3. Redis データベース作成:
#    - Name: whisper-transcriber-queue
#    - Region: Asia Pacific (Tokyo)
#    - Type: Regional
```

#### 1.3 OpenAI アカウント準備
```bash
# 1. https://platform.openai.com にアクセス
# 2. API キー作成: whisper-transcriber-prod
# 3. 使用量制限設定（推奨: $50/月）
# 4. 通知設定を有効化
```

#### 1.4 Render アカウント作成
```bash
# 1. https://dashboard.render.com にアクセス
# 2. GitHub アカウントでサインアップ
# 3. GitHub リポジトリ連携設定
```

### Step 2: データベースセットアップ

#### 2.1 Supabase プロジェクト設定
```sql
-- Supabase Dashboard → SQL Editor で実行
-- database/migrations/001_initial_schema.sql の内容をコピー&実行
```

#### 2.2 接続情報取得
```bash
# Supabase → Settings → Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# 例:
# DATABASE_URL=postgresql://postgres:your_password@db.abcdefghijklmnop.supabase.co:5432/postgres
```

### Step 3: Redis セットアップ

#### 3.1 Upstash Redis 設定取得
```bash
# Upstash Console → Database → Details
UPSTASH_REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379

# 例:
# UPSTASH_REDIS_URL=redis://default:AbCdEfGhIjKlMnOpQrStUvWxYz@refined-flamingo-12345.upstash.io:6379
```

### Step 4: GitHub リポジトリ準備

#### 4.1 リポジトリ初期化
```bash
cd /Users/kobayashiryuju/ryuju-personal/whisper-transcriber

# Git初期化
git init
git add .
git commit -m "feat: WhisperTranscriber production ready implementation

- Complete React frontend with Material-UI
- Express backend with TypeScript
- OpenAI Whisper API integration
- Supabase database integration
- Upstash Redis queue system
- Comprehensive security implementation
- Error handling and monitoring
- User feedback system
- Performance optimization
- PWA ready implementation"

# GitHubリポジトリ作成（GitHub CLI使用）
gh repo create whisper-transcriber --public --description "完全無料の音声文字起こしツール - セラピスト向け医療専門用語対応"

# プッシュ
git remote add origin https://github.com/YOUR_USERNAME/whisper-transcriber.git
git branch -M main
git push -u origin main
```

### Step 5: Render デプロイメント

#### 5.1 Blueprint デプロイ
```bash
# 1. Render Dashboard → "New" → "Blueprint"
# 2. GitHub リポジトリ接続
# 3. render.yaml が自動検出される
# 4. "Apply" をクリック
# 5. 初回ビルド開始（5-10分程度）
```

#### 5.2 環境変数設定
```bash
# Backend Service → Environment で以下を設定:

# OpenAI API
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Upstash Redis
UPSTASH_REDIS_URL=redis://default:password@host:6379

# 以下は自動設定される:
# DATABASE_URL=postgresql://...（Supabaseから自動取得）
# CORS_ORIGIN=https://whisper-transcriber.onrender.com（自動設定）
# JWT_SECRET=auto-generated-value（自動生成）
```

### Step 6: 本番環境テスト

#### 6.1 API テストエンドポイント利用
```bash
# 全体テスト
curl https://whisper-transcriber-api.onrender.com/api/test/all

# OpenAI API テスト
curl https://whisper-transcriber-api.onrender.com/api/test/openai

# データベーステスト
curl https://whisper-transcriber-api.onrender.com/api/test/database

# Redis テスト
curl https://whisper-transcriber-api.onrender.com/api/test/redis
```

#### 6.2 機能テスト
```bash
# フロントエンドアクセス
open https://whisper-transcriber.onrender.com

# ヘルスチェック
curl https://whisper-transcriber-api.onrender.com/api/health

# ファイルアップロードテスト（小さな音声ファイル）
# → フロントエンドから実際にテスト
```

### Step 7: 運用監視設定

#### 7.1 Render 監視
```bash
# ログ監視
render logs --service whisper-transcriber-backend --tail

# メトリクス確認
# Render Dashboard → Service → Metrics
```

#### 7.2 Supabase 監視
```bash
# Usage確認
# Supabase Dashboard → Reports → API
# 月間リクエスト数と転送量を監視
```

#### 7.3 Upstash 監視
```bash
# メトリクス確認
# Upstash Console → Database → Metrics
# 接続数、コマンド実行数、メモリ使用量を監視
```

#### 7.4 OpenAI 監視
```bash
# 使用量確認
# OpenAI Platform → Usage
# 月間使用量と料金を監視
```

## 本番環境設定値

### 推奨設定
```bash
# ファイルサイズ制限
MAX_FILE_SIZE=524288000  # 500MB

# ファイル処理時間制限
MAX_DURATION=10800       # 3時間

# レート制限
ENABLE_RATE_LIMITING=true

# ファイル自動削除
ENABLE_FILE_CLEANUP=true

# セキュリティ設定
NODE_ENV=production
```

### サービス制限
```bash
# Render Free Plan
- 750時間/月 実行時間
- 512MB RAM
- 共有CPU
- 自動スリープ（15分無活動後）

# Supabase Free Plan
- 500MB データベース容量
- 5GB 転送量/月
- 100MB ファイルストレージ

# Upstash Free Plan
- 10,000コマンド/日
- 256MB メモリ
- 1つのデータベース

# OpenAI Whisper API
- $0.006/分 の料金
- ファイルサイズ制限: 25MB
```

## セキュリティ チェックリスト

- [x] HTTPS 通信（Render自動提供）
- [x] セキュリティヘッダー（Helmet.js）
- [x] CORS 設定
- [x] レート制限
- [x] 入力値検証
- [x] XSS 対策
- [x] SQL インジェクション対策
- [x] ファイル自動削除（24時間）
- [x] エラーログ収集
- [x] API キー保護

## バックアップとリカバリ

### データベースバックアップ
```sql
-- 重要データのエクスポート
SELECT
    COUNT(*) as total_transcriptions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    AVG(rating) as avg_rating
FROM transcriptions t
LEFT JOIN feedback f ON f.transcription_id = t.id;
```

### 設定ファイルバックアップ
```bash
# 重要ファイルのバックアップ
cp render.yaml backup/render_$(date +%Y%m%d).yaml
cp database/migrations/001_initial_schema.sql backup/schema_$(date +%Y%m%d).sql
cp DEPLOYMENT.md backup/deployment_$(date +%Y%m%d).md
```

## トラブルシューティング

### よくある問題

#### ビルドエラー
```bash
# TypeScript エラー確認
npm run build

# 依存関係の確認
npm install
npm audit
```

#### 接続エラー
```bash
# 環境変数確認
echo $DATABASE_URL
echo $UPSTASH_REDIS_URL
echo $OPENAI_API_KEY

# API テスト実行
curl https://whisper-transcriber-api.onrender.com/api/test/all
```

#### パフォーマンス問題
```bash
# Render メトリクス確認
# メモリ使用量、CPU使用率、レスポンス時間

# Supabase パフォーマンス確認
# クエリ実行時間、接続数
```

## 成功確認項目

### 最終チェック
- [ ] フロントエンド正常アクセス
- [ ] ファイルアップロード機能動作
- [ ] 音声ファイル文字起こし動作
- [ ] フィードバック送信機能動作
- [ ] エラーハンドリング動作
- [ ] モバイル対応確認
- [ ] PWA インストール確認

### パフォーマンス確認
- [ ] ページ読み込み時間 < 3秒
- [ ] ファイルアップロード応答 < 5秒
- [ ] 音声処理完了通知正常動作
- [ ] エラー時の適切な表示

これで WhisperTranscriber の本番環境デプロイメントが完了します。