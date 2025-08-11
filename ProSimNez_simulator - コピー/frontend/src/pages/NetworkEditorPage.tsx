import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import NetworkEditor from '../components/network/NetworkEditor';

const NetworkEditorPage: React.FC = () => {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ネットワーク編集
        </Typography>
        <Typography variant="body1" color="text.secondary">
          製造ラインの工程ネットワークを設計・編集します
        </Typography>
      </Paper>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <NetworkEditor />
      </Box>
    </Box>
  );
};

export default NetworkEditorPage;