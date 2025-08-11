import React from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Chip,
  Grid,
  Paper,
  Typography,
  LinearProgress,
} from '@mui/material';
import { RootState } from '../../store';

const EquipmentStatus: React.FC = () => {
  const equipmentStatus = useSelector((state: RootState) => state.monitoring.equipmentStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'idle':
        return 'default';
      case 'setup':
        return 'warning';
      case 'breakdown':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running':
        return '稼働中';
      case 'idle':
        return '待機中';
      case 'setup':
        return '段取り中';
      case 'breakdown':
        return '故障';
      default:
        return status;
    }
  };

  // 設備状態データを整理（新しい状態構造では単純なノードID→ステータスのマッピング）
  const equipmentByProcess: { [processId: string]: { [equipmentId: string]: string } } = {};
  
  // equipmentStatusから設備データを作成（簡易版）
  Object.entries(equipmentStatus).forEach(([nodeId, status]) => {
    // ノードIDを工程IDとして使用（実際の実装では適切な工程グループ化が必要）
    const processId = nodeId.split('-')[0] || 'default'; // ID形式: "process1-equipment1"
    if (!equipmentByProcess[processId]) {
      equipmentByProcess[processId] = {};
    }
    equipmentByProcess[processId][nodeId] = status;
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        設備稼働状況
      </Typography>
      
      {Object.keys(equipmentByProcess).length === 0 ? (
        <Typography color="text.secondary">
          設備データがありません
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {Object.entries(equipmentByProcess).map(([processId, equipments]) => (
            <Grid item xs={12} md={6} key={processId}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  工程: {processId}
                </Typography>
                <Grid container spacing={1}>
                  {Object.entries(equipments).map(([equipmentId, status]) => (
                    <Grid item xs={12} key={equipmentId}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ minWidth: 100 }}>
                          {equipmentId}:
                        </Typography>
                        <Chip
                          label={getStatusLabel(status)}
                          color={getStatusColor(status)}
                          size="small"
                        />
                        {status === 'running' && (
                          <Box sx={{ flexGrow: 1, ml: 2 }}>
                            <LinearProgress color="success" />
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default EquipmentStatus;