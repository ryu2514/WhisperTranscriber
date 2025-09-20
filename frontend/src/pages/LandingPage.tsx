import React from 'react'
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material'
import {
  RecordVoiceOver,
  MoneyOff,
  Speed,
  Security,
  PhoneAndroid,
  CheckCircle,
  AudioFile,
  VideoFile,
  Description,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

export const LandingPage: React.FC = () => {
  const navigate = useNavigate()

  const features = [
    {
      icon: <MoneyOff color="primary" />,
      title: '完全無料',
      description: '永続的な無料提供で経済的負担なし',
    },
    {
      icon: <Speed color="primary" />,
      title: '高速処理',
      description: '1時間の音声を5分以内で文字起こし',
    },
    {
      icon: <RecordVoiceOver color="primary" />,
      title: '高精度',
      description: '医療専門用語対応で95%以上の認識精度',
    },
    {
      icon: <Security color="primary" />,
      title: 'プライバシー保護',
      description: '24時間後自動削除で安心・安全',
    },
    {
      icon: <PhoneAndroid color="primary" />,
      title: 'レスポンシブ対応',
      description: 'PC・タブレット・スマホで利用可能',
    },
    {
      icon: <Description color="primary" />,
      title: '多形式出力',
      description: 'テキスト・SRT字幕・マークダウン対応',
    },
  ]

  const supportedFormats = [
    { icon: <AudioFile />, label: 'MP3', description: '音声ファイル' },
    { icon: <AudioFile />, label: 'WAV', description: '音声ファイル' },
    { icon: <AudioFile />, label: 'M4A', description: '音声ファイル' },
    { icon: <VideoFile />, label: 'MP4', description: '動画ファイル' },
    { icon: <VideoFile />, label: 'MOV', description: '動画ファイル' },
    { icon: <VideoFile />, label: 'AVI', description: '動画ファイル' },
  ]

  const howToSteps = [
    '音声・動画ファイルをアップロード',
    'AI（Whisper）が自動で文字起こし',
    '結果を編集して好みの形式で出力',
  ]

  return (
    <Container maxWidth="lg">
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h1" component="h1" gutterBottom>
          🎙️ WhisperTranscriber
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph sx={{ mb: 4 }}>
          セラピスト・医療従事者向け完全無料音声文字起こしサービス
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/upload')}
            sx={{ minWidth: 200 }}
          >
            今すぐ始める
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="#how-to-use"
            sx={{ minWidth: 200 }}
          >
            使い方を見る
          </Button>
        </Box>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 6 }}>
        <Typography variant="h2" component="h2" textAlign="center" gutterBottom>
          6つの特徴
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card sx={{ height: '100%', textAlign: 'center' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" component="h3" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* How to Use Section */}
      <Box sx={{ py: 6 }} id="how-to-use">
        <Typography variant="h2" component="h2" textAlign="center" gutterBottom>
          使い方
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2, alignItems: 'center' }}>
          {howToSteps.map((step, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
                <Typography variant="h4" color="primary" gutterBottom>
                  {index + 1}
                </Typography>
                <Typography variant="h6" gutterBottom>
                  {step}
                </Typography>
                {index < howToSteps.length - 1 && (
                  <Typography variant="h5" sx={{ mt: 2, display: { xs: 'none', md: 'block' } }}>
                    ➜
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Supported Formats Section */}
      <Box sx={{ py: 6 }}>
        <Typography variant="h2" component="h2" textAlign="center" gutterBottom>
          対応ファイル形式
        </Typography>
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {supportedFormats.map((format, index) => (
            <Grid item xs={6} md={2} key={index}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Box sx={{ mb: 1 }}>{format.icon}</Box>
                <Typography variant="h6">{format.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {format.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            最大ファイルサイズ: 500MB | 最大時間: 3時間
          </Typography>
        </Box>
      </Box>

      {/* Therapist Benefits Section */}
      <Box sx={{ py: 6 }}>
        <Typography variant="h2" component="h2" textAlign="center" gutterBottom>
          セラピスト向け特典
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                📚 医療専門用語対応
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="理学療法・作業療法専門用語" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="解剖学・運動学用語" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="リハビリテーション関連用語" />
                </ListItem>
              </List>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🎯 教育コンテンツ最適化
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="セミナー音声の効率的文字化" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="字幕付き動画作成支援" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="アクセシビリティ向上" />
                </ListItem>
              </List>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 6, textAlign: 'center', bgcolor: 'primary.main', color: 'white', borderRadius: 2, mb: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          セラピストの学習をサポート
        </Typography>
        <Typography variant="body1" paragraph>
          "過去の自分と同じように運動療法に悩むセラピストを支援したい"
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/upload')}
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'grey.100',
            },
          }}
        >
          無料で文字起こしを始める
        </Button>
      </Box>
    </Container>
  )
}