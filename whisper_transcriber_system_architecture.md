# Whisper文字起こしツール システム設計図

## システム全体アーキテクチャ

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App PWA]
    end

    subgraph "CDN/Edge"
        CF[Cloudflare CDN]
    end

    subgraph "Frontend (Vercel)"
        FE[React Frontend]
        SW[Service Worker]
    end

    subgraph "Backend (Railway)"
        API[Express API Server]
        QUEUE[Processing Queue]
        WORKER[Background Workers]
    end

    subgraph "External Services"
        WHISPER[OpenAI Whisper API]
        S3[AWS S3 Storage]
    end

    subgraph "Database"
        DB[(PostgreSQL)]
    end

    subgraph "Monitoring"
        SENTRY[Sentry Error Tracking]
        LOGS[Winston Logging]
    end

    WEB --> CF
    MOBILE --> CF
    CF --> FE
    FE --> API
    SW --> API
    API --> QUEUE
    QUEUE --> WORKER
    WORKER --> WHISPER
    WORKER --> S3
    API --> DB
    WORKER --> DB
    API --> SENTRY
    WORKER --> LOGS
```

## 詳細コンポーネント設計

### 1. フロントエンド アーキテクチャ

```mermaid
graph LR
    subgraph "React Application"
        ROUTER[React Router]
        STORE[Zustand Store]
        COMPONENTS[UI Components]
        HOOKS[Custom Hooks]
    end

    subgraph "State Management"
        UPLOAD_STORE[Upload State]
        TRANSCRIPTION_STORE[Transcription State]
        UI_STORE[UI State]
    end

    subgraph "Services"
        API_CLIENT[API Client]
        FILE_SERVICE[File Service]
        EXPORT_SERVICE[Export Service]
    end

    ROUTER --> COMPONENTS
    COMPONENTS --> STORE
    STORE --> UPLOAD_STORE
    STORE --> TRANSCRIPTION_STORE
    STORE --> UI_STORE
    COMPONENTS --> HOOKS
    HOOKS --> API_CLIENT
    API_CLIENT --> FILE_SERVICE
    COMPONENTS --> EXPORT_SERVICE
```

### 2. バックエンド アーキテクチャ

```mermaid
graph TB
    subgraph "API Layer"
        ROUTES[Express Routes]
        MIDDLEWARE[Middleware]
        VALIDATION[Request Validation]
    end

    subgraph "Service Layer"
        UPLOAD_SERVICE[Upload Service]
        TRANSCRIPTION_SERVICE[Transcription Service]
        FILE_SERVICE[File Processing Service]
        EXPORT_SERVICE[Export Service]
    end

    subgraph "Data Layer"
        REPOSITORY[Database Repository]
        S3_CLIENT[S3 Client]
        CACHE[Redis Cache]
    end

    subgraph "Background Processing"
        BULL_QUEUE[Bull Queue]
        PROCESSORS[Job Processors]
    end

    ROUTES --> MIDDLEWARE
    MIDDLEWARE --> VALIDATION
    VALIDATION --> UPLOAD_SERVICE
    VALIDATION --> TRANSCRIPTION_SERVICE
    UPLOAD_SERVICE --> FILE_SERVICE
    TRANSCRIPTION_SERVICE --> EXPORT_SERVICE
    FILE_SERVICE --> REPOSITORY
    FILE_SERVICE --> S3_CLIENT
    TRANSCRIPTION_SERVICE --> BULL_QUEUE
    BULL_QUEUE --> PROCESSORS
    PROCESSORS --> S3_CLIENT
```

## データフロー図

### 1. ファイルアップロード処理フロー

```mermaid
sequenceDiagram
    participant Client
    participant Frontend
    participant API
    participant S3
    participant Database
    participant Queue

    Client->>Frontend: ファイルアップロード
    Frontend->>API: POST /api/upload
    API->>API: ファイルサイズ・形式チェック
    API->>S3: ファイルアップロード
    S3-->>API: アップロード完了
    API->>Database: アップロード記録保存
    Database-->>API: 保存完了
    API-->>Frontend: アップロードID返却
    Frontend-->>Client: アップロード完了通知
