# 🎙️ WhisperTranscriber

セラピスト向け完全無料音声文字起こしツール

## 📋 概要

WhisperTranscriberは、理学療法士・作業療法士などのセラピスト向けに開発された、完全無料の音声文字起こしサービスです。OpenAI Whisper APIを活用し、医療・セラピー専門用語に対応した高精度な文字起こしを提供します。

## ✨ 主要機能

- 🆓 **完全無料** - 永続的な無料提供
- 🎯 **高精度** - 95%以上の認識精度（医療用語対応）
- ⚡ **高速処理** - 1時間の音声を5分以内で処理
- 🔒 **プライバシー保護** - 24時間後自動ファイル削除
- 📱 **レスポンシブ対応** - PC・タブレット・スマホ対応
- 📄 **多形式出力** - テキスト・SRT字幕・マークダウン

## 🏗️ 技術スタック

### フロントエンド
- React 18 + TypeScript
- Material-UI (MUI) v5
- Zustand (状態管理)
- Vite (ビルドツール)

### バックエンド
- Node.js + Express + TypeScript
- PostgreSQL (データベース)
- OpenAI Whisper API
- FFmpeg (音声処理)
- AWS S3 (ファイルストレージ)

### インフラ
- Vercel (フロントエンド)
- Railway (バックエンド)
- Cloudflare (CDN)

## 🚀 開発環境セットアップ

### 前提条件
- Node.js 18+
- PostgreSQL (開発時はオプション - SQLiteフォールバック有り)
- FFmpeg (オプション - 音声処理用)
- OpenAI API Key

### クイックスタート

```bash
# リポジトリクローン
git clone https://github.com/kobayashiryuju/whisper-transcriber.git
cd whisper-transcriber

# 依存関係インストール
npm run install:all

# 開発サーバー起動（フロントエンド・バックエンド同時）
npm run dev
```

### 個別起動

```bash
# フロントエンド（ポート3000）
cd frontend
npm install
npm run dev

# バックエンド（ポート3001）
cd backend
npm install
npm run dev
```

### 環境変数設定

1. **バックエンド環境変数**
```bash
# backend/.env を作成
cp backend/.env.example backend/.env

# OpenAI API Keyを設定（必須）
OPENAI_API_KEY=sk-your-actual-api-key-here
```

2. **フロントエンド環境変数**
```bash
# frontend/.env を作成（既に設定済み）
VITE_API_URL=http://localhost:3001
```

### 📋 開発用機能

- **モックモード**: OpenAI APIキーがない場合、ダミーの文字起こし結果を返します
- **ファイルストレージ**: 開発時はメモリ内ストレージを使用（S3不要）
- **データベース**: PostgreSQLがない場合もアプリケーションは起動します

## 📂 プロジェクト構造

```
whisper-transcriber/
├── frontend/                 # React フロントエンド
│   ├── src/
│   │   ├── components/       # UIコンポーネント
│   │   ├── pages/           # ページコンポーネント
│   │   ├── store/           # Zustand ストア
│   │   ├── services/        # API クライアント
│   │   └── utils/           # ユーティリティ
│   ├── public/              # 静的ファイル
│   └── package.json
├── backend/                  # Express バックエンド
│   ├── src/
│   │   ├── routes/          # API ルート
│   │   ├── services/        # ビジネスロジック
│   │   ├── models/          # データベースモデル
│   │   ├── middleware/      # ミドルウェア
│   │   └── utils/           # ユーティリティ
│   ├── migrations/          # データベースマイグレーション
│   └── package.json
├── docs/                    # ドキュメント
└── README.md
```

## 🎯 開発スケジュール

### フェーズ1: MVP開発 (4週間) ✅ 完了
- [x] プロジェクト環境構築
- [x] フロントエンド基盤構築
- [x] バックエンドAPI開発
- [x] Whisper API統合
- [x] 基本機能テスト
- [x] デプロイメント設定

### フェーズ2: ベータテスト (4週間)
- [ ] セラピスト向けクローズドベータ
- [ ] フィードバック収集・改善
- [ ] パフォーマンス最適化
- [ ] セキュリティ強化

### フェーズ3: 本格運用 (4週間)
- [ ] 本格リリース
- [ ] ユーザーサポート体制
- [ ] 機能追加・改善
- [ ] 次期機能計画

## 🤝 コントリビューション

プルリクエストやイシューの報告を歓迎します。開発に参加される場合は、以下のガイドラインに従ってください：

1. フォークしてブランチを作成
2. 機能開発・バグ修正
3. テスト実行
4. プルリクエスト作成

## 📄 ライセンス

MIT License

## 📞 サポート

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/kobayashiryuju/whisper-transcriber/issues)
- 📖 Documentation: [Docs](./docs/)

---

**開発者**: 小林龍樹 & Claude Code
**目的**: セラピスト教育事業のアクセシビリティ向上
**理念**: "過去の自分と同じように運動療法に悩むセラピストを支援したい"