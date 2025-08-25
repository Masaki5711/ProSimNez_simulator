import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  TrendingDown,
  Speed,
  Inventory,
  Factory,
  LocalShipping,
  Warning,
  CheckCircle,
  Error,
  Schedule,
  Refresh,
} from '@mui/icons-material';

interface KPIMonitorPanelProps {
  realtimeData: any;
  simulationStatus: any;
  networkData: any;
}

interface KPIData {
  oee: number; // Overall Equipment Effectiveness
  throughput: number; // スループット (個/時)
  cycleTime: number; // 平均サイクルタイム (秒)
  utilization: number; // 設備稼働率 (%)
  wip: number; // Work In Progress (個)
  leadTime: number; // リードタイム (分)
  defectRate: number; // 不良率 (%)
  inventoryTurnover: number; // 在庫回転率
}

const KPIMonitorPanel: React.FC<KPIMonitorPanelProps> = ({
  realtimeData,
  simulationStatus,
  networkData,
}) => {
  const [kpiData, setKpiData] = useState<KPIData>({
    oee: 0,
    throughput: 0,
    cycleTime: 0,
    utilization: 0,
    wip: 0,
    leadTime: 0,
    defectRate: 0,
    inventoryTurnover: 0,
  });

  const [trends, setTrends] = useState<{ [key: string]: 'up' | 'down' | 'stable' }>({});
  const [alerts, setAlerts] = useState<any[]>([]);

  // リアルタイムデータからKPI計算
  useEffect(() => {
    if (realtimeData && networkData) {
      const newKpiData = calculateKPIs(realtimeData, networkData);
      
      // トレンド計算
      const newTrends: { [key: string]: 'up' | 'down' | 'stable' } = {};
      Object.keys(newKpiData).forEach(key => {
        const oldValue = kpiData[key as keyof KPIData];
        const newValue = newKpiData[key as keyof KPIData];
        if (newValue > oldValue * 1.05) newTrends[key] = 'up';
        else if (newValue < oldValue * 0.95) newTrends[key] = 'down';
        else newTrends[key] = 'stable';
      });

      setKpiData(newKpiData);
      setTrends(newTrends);

      // アラート生成
      generateAlerts(newKpiData);
    }
  }, [realtimeData, networkData]);

  // KPI計算ロジック
  const calculateKPIs = (realtime: any, network: any): KPIData => {
    const nodes = network?.nodes || [];
    const edges = network?.edges || [];
    
    // 基本データの取得
    const processNodes = nodes.filter((n: any) => n.type === 'process');
    const storeNodes = nodes.filter((n: any) => n.type === 'store' || n.type === 'buffer');
    
    // スループット計算
    const totalProduction = storeNodes.reduce((sum: number, node: any) => {
      const nodeData = realtime?.nodes?.[node.id];
      return sum + (nodeData?.totalProduced || 0);
    }, 0);
    
    // 稼働率計算
    const runningProcesses = processNodes.filter((node: any) => {
      const nodeData = realtime?.nodes?.[node.id];
      return nodeData?.status === 'running';
    }).length;
    const utilization = processNodes.length > 0 ? (runningProcesses / processNodes.length) * 100 : 0;
    
    // WIP計算
    const wip = processNodes.reduce((sum: number, node: any) => {
      const nodeData = realtime?.nodes?.[node.id];
      return sum + (nodeData?.currentWIP || 0);
    }, 0);
    
    // 平均サイクルタイム計算
    const totalCycleTime = processNodes.reduce((sum: number, node: any) => {
      return sum + (node.data?.cycleTime || 0);
    }, 0);
    const avgCycleTime = processNodes.length > 0 ? totalCycleTime / processNodes.length : 0;
    
    // OEE計算 (簡易版)
    const availability = utilization / 100;
    const performance = 0.9; // 仮定値
    const quality = 0.95; // 仮定値
    const oee = availability * performance * quality * 100;
    
    // その他のKPI
    const simulationTime = realtime?.simulationTime || 1; // 時間
    const throughput = totalProduction / simulationTime;
    const leadTime = avgCycleTime * processNodes.length / 60; // 分単位
    const defectRate = Math.random() * 2; // 仮データ
    const inventoryTurnover = totalProduction / Math.max(wip, 1);

    return {
      oee: Math.round(oee * 10) / 10,
      throughput: Math.round(throughput * 10) / 10,
      cycleTime: Math.round(avgCycleTime * 10) / 10,
      utilization: Math.round(utilization * 10) / 10,
      wip,
      leadTime: Math.round(leadTime * 10) / 10,
      defectRate: Math.round(defectRate * 10) / 10,
      inventoryTurnover: Math.round(inventoryTurnover * 10) / 10,
    };
  };

  // アラート生成
  const generateAlerts = (kpi: KPIData) => {
    const newAlerts: any[] = [];

    if (kpi.oee < 60) {
      newAlerts.push({
        severity: 'error',
        message: `OEE低下: ${kpi.oee}% (目標: 80%以上)`,
        icon: <Error />,
      });
    }

    if (kpi.utilization < 70) {
      newAlerts.push({
        severity: 'warning',
        message: `設備稼働率低下: ${kpi.utilization}% (目標: 85%以上)`,
        icon: <Warning />,
      });
    }

    if (kpi.wip > 50) {
      newAlerts.push({
        severity: 'warning',
        message: `WIP過多: ${kpi.wip}個 (目標: 30個以下)`,
        icon: <Warning />,
      });
    }

    if (kpi.defectRate > 3) {
      newAlerts.push({
        severity: 'error',
        message: `不良率上昇: ${kpi.defectRate}% (目標: 2%以下)`,
        icon: <Error />,
      });
    }

    setAlerts(newAlerts);
  };

  // KPIカードコンポーネント
  const KPICard = ({ 
    title, 
    value, 
    unit, 
    icon, 
    trend, 
    target, 
    color = 'primary' 
  }: {
    title: string;
    value: number;
    unit: string;
    icon: React.ReactNode;
    trend: 'up' | 'down' | 'stable';
    target?: number;
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  }) => {
    const isOnTarget = target ? value >= target : true;
    const cardColor = isOnTarget ? color : 'warning';

    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ color: `${cardColor}.main`, mr: 1 }}>
              {icon}
            </Box>
            <Typography variant="subtitle2" color="text.secondary">
              {title}
            </Typography>
            <Box sx={{ ml: 'auto' }}>
              {trend === 'up' && <TrendingUp color="success" fontSize="small" />}
              {trend === 'down' && <TrendingDown color="error" fontSize="small" />}
              {trend === 'stable' && <div style={{ width: 20 }} />}
            </Box>
          </Box>
          
          <Typography variant="h4" fontWeight="bold" color={`${cardColor}.main`}>
            {value}
            <Typography component="span" variant="body2" color="text.secondary">
              {unit}
            </Typography>
          </Typography>
          
          {target && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                目標: {target}{unit}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min((value / target) * 100, 100)}
                color={isOnTarget ? 'success' : 'warning'}
                sx={{ height: 4, borderRadius: 1, mt: 0.5 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Assessment color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6" fontWeight="bold">
          リアルタイムKPI
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title="データ更新">
            <IconButton size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* メインKPI */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12}>
          <KPICard
            title="OEE"
            value={kpiData.oee}
            unit="%"
            icon={<Assessment />}
            trend={trends.oee}
            target={80}
            color="primary"
          />
        </Grid>
        <Grid item xs={6}>
          <KPICard
            title="スループット"
            value={kpiData.throughput}
            unit="個/時"
            icon={<Speed />}
            trend={trends.throughput}
            color="success"
          />
        </Grid>
        <Grid item xs={6}>
          <KPICard
            title="稼働率"
            value={kpiData.utilization}
            unit="%"
            icon={<Factory />}
            trend={trends.utilization}
            target={85}
            color="info"
          />
        </Grid>
      </Grid>

      {/* サブKPI */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <Card>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                サイクルタイム
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {kpiData.cycleTime}秒
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                WIP
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {kpiData.wip}個
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                リードタイム
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {kpiData.leadTime}分
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                不良率
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="error.main">
                {kpiData.defectRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* アラート */}
      <Card sx={{ mb: 2 }}>
        <CardHeader 
          title="アラート" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<Warning color="warning" />}
        />
        <CardContent sx={{ p: 1 }}>
          {alerts.length > 0 ? (
            <List dense>
              {alerts.map((alert, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {alert.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={alert.message}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: alert.severity === 'error' ? 'error.main' : 'warning.main',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircle color="success" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                現在アラートはありません
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 生産計画進捗 */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardHeader 
          title="生産計画進捗" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<Schedule color="primary" />}
        />
        <CardContent sx={{ flex: 1, overflow: 'auto' }}>
          {/* TODO: 実際の生産計画データに基づいて実装 */}
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              生産計画データを読み込み中...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default KPIMonitorPanel;