```

### 2. 文字起こし処理フロー

```mermaid
sequenceDiagram
    participant Client
    participant Frontend
    participant API
    participant Queue
    participant Worker
    participant WhisperAPI
    participant Database

    Client->>Frontend: 文字起こし開始
    Frontend->>API: POST /api/transcribe/{uploadId}
    API->>Queue: ジョブをキューに追加
    Queue-->>API: ジョブID返却
    API-->>Frontend: 処理開始通知

    Queue->>Worker: ジョブ実行
    Worker->>Worker: 音声前処理 (FFmpeg)
    Worker->>WhisperAPI: 音声ファイル送信
    WhisperAPI-->>Worker: 文字起こし結果
    Worker->>Worker: 後処理 (医療用語修正)
    Worker->>Database: 結果保存
    Database-->>Worker: 保存完了

    loop 進捗確認
        Frontend->>API: GET /api/transcribe/{id}/status
        API->>Database: 進捗状況取得
        Database-->>API: 進捗データ
        API-->>Frontend: 進捗更新
    end

    Worker->>Database: 処理完了フラグ更新
    Frontend->>API: 最終進捗確認
    API-->>Frontend: 完了通知
    Frontend-->>Client: 結果画面遷移
```

## インフラストラクチャ設計

### 1. デプロイメント構成

```mermaid
graph TB
    subgraph "Development"
        DEV_FE[Localhost:3000]
        DEV_BE[Localhost:8000]
        DEV_DB[(Local PostgreSQL)]
    end

    subgraph "Staging"
        STAGE_FE[Vercel Staging]
        STAGE_BE[Railway Staging]
        STAGE_DB[(Railway Staging DB)]
    end

    subgraph "Production"
        PROD_FE[Vercel Production]
        PROD_BE[Railway Production]
        PROD_DB[(Railway Production DB)]
        PROD_S3[AWS S3 Production]
    end

    subgraph "Monitoring & Logs"
        SENTRY_PROD[Sentry Production]
        LOGS_PROD[Railway Logs]
    end

    DEV_FE --> DEV_BE
    DEV_BE --> DEV_DB

    STAGE_FE --> STAGE_BE
    STAGE_BE --> STAGE_DB

    PROD_FE --> PROD_BE
    PROD_BE --> PROD_DB
    PROD_BE --> PROD_S3
    PROD_BE --> SENTRY_PROD
    PROD_BE --> LOGS_PROD
```

### 2. スケーリング戦略

```mermaid
graph LR
    subgraph "Load Distribution"
        LB[Load Balancer]
        FE1[Frontend Instance 1]
        FE2[Frontend Instance 2]
        FE3[Frontend Instance 3]
    end

    subgraph "Backend Scaling"
        API1[API Server 1]
        API2[API Server 2]
        WORKER1[Worker 1]
        WORKER2[Worker 2]
        WORKER3[Worker 3]
    end

    subgraph "Data Layer"
        DB_MASTER[(Primary DB)]
        DB_REPLICA[(Read Replica)]
        REDIS_CACHE[Redis Cache]
    end

    LB --> FE1
    LB --> FE2
    LB --> FE3
    FE1 --> API1
    FE2 --> API2
    FE3 --> API1
    API1 --> WORKER1
    API2 --> WORKER2
    API1 --> WORKER3
    API1 --> DB_MASTER
    API2 --> DB_MASTER
    WORKER1 --> DB_MASTER
    WORKER2 --> DB_REPLICA
    WORKER3 --> REDIS_CACHE
```

## セキュリティアーキテクチャ

### 1. セキュリティレイヤー

```mermaid
graph TB
    subgraph "Edge Security"
        WAF[Web Application Firewall]
        DDOS[DDoS Protection]
        RATE_LIMIT[Rate Limiting]
    end

    subgraph "Application Security"
        AUTH[Authentication]
        VALIDATION[Input Validation]
        SANITIZATION[Data Sanitization]
    end

    subgraph "Data Security"
        ENCRYPTION[Encryption at Rest]
        TLS[TLS in Transit]
        AUTO_DELETE[Auto File Deletion]
    end

    subgraph "Infrastructure Security"
        VPC[Virtual Private Cloud]
        SECRETS[Secret Management]
        MONITORING[Security Monitoring]
    end

    WAF --> AUTH
    DDOS --> VALIDATION
    RATE_LIMIT --> SANITIZATION
    AUTH --> ENCRYPTION
    VALIDATION --> TLS
    SANITIZATION --> AUTO_DELETE
    ENCRYPTION --> VPC
    TLS --> SECRETS
    AUTO_DELETE --> MONITORING
```

### 2. データプライバシー保護

```mermaid
graph LR
    subgraph "Data Lifecycle"
        UPLOAD[ファイルアップロード]
        PROCESSING[処理中]
        RESULT[結果表示]
        DELETION[自動削除]
    end

    subgraph "Security Measures"
        UNIQUE_ID[一意ID生成]
        ENCRYPTION_STORAGE[暗号化保存]
        ACCESS_TOKEN[アクセストークン]
        SCHEDULED_DELETE[24時間後削除]
    end

    UPLOAD --> UNIQUE_ID
    PROCESSING --> ENCRYPTION_STORAGE
    RESULT --> ACCESS_TOKEN
    DELETION --> SCHEDULED_DELETE
