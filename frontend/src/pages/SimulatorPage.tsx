import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

const SimulatorPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          シミュレーター
        </Typography>
        <Typography variant="body1" color="text.secondary">
          生産ラインのシミュレーション機能がここに表示されます。
        </Typography>
      </Paper>
    </Box>
  );
};

export default SimulatorPage;