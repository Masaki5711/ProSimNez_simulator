import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  TrendingUp as EfficiencyIcon,
  AccountTree as FlowIcon,
} from '@mui/icons-material';
import { IEAnalysisResult, ProcessNodeData } from '../../types/networkEditor';

interface IEAnalysisPanelProps {
  nodes: any[];
  edges: any[];
  analysis?: IEAnalysisResult;
}

const IEAnalysisPanel: React.FC<IEAnalysisPanelProps> = ({ nodes, edges, analysis }) => {
  // 簡易分析関数
  const calculateMetrics = () => {
    if (nodes.length === 0) return null;
    
    // タクトタイム計算（最もサイクルタイムが長い工程）
    const maxCycleTime = Math.max(...nodes.map(n => n.data.cycleTime || 0));
    
    // 総設備数
    const totalEquipment = nodes.reduce((sum, n) => sum + (n.data.equipmentCount || 0), 0);
    
    // 総作業者数
    const totalOperators = nodes.reduce((sum, n) => sum + (n.data.operatorCount || 0), 0);
    
    // 総搬送距離
    const totalDistance = edges.reduce((sum, e) => sum + (e.data?.distance || 0), 0);
    
    // 平均稼働率
    const avgAvailability = nodes.reduce((sum, n) => sum + (n.data.availability || 0), 0) / nodes.length;
    
    return {
      taktTime: maxCycleTime,
      totalEquipment,
      totalOperators,
      totalDistance,
      avgAvailability,
    };
  };
  
  const metrics = calculateMetrics();
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="h6" gutterBottom>
          IE分析結果
        </Typography>
      </CardContent>
      
      <Divider />
      
      <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {!metrics ? (
          <Alert severity="info">
            工程を配置してください
          </Alert>
        ) : (
          <>
            {/* 基本メトリクス */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                基本指標
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SpeedIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="タクトタイム"
                    secondary={`${metrics.taktTime}秒`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <FlowIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="工程数"
                    secondary={`${nodes.length}工程`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <EfficiencyIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="平均可動率"
                    secondary={`${metrics.avgAvailability.toFixed(1)}%`}
                  />
                </ListItem>
              </List>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            {/* リソース情報 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                リソース
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`設備: ${metrics.totalEquipment}台`}
                  size="small"
                  icon={<CheckIcon />}
                />
                <Chip
                  label={`作業者: ${metrics.totalOperators}人`}
                  size="small"
                  icon={<CheckIcon />}
                />
                <Chip
                  label={`総距離: ${metrics.totalDistance}m`}
                  size="small"
                  icon={<TimelineIcon />}
                />
              </Box>
            </Box>
            
            {/* ボトルネック分析 */}
            {analysis && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    ボトルネック分析
                  </Typography>
                  {analysis.bottleneckProcess ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        ボトルネック工程: <strong>{analysis.bottleneckProcess}</strong>
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      明確なボトルネックは検出されませんでした
                    </Alert>
                  )}
                </Box>
                
                {/* 効率指標 */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    効率指標
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">ラインバランス率</Typography>
                      <Typography variant="body2">{analysis.lineBalanceRate.toFixed(1)}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={analysis.lineBalanceRate}
                      color={analysis.lineBalanceRate > 80 ? 'success' : 'warning'}
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">付加価値比率</Typography>
                      <Typography variant="body2">{analysis.valueAddedRatio.toFixed(1)}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={analysis.valueAddedRatio}
                      color={analysis.valueAddedRatio > 50 ? 'success' : 'error'}
                    />
                  </Box>
                  
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">総合効率</Typography>
                      <Typography variant="body2">{analysis.overallEfficiency.toFixed(1)}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={analysis.overallEfficiency}
                      color="primary"
                    />
                  </Box>
                </Box>
              </>
            )}
            
            {/* 改善提案 */}
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                改善提案
              </Typography>
              <List dense>
                {metrics.avgAvailability < 80 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="可動率が低い"
                      secondary="予防保全の強化を検討してください"
                    />
                  </ListItem>
                )}
                {metrics.totalDistance > 500 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="搬送距離が長い"
                      secondary="レイアウトの最適化を検討してください"
                    />
                  </ListItem>
                )}
                {nodes.length > 10 && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="工程数が多い"
                      secondary="工程統合の可能性を検討してください"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default IEAnalysisPanel;