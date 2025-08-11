import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Chip, Tooltip } from '@mui/material';
import {
  WifiOff as DisconnectedIcon,
  Wifi as ConnectedIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';

const ConnectionStatus: React.FC = () => {
  const { isRunning, isPaused } = useSelector((state: RootState) => state.simulation);

  const status = isRunning ? (isPaused ? 'paused' : 'running') : 'stopped';
  const statusLabel = isRunning ? (isPaused ? '一時停止' : '実行中') : '停止中';
  const color = status === 'running' ? 'success' : status === 'paused' ? 'warning' : 'error';

  return (
    <Tooltip title={`シミュレーション: ${statusLabel}`}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Chip
          icon={status === 'running' ? <ConnectedIcon /> : <DisconnectedIcon />}
          label={statusLabel}
          color={color}
          size="small"
          variant="outlined"
        />
      </Box>
    </Tooltip>
  );
};

export default ConnectionStatus;