```

## パフォーマンス最適化

### 1. フロントエンド最適化

```mermaid
graph LR
    subgraph "Bundle Optimization"
        CODE_SPLITTING[Code Splitting]
        LAZY_LOADING[Lazy Loading]
        TREE_SHAKING[Tree Shaking]
    end

    subgraph "Caching Strategy"
        SERVICE_WORKER[Service Worker]
        CDN_CACHE[CDN Caching]
        BROWSER_CACHE[Browser Caching]
    end

    subgraph "Performance Monitoring"
        WEB_VITALS[Core Web Vitals]
        PERFORMANCE_API[Performance API]
        LIGHTHOUSE[Lighthouse CI]
    end

    CODE_SPLITTING --> SERVICE_WORKER
    LAZY_LOADING --> CDN_CACHE
    TREE_SHAKING --> BROWSER_CACHE
    SERVICE_WORKER --> WEB_VITALS
    CDN_CACHE --> PERFORMANCE_API
    BROWSER_CACHE --> LIGHTHOUSE
```

### 2. バックエンド最適化

```mermaid
graph TB
    subgraph "Processing Optimization"
        QUEUE_SYSTEM[Queue System]
        PARALLEL_PROCESSING[Parallel Processing]
        RESOURCE_POOLING[Connection Pooling]
    end

    subgraph "Caching Layer"
        REDIS_CACHE[Redis Cache]
        DB_QUERY_CACHE[Query Cache]
        RESULT_CACHE[Result Cache]
    end

    subgraph "Resource Management"
        AUTO_SCALING[Auto Scaling]
        RESOURCE_MONITORING[Resource Monitoring]
        MEMORY_OPTIMIZATION[Memory Management]
    end

    QUEUE_SYSTEM --> REDIS_CACHE
    PARALLEL_PROCESSING --> DB_QUERY_CACHE
    RESOURCE_POOLING --> RESULT_CACHE
    REDIS_CACHE --> AUTO_SCALING
    DB_QUERY_CACHE --> RESOURCE_MONITORING
    RESULT_CACHE --> MEMORY_OPTIMIZATION
```

## 監視・運用アーキテクチャ

### 1. 監視システム

```mermaid
graph TB
    subgraph "Application Monitoring"
        ERROR_TRACKING[Sentry Error Tracking]
        PERFORMANCE_MONITORING[Performance Monitoring]
        USER_ANALYTICS[User Analytics]
    end

    subgraph "Infrastructure Monitoring"
        SERVER_METRICS[Server Metrics]
        DATABASE_MONITORING[Database Monitoring]
        API_MONITORING[API Monitoring]
    end

    subgraph "Alerting System"
        SLACK_ALERTS[Slack Notifications]
        EMAIL_ALERTS[Email Alerts]
        DASHBOARD[Monitoring Dashboard]
    end

    ERROR_TRACKING --> SLACK_ALERTS
    PERFORMANCE_MONITORING --> EMAIL_ALERTS
    USER_ANALYTICS --> DASHBOARD
    SERVER_METRICS --> SLACK_ALERTS
    DATABASE_MONITORING --> EMAIL_ALERTS
    API_MONITORING --> DASHBOARD
```

### 2. ログ管理

```mermaid
graph LR
    subgraph "Log Sources"
        APP_LOGS[Application Logs]
        ACCESS_LOGS[Access Logs]
        ERROR_LOGS[Error Logs]
        AUDIT_LOGS[Audit Logs]
    end

    subgraph "Log Processing"
        LOG_AGGREGATION[Log Aggregation]
        LOG_PARSING[Log Parsing]
        LOG_FILTERING[Log Filtering]
    end

    subgraph "Log Storage & Analysis"
        LOG_STORAGE[Log Storage]
        LOG_SEARCH[Log Search]
        LOG_ANALYTICS[Log Analytics]
    end

    APP_LOGS --> LOG_AGGREGATION
    ACCESS_LOGS --> LOG_PARSING
    ERROR_LOGS --> LOG_FILTERING
    AUDIT_LOGS --> LOG_AGGREGATION
    LOG_AGGREGATION --> LOG_STORAGE
    LOG_PARSING --> LOG_SEARCH
    LOG_FILTERING --> LOG_ANALYTICS
