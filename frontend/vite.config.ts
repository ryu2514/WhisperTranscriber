import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Material-UI を別チャンクに分離
          'mui-core': ['@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'],
          'mui-icons': ['@mui/icons-material'],
          // React関連を別チャンクに分離
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // ユーティリティライブラリを別チャンクに分離
          'utils': ['axios'],
        },
      },
    },
    // チャンクサイズ警告の制限を調整
    chunkSizeWarningLimit: 1000,
  },
  // 本番環境での最適化
  esbuild: {
    drop: ['console', 'debugger'],
  },
})
