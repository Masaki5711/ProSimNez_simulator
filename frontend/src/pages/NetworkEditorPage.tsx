import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Paper, Typography } from '@mui/material';
import { RootState } from '../store';
import NetworkEditor from '../components/network/NetworkEditor';

const NetworkEditorPage: React.FC = () => {
  const currentProject = useSelector((state: RootState) => state.project.currentProject);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={{ p: 2, flexShrink: 0 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {currentProject ? currentProject.name : 'ネットワーク編集'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {currentProject
            ? `プロジェクト「${currentProject.name}」の工程ネットワークを設計・編集します`
            : '製造ラインの工程ネットワークを設計・編集します'}
        </Typography>
      </Paper>

      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <NetworkEditor />
        </Box>
      </Box>
    </Box>
  );
};

export default NetworkEditorPage;