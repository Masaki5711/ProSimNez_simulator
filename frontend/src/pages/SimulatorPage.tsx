import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Container,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  Settings,
  Timeline,
  Factory,
  Speed,
  Assessment,
  Warning,
  CheckCircle,
  Error,
  Info,
} from '@mui/icons-material';
import SimulationControl from '../components/simulation/SimulationControl';
import RealtimeStats from '../components/realtime/RealtimeStats';
import KPIPanel from '../components/monitoring/KPIPanel';
import EventLog from '../components/monitoring/EventLog';
import { useWebSocket } from '../hooks/useWebSocket';

interface SimulationStatus {
  status: string;
  current_time: string;
  speed: number;
  is_connected: boolean;
}

interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  components?: {
    processes: number;
    buffers: number;
    products: number;
    total_nodes: number;
  };
  simulation_ready?: boolean;
}

const SimulatorPage: React.FC = () => {
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const { sendMessage, isConnected } = useWebSocket();

  // シミュレーション状況を取得
  const fetchSimulationStatus = async () => {
    try {
      const response = await fetch('/api/simulation/master/status');
      if (response.ok) {
        const status = await response.json();
        setSimulationStatus(status);
        setError(null);
      } else {
        throw new window.Error('シミュレーション状況の取得に失敗しました');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // シミュレーション開始
  const startSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulation/master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: '1',  // デフォルトプロジェクトID
          name: 'プロダクションシミュレーション',
          description: 'フロントエンドから開始されたシミュレーション',
          duration_hours: 24.0,
          time_scale: 1.0,
          enable_detailed_process: true,
          enable_material_flow: true,
          enable_transport: true,
          enable_quality: true,
          enable_scheduling: true,
          real_time_monitoring: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`プロジェクト ${result.project_id} のシミュレーション開始: ${result.simulation_id}`);
        await fetchSimulationStatus();
        setError(null);
      } else {
        throw new window.Error('シミュレーションの開始に失敗しました');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // シミュレーション停止
  const stopSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulation/master/stop', { method: 'POST' });
      if (response.ok) {
        alert('シミュレーション停止しました');
        await fetchSimulationStatus();
        setError(null);
      } else {
        throw new window.Error('シミュレーションの停止に失敗しました');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // シミュレーション一時停止
  const pauseSimulation = async () => {
    try {
      const response = await fetch('/api/simulation/pause', { method: 'POST' });
      if (response.ok) {
        await fetchSimulationStatus();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // WebSocket接続テスト
  const testWebSocketConnection = () => {
    if (isConnected) {
      sendMessage({ type: 'ping' });
      alert('WebSocket接続テストメッセージを送信しました');
    } else {
      alert('WebSocketが切断されています');
    }
  };

  // バックエンドサーバーのヘルスチェック
  const checkBackendHealth = async () => {
    try {
      const response = await fetch('/api/simulation/status');
      if (response.ok) {
        alert('バックエンドサーバーは正常に動作しています');
      } else {
        alert(`バックエンドサーバーエラー: ${response.status}`);
      }
    } catch (error) {
      alert('バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。');
    }
  };

  // プロジェクト情報を取得
  const fetchProjectInfo = async () => {
    try {
      const response = await fetch('/api/projects/1');
      if (response.ok) {
        const data = await response.json();
        setProjectInfo(data.project_info);
      }
    } catch (error) {
      console.error('プロジェクト情報取得エラー:', error);
    }
  };

  // 初期読み込み
  useEffect(() => {
    fetchSimulationStatus();
    fetchProjectInfo();
    const interval = setInterval(fetchSimulationStatus, 5000); // 5秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'success';
      case 'paused':
        return 'warning';
      case 'stopped':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return <CheckCircle color="success" />;
      case 'paused':
        return <Warning color="warning" />;
      case 'stopped':
        return <Error color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={3}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              <Factory sx={{ mr: 1, verticalAlign: 'bottom' }} />
              生産ラインシミュレーター
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {projectInfo ? `プロジェクト: ${projectInfo.name}` : 'リアルタイムでシミュレーションを実行・監視します'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchSimulationStatus}
            >
              状況更新
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={checkBackendHealth}
            >
              サーバー確認
            </Button>
          </Stack>
        </Box>

        {/* プロジェクト情報 */}
        {projectInfo && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 プロジェクト情報
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Typography variant="body1" gutterBottom>
                    <strong>説明:</strong> {projectInfo.description}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  {projectInfo.components && (
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        🏭 工程数: {projectInfo.components.processes}
                      </Typography>
                      <Typography variant="body2">
                        📦 バッファ数: {projectInfo.components.buffers}
                      </Typography>
                      <Typography variant="body2">
                        🔗 総ノード数: {projectInfo.components.total_nodes}
                      </Typography>
                      <Chip
                        label={projectInfo.simulation_ready ? 'シミュレーション対応' : 'シミュレーション未対応'}
                        color={projectInfo.simulation_ready ? 'success' : 'warning'}
                        size="small"
                      />
                    </Stack>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* シミュレーション状況 */}
        <Card>
          <CardHeader
            avatar={simulationStatus ? getStatusIcon(simulationStatus.status) : <Info />}
            title="シミュレーション状況"
            subheader={`最終更新: ${new Date().toLocaleTimeString()}`}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    状態
                  </Typography>
                  <Chip
                    label={simulationStatus?.status || '不明'}
                    color={getStatusColor(simulationStatus?.status || '')}
                    size="medium"
                  />
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    シミュレーション時刻
                  </Typography>
                  <Typography variant="body1">
                    {simulationStatus?.current_time ? 
                      new Date(simulationStatus.current_time).toLocaleString() : 
                      '未開始'
                    }
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    実行速度
                  </Typography>
                  <Typography variant="h4" color="primary">
                    {simulationStatus?.speed || 0}×
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    接続状況
                  </Typography>
                  <Stack spacing={1} alignItems="center">
                    <Chip
                      label={isConnected ? '接続中' : '切断'}
                      color={isConnected ? 'success' : 'error'}
                      size="medium"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={testWebSocketConnection}
                    >
                      接続テスト
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* シミュレーション制御 */}
        <Card>
          <CardHeader
            title="シミュレーション制御"
            subheader="シミュレーションの開始・停止・一時停止を制御します"
          />
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                onClick={startSimulation}
                disabled={loading || simulationStatus?.status === 'running'}
                size="large"
              >
                開始
              </Button>
              
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Pause />}
                onClick={pauseSimulation}
                disabled={simulationStatus?.status !== 'running'}
                size="large"
              >
                一時停止
              </Button>
              
              <Button
                variant="outlined"
                color="error"
                startIcon={<Stop />}
                onClick={stopSimulation}
                disabled={loading || simulationStatus?.status === 'stopped'}
                size="large"
              >
                停止
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Settings />}
                size="large"
              >
                設定
              </Button>
            </Stack>

            {/* 追加のシミュレーション制御コンポーネント */}
            <SimulationControl />
          </CardContent>
        </Card>

        {/* KPIパネルとリアルタイム統計 */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardHeader
                title="リアルタイム統計"
                avatar={<Timeline />}
              />
              <CardContent>
                <RealtimeStats />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} lg={4}>
            <Card>
              <CardHeader
                title="KPI監視"
                avatar={<Assessment />}
              />
              <CardContent>
                <KPIPanel />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* イベントログ */}
        <Card>
          <CardHeader
            title="イベントログ"
            subheader="シミュレーション中のイベントをリアルタイムで表示"
          />
          <CardContent>
            <EventLog />
          </CardContent>
        </Card>

        {/* 機能説明 */}
        <Card>
          <CardHeader title="📖 機能説明" />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  🎯 基本機能
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><PlayArrow /></ListItemIcon>
                    <ListItemText primary="シミュレーションの開始・停止・一時停止" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Timeline /></ListItemIcon>
                    <ListItemText primary="リアルタイムでの状況監視" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Assessment /></ListItemIcon>
                    <ListItemText primary="KPIの自動計算と表示" />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  📊 監視項目
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="• 工程別稼働率・スループット" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• 在庫レベル・材料フロー" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• 品質指標・不良率" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• 納期遵守率・ボトルネック" />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            <Alert severity="info">
              <Typography variant="body2">
                💡 <strong>ヒント:</strong> フェーズ2の高度な機能をテストするには、
                サイドバーの「フェーズ2テスト」ページをご利用ください。
                材料フロー管理、品質管理、スケジューリング機能の詳細なテストが可能です。
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default SimulatorPage;