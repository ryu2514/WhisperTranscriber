import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Paper, Alert } from '@mui/material'
import { Refresh, Home, BugReport } from '@mui/icons-material'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // エラーログの送信（本番環境）
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo)
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      })
    } catch (reportError) {
      console.error('Failed to report error:', reportError)
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            bgcolor: 'grey.50',
          }}
        >
          <Paper sx={{ p: 4, maxWidth: 600, width: '100%' }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                予期しないエラーが発生しました
              </Typography>
              <Typography variant="body2">
                申し訳ございませんが、アプリケーションでエラーが発生しました。
                ページを再読み込みするか、ホームに戻ってお試しください。
              </Typography>
            </Alert>

            {import.meta.env.DEV && this.state.error && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom color="error">
                  エラー詳細（開発環境のみ表示）:
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'grey.100',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  <pre>{this.state.error.stack}</pre>
                </Paper>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Refresh />}
                onClick={this.handleReload}
              >
                ページを再読み込み
              </Button>
              <Button
                variant="outlined"
                startIcon={<Home />}
                onClick={this.handleGoHome}
              >
                ホームに戻る
              </Button>
              {import.meta.env.DEV && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<BugReport />}
                  onClick={() => console.log('Error:', this.state.error, this.state.errorInfo)}
                >
                  コンソールでエラー詳細を確認
                </Button>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block', textAlign: 'center' }}>
              このエラーが継続する場合は、サポートまでお問い合わせください。
            </Typography>
          </Paper>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary