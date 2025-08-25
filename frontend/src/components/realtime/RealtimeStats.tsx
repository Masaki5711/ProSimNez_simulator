import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Card, CardContent, Grid, Typography, LinearProgress } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import dayjs from 'dayjs';

const RealtimeStats: React.FC = () => {
  const { isRunning, isPaused, speed, currentTime } = useSelector(
    (state: RootState) => state.simulation
  );
  const inventoryData = useSelector((state: RootState) => state.monitoring.inventoryData);
  const equipmentStatus = useSelector((state: RootState) => state.monitoring.equipmentStatus);
  const kpiData = useSelector((state: RootState) => state.monitoring.kpiData);

  // デバッグ用：Redux storeの変更を監視（一部のみ）
  React.useEffect(() => {
    console.log('[RealtimeStats] 経過時間更新:', currentTime, '実行中:', isRunning);
  }, [currentTime, isRunning]);

  const totalInventory = Object.values(inventoryData).reduce((sum, qty) => sum + qty, 0);
  const runningEquipment = Object.values(equipmentStatus).filter(status => status === 'running').length;
  const totalEquipment = Object.values(equipmentStatus).length;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <UpdateIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">リアルタイム状態</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              シミュレーション: {isRunning ? (isPaused ? '一時停止' : '実行中') : '停止'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              経過時間: {(() => {
                // 異常値チェック（24時間を超える場合は0分0秒を表示）
                const maxTime = 24 * 60 * 60; // 24時間（秒）
                if (currentTime > maxTime || currentTime < 0 || isNaN(currentTime)) {
                  console.warn('異常な経過時間を検出:', currentTime);
                  return '0分0秒';
                }
                return `${Math.floor(currentTime / 60)}分${currentTime % 60}秒`;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              実行速度: {speed}x
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingUpIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6">在庫状況</Typography>
            </Box>
            <Typography variant="h4" color="primary">
              {totalInventory}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              総在庫数
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                バッファ数: {Object.keys(inventoryData).length}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SpeedIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6">設備稼働</Typography>
            </Box>
            <Typography variant="h4" color="primary">
              {runningEquipment}/{totalEquipment}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              稼働中設備
            </Typography>
            <Box sx={{ mt: 1 }}>
              <LinearProgress 
                variant="determinate" 
                value={totalEquipment > 0 ? (runningEquipment / totalEquipment) * 100 : 0}
                color={runningEquipment > 0 ? 'success' : 'error'}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SpeedIcon color="info" sx={{ mr: 1 }} />
              <Typography variant="h6">シミュレーション</Typography>
            </Box>
            <Typography variant="h4" color="primary">
              ×{speed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              実行速度
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                スループット: {kpiData.throughput}個/時
              </Typography>
              <Typography variant="body2">
                OEE: {kpiData.oee.toFixed(1)}%
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default RealtimeStats;