# デプロイメント手順書

## 概要

WhisperTranscriberアプリケーションを本番環境にデプロイする手順です。

- **フロントエンド**: Vercel（無料プラン永続）
- **バックエンド**: Render（無料プラン永続）
- **データベース**: Supabase PostgreSQL（無料プラン永続）
- **Redis**: Upstash Redis（無料プラン永続）

## 前提条件

- GitHubアカウント
- Vercelアカウント
- Renderアカウント
- Supabaseアカウント
- Upstashアカウント
- OpenAI APIキー
- AWS S3設定（本番環境）

## 1. データベース設定（Supabase）

### ステップ1: Supabaseプロジェクト作成
1. [Supabase](https://supabase.com)でアカウント作成
2. 新しいプロジェクト作成
3. データベースパスワード設定

### ステップ2: データベースマイグレーション実行
```sql
-- supabase/migrations/001_initial_schema.sql の内容を
-- Supabase SQL Editorで実行
```

### ステップ3: 接続文字列取得
- Project Settings → Database → Connection string
- `DATABASE_URL`として保存

## 2. Redis設定（Upstash）

### ステップ1: Upstashアカウント作成
1. [Upstash](https://upstash.com)でアカウント作成
2. Redis データベース作成（東京リージョン推奨）

### ステップ2: 接続情報取得
- REST API の URL と Token を取得
- `UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN` として保存

## 3. バックエンドデプロイ（Render）

### ステップ1: Renderアカウント作成
1. [Render](https://render.com)でアカウント作成
2. GitHubアカウントと連携

### ステップ2: Webサービス作成
1. New → Web Service
2. GitHubリポジトリを選択
3. 以下の設定：
   - **Name**: whisper-transcriber-api
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Instance Type**: Free

### ステップ3: 環境変数設定
Render ダッシュボードで以下を設定：

```
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-vercel-app.vercel.app
DATABASE_URL=your-supabase-connection-string
OPENAI_API_KEY=sk-your-production-api-key-here
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=ap-northeast-1
S3_BUCKET=whisper-transcriber-prod
MAX_FILE_SIZE=524288000
MAX_DURATION=10800
JWT_SECRET=your-production-jwt-secret-key
ENABLE_RATE_LIMITING=true
ENABLE_FILE_CLEANUP=true
```

## 4. フロントエンドデプロイ（Vercel）

### ステップ1: Vercelアカウント作成・ログイン
```bash
npm i -g vercel
vercel login
```

### ステップ2: プロジェクトをVercelにデプロイ
```bash
vercel --prod
```

### ステップ3: 環境変数設定
Vercelダッシュボードで以下を設定：

```
VITE_API_URL=https://your-railway-app.railway.app
VITE_APP_NAME=WhisperTranscriber
VITE_APP_VERSION=1.0.0
VITE_ENABLE_SPEAKER_DETECTION=true
VITE_ENABLE_ANALYTICS=false
VITE_MAX_FILE_SIZE_MB=500
VITE_MAX_DURATION_HOURS=3
```

## 2. バックエンドデプロイ（Railway）

### ステップ1: Railwayアカウント作成・ログイン
```bash
npm install -g @railway/cli
railway login
```

### ステップ2: プロジェクト作成
```bash
railway init
```

### ステップ3: PostgreSQL追加
```bash
railway add postgresql
```

### ステップ4: Redis追加
```bash
railway add redis
```

### ステップ5: 環境変数設定
Railway ダッシュボードで以下を設定：

```
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-vercel-app.vercel.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
OPENAI_API_KEY=sk-your-production-api-key-here
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=ap-northeast-1
S3_BUCKET=whisper-transcriber-prod
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
MAX_FILE_SIZE=524288000
MAX_DURATION=10800
JWT_SECRET=your-production-jwt-secret-key
ENABLE_RATE_LIMITING=true
ENABLE_FILE_CLEANUP=true
```

### ステップ6: デプロイ
```bash
railway up
```

## 3. AWS S3設定

### S3バケット作成
```bash
aws s3 mb s3://whisper-transcriber-prod --region ap-northeast-1
```

### CORS設定
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://your-vercel-app.vercel.app"],
    "ExposeHeaders": []
  }
]
```

### ライフサイクル設定（24時間後削除）
```json
{
  "Rules": [
    {
      "ID": "DeleteAfter24Hours",
      "Status": "Enabled",
      "Expiration": {
        "Days": 1
      }
    }
  ]
}
```

## 4. ドメイン設定

### Vercel（フロントエンド）
- Vercelダッシュボードでカスタムドメイン設定
- DNSレコード更新

### Railway（バックエンド）
- カスタムドメイン設定（オプション）
- HTTPSが自動適用

## 5. 監視・メンテナンス

### ログ監視
```bash
# Vercel
vercel logs

# Railway
railway logs
```

### ヘルスチェック
- フロントエンド: https://your-domain.com
- バックエンド: https://your-api-domain.com/api/health

### データベースバックアップ
Railway PostgreSQLは自動バックアップが有効

## 6. 本番環境テスト

### 動作確認項目
- [ ] フロントエンド表示確認
- [ ] API疎通確認
- [ ] ファイルアップロード機能
- [ ] 文字起こし機能（OpenAI API）
- [ ] ファイル自動削除（24時間後）
- [ ] レスポンシブ表示
- [ ] HTTPS通信
- [ ] セキュリティヘッダー

### パフォーマンステスト
```bash
# フロントエンド
lighthouse https://your-domain.com

# バックエンド
curl https://your-api-domain.com/api/health
```

## 7. 緊急時対応

### ロールバック
```bash
# Vercel
vercel --prod --rollback

# Railway
railway rollback
```

### 障害対応
1. ログ確認
2. ヘルスチェック
3. 環境変数確認
4. データベース接続確認
5. 外部API確認（OpenAI、AWS）

## セキュリティ設定

### CSP（Content Security Policy）
Vercelで自動適用済み

### Rate Limiting
本番環境では有効化済み

### HTTPS
Vercel・Railway共に自動適用

### 機密情報管理
- 環境変数で管理
- .envファイルはGitにコミットしない
- APIキーの定期的な更新

## コスト最適化

### Vercel
- Pro Planの利用状況監視
- 帯域幅使用量チェック

### Railway
- リソース使用量監視
- データベースサイズ管理

### AWS S3
- ストレージ使用量監視
- 自動削除ポリシー確認

## 更新手順

### アプリケーション更新
1. 開発環境でテスト
2. GitHubにプッシュ
3. Vercel自動デプロイ
4. Railway自動デプロイ
5. 本番環境テスト

### 依存関係更新
```bash
npm audit
npm update
```

### セキュリティパッチ
定期的なパッケージ更新とセキュリティ監査