import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

const AnalyticsPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          分析
        </Typography>
        <Typography variant="body1" color="text.secondary">
          シミュレーション結果の分析とレポート機能がここに表示されます。
        </Typography>
      </Paper>
    </Box>
  );
};

export default AnalyticsPage;