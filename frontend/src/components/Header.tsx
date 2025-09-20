import React from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
} from '@mui/material'
import { RecordVoiceOver, GitHub, Home } from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'

export const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const isHomePage = location.pathname === '/'

  return (
    <AppBar position="static" elevation={1}>
      <Container maxWidth="lg">
        <Toolbar>
          <RecordVoiceOver sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            WhisperTranscriber
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {!isHomePage && (
              <Button
                color="inherit"
                startIcon={<Home />}
                onClick={() => navigate('/')}
              >
                ホーム
              </Button>
            )}

            <Button
              color="inherit"
              startIcon={<GitHub />}
              href="https://github.com/kobayashiryuju/whisper-transcriber"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Button>

            {isHomePage && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => navigate('/upload')}
                sx={{
                  borderColor: 'white',
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                今すぐ始める
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}