```

## 開発・デプロイメントパイプライン

### 1. CI/CD パイプライン

```mermaid
graph LR
    subgraph "Development"
        LOCAL_DEV[Local Development]
        FEATURE_BRANCH[Feature Branch]
        PULL_REQUEST[Pull Request]
    end

    subgraph "CI Pipeline"
        AUTOMATED_TESTS[Automated Tests]
        TYPE_CHECK[Type Checking]
        LINTING[Code Linting]
        BUILD[Build Process]
    end

    subgraph "CD Pipeline"
        STAGING_DEPLOY[Staging Deploy]
        E2E_TESTS[E2E Tests]
        PRODUCTION_DEPLOY[Production Deploy]
        HEALTH_CHECK[Health Check]
    end

    LOCAL_DEV --> FEATURE_BRANCH
    FEATURE_BRANCH --> PULL_REQUEST
    PULL_REQUEST --> AUTOMATED_TESTS
    AUTOMATED_TESTS --> TYPE_CHECK
    TYPE_CHECK --> LINTING
    LINTING --> BUILD
    BUILD --> STAGING_DEPLOY
    STAGING_DEPLOY --> E2E_TESTS
    E2E_TESTS --> PRODUCTION_DEPLOY
    PRODUCTION_DEPLOY --> HEALTH_CHECK
```

### 2. 環境管理

```mermaid
graph TB
    subgraph "Environment Configuration"
        ENV_VARIABLES[Environment Variables]
        CONFIG_FILES[Configuration Files]
        SECRETS_MANAGEMENT[Secrets Management]
    end

    subgraph "Deployment Targets"
        LOCAL[Local Environment]
        STAGING[Staging Environment]
        PRODUCTION[Production Environment]
    end

    subgraph "Configuration Management"
        VERSION_CONTROL[Version Control]
        CONFIG_VALIDATION[Config Validation]
        ROLLBACK_STRATEGY[Rollback Strategy]
    end

    ENV_VARIABLES --> LOCAL
    CONFIG_FILES --> STAGING
    SECRETS_MANAGEMENT --> PRODUCTION
    LOCAL --> VERSION_CONTROL
    STAGING --> CONFIG_VALIDATION
    PRODUCTION --> ROLLBACK_STRATEGY
```

## 災害復旧・事業継続計画

### 1. バックアップ戦略

```mermaid
graph TB
    subgraph "Data Backup"
        DB_BACKUP[Database Backup]
        S3_BACKUP[File Storage Backup]
        CONFIG_BACKUP[Configuration Backup]
    end

    subgraph "Backup Schedule"
        DAILY_BACKUP[Daily Incremental]
        WEEKLY_BACKUP[Weekly Full]
        MONTHLY_BACKUP[Monthly Archive]
    end

    subgraph "Recovery Testing"
        BACKUP_VALIDATION[Backup Validation]
        RECOVERY_DRILL[Recovery Drill]
        DOCUMENTATION[Recovery Documentation]
    end

    DB_BACKUP --> DAILY_BACKUP
    S3_BACKUP --> WEEKLY_BACKUP
    CONFIG_BACKUP --> MONTHLY_BACKUP
    DAILY_BACKUP --> BACKUP_VALIDATION
    WEEKLY_BACKUP --> RECOVERY_DRILL
    MONTHLY_BACKUP --> DOCUMENTATION
```

### 2. 高可用性設計

```mermaid
graph LR
    subgraph "Redundancy"
        MULTI_REGION[Multi-Region Setup]
        DB_REPLICATION[Database Replication]
        CDN_FAILOVER[CDN Failover]
    end

    subgraph "Health Monitoring"
        HEALTH_CHECKS[Health Checks]
        AUTOMATIC_FAILOVER[Auto Failover]
        ALERT_SYSTEM[Alert System]
    end

    subgraph "Recovery Procedures"
        INCIDENT_RESPONSE[Incident Response]
        ROLLBACK_PLAN[Rollback Plan]
        COMMUNICATION_PLAN[Communication Plan]
    end

    MULTI_REGION --> HEALTH_CHECKS
    DB_REPLICATION --> AUTOMATIC_FAILOVER
    CDN_FAILOVER --> ALERT_SYSTEM
    HEALTH_CHECKS --> INCIDENT_RESPONSE
    AUTOMATIC_FAILOVER --> ROLLBACK_PLAN
    ALERT_SYSTEM --> COMMUNICATION_PLAN
```

---

**作成日**: 2025年9月19日
**バージョン**: 1.0
**承認者**: システムアーキテクト
**次回見直し**: システム実装開始時