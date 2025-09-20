import React from 'react'
import { Box, CircularProgress, Typography, LinearProgress } from '@mui/material'

interface LoadingSpinnerProps {
  message?: string
  progress?: number
  variant?: 'spinner' | 'linear' | 'both'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '読み込み中...',
  progress,
  variant = 'spinner',
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 4,
      }}
    >
      {(variant === 'spinner' || variant === 'both') && (
        <CircularProgress
          size={48}
          thickness={4}
          {...(progress !== undefined && {
            variant: 'determinate',
            value: progress
          })}
        />
      )}

      {(variant === 'linear' || variant === 'both') && progress !== undefined && (
        <Box sx={{ width: '100%', maxWidth: 300 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}

      <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
        {message}
      </Typography>
    </Box>
  )
}