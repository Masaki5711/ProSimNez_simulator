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
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
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
  NetworkCheck,
  Analytics,
  LocalShipping,
  History,
  Wifi,
  WifiOff,
} from '@mui/icons-material';
import SimulationControl from '../components/simulation/SimulationControl';
import RealtimeStats from '../components/realtime/RealtimeStats';
import KPIPanel from '../components/monitoring/KPIPanel';
import EventLog from '../components/monitoring/EventLog';
import NetworkViewer from '../components/network/NetworkViewer';
import InventoryChart from '../components/charts/InventoryChart';
import ProductionChart from '../components/charts/ProductionChart';
import TransportMonitor from '../components/monitoring/TransportMonitor';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { 
  startDetailedSimulation, 
  stopDetailedSimulation, 
  pauseDetailedSimulation,
  fetchSimulationStatus,
  setSelectedNode,
  setSelectedEdge,
  setActiveTab,
} from '../store/slices/simulationSlice';

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
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [enableRealtimeMonitoring, setEnableRealtimeMonitoring] = useState(true);
  const { 
    sendMessage, 
    isConnected, 
    sendSimulationControl,
    subscribeToRealtimeData,
    unsubscribeFromRealtimeData 
  } = useWebSocket();
  
  const dispatch = useDispatch();
  
  // Reduxストアからデータを取得
  const networkData = useSelector((state: RootState) => state.project.networkData);
  const currentProject = useSelector((state: RootState) => state.project.currentProject);
  const simulationStatus = useSelector((state: RootState) => state.simulation.status);
  const realtimeData = useSelector((state: RootState) => state.simulation.realtimeData);
  const selectedNode = useSelector((state: RootState) => state.simulation.selectedNode);
  const selectedEdge = useSelector((state: RootState) => state.simulation.selectedEdge);
  const loading = useSelector((state: RootState) => state.simulation.loading);
  const error = useSelector((state: RootState) => state.simulation.error);

  // シミュレーション開始
  const handleStartSimulation = async () => {
    if (!currentProject) {
      alert('プロジェクトが選択されていません');
      return;
    }

    const config = {
      projectId: currentProject.id,
      duration: 24.0,
      timeScale: 1.0,
      enableDetailedProcess: true,
      enableMaterialFlow: true,
      enableTransport: true,
      enableQuality: true,
      enableScheduling: true,
      realTimeMonitoring: true,
    };

    try {
      console.log('シミュレーション開始中...', config);
      await dispatch(startDetailedSimulation(config) as any);
      console.log('シミュレーション開始完了');
      
      // WebSocket経由でシミュレーション制御メッセージを送信
      sendSimulationControl('start', config);
      
      // リアルタイム監視が有効な場合、データ購読を開始
      if (enableRealtimeMonitoring && networkData) {
        const nodeIds = networkData.nodes?.map(node => node.id) || [];
        const edgeIds = networkData.edges?.map(edge => edge.id) || [];
        console.log('リアルタイムデータ購読開始:', { nodeIds, edgeIds });
        subscribeToRealtimeData(nodeIds, edgeIds);
      }
      
      // シミュレーション状況を更新
      setTimeout(() => {
        handleRefreshStatus();
      }, 1000);
      
    } catch (err: any) {
      console.error('シミュレーション開始エラー:', err);
      alert(`シミュレーション開始に失敗しました: ${err.message}`);
    }
  };

  // シミュレーション停止
  const handleStopSimulation = async () => {
    try {
      await dispatch(stopDetailedSimulation() as any);
      
      // WebSocket経由でシミュレーション制御メッセージを送信
      sendSimulationControl('stop');
      
      // リアルタイムデータの購読を停止
      if (networkData) {
        const nodeIds = networkData.nodes?.map(node => node.id) || [];
        const edgeIds = networkData.edges?.map(edge => edge.id) || [];
        unsubscribeFromRealtimeData(nodeIds, edgeIds);
      }
    } catch (err: any) {
      console.error('シミュレーション停止エラー:', err);
    }
  };

  // シミュレーション一時停止
  const handlePauseSimulation = async () => {
    try {
      await dispatch(pauseDetailedSimulation() as any);
      
      // WebSocket経由でシミュレーション制御メッセージを送信
      sendSimulationControl('pause');
    } catch (err: any) {
      console.error('シミュレーション一時停止エラー:', err);
    }
  };

  // シミュレーション状況更新
  const handleRefreshStatus = async () => {
    try {
      console.log('シミュレーション状況更新中...');
      const result = await dispatch(fetchSimulationStatus() as any);
      console.log('シミュレーション状況更新結果:', result);
      
      // 現在の状態をログ出力
      console.log('現在のシミュレーション状態:', {
        status: simulationStatus,
        realtimeData,
        networkData: networkData ? { 
          nodes: networkData.nodes?.length || 0, 
          edges: networkData.edges?.length || 0 
        } : null,
        isConnected,
        enableRealtimeMonitoring
      });
      
    } catch (err: any) {
      console.error('状況更新エラー:', err);
    }
  };

  // リアルタイム監視の切り替え
  const handleRealtimeMonitoringToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setEnableRealtimeMonitoring(enabled);
    
    console.log('リアルタイム監視切り替え:', { enabled, networkData, simulationStatus });
    
    if (enabled && networkData && simulationStatus?.status === 'running') {
      // リアルタイム監視を開始
      const nodeIds = networkData.nodes?.map(node => node.id) || [];
      const edgeIds = networkData.edges?.map(edge => edge.id) || [];
      console.log('リアルタイム監視開始:', { nodeIds, edgeIds });
      subscribeToRealtimeData(nodeIds, edgeIds);
    } else if (!enabled && networkData) {
      // リアルタイム監視を停止
      const nodeIds = networkData.nodes?.map(node => node.id) || [];
      const edgeIds = networkData.edges?.map(edge => edge.id) || [];
      console.log('リアルタイム監視停止:', { nodeIds, edgeIds });
      unsubscribeFromRealtimeData(nodeIds, edgeIds);
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
      // まず、ネットワークデータから情報を取得
      if (networkData && networkData.nodes && networkData.nodes.length > 0) {
        console.log('ネットワークデータからプロジェクト情報を構築:', networkData);
        
        // ノードタイプ別のカウント
        const processNodes = networkData.nodes.filter((node: any) => node.type === 'process');
        const bufferNodes = networkData.nodes.filter((node: any) => node.type === 'store' || node.type === 'buffer');
        const totalNodes = networkData.nodes.length;

        setProjectInfo({
          id: '1',
          name: 'ネットワークエディタで作成されたプロジェクト',
          description: `工程数: ${processNodes.length}, バッファ数: ${bufferNodes.length}, 総ノード数: ${totalNodes}`,
          components: {
            processes: processNodes.length,
            buffers: bufferNodes.length,
            products: 0, // 製品情報は別途取得が必要
            total_nodes: totalNodes,
          },
          simulation_ready: totalNodes > 0,
        });

        console.log('プロジェクト情報を設定完了:', {
          processes: processNodes.length,
          buffers: bufferNodes.length,
          total_nodes: totalNodes
        });

        return; // ネットワークデータから構築できた場合はAPI呼び出しをスキップ
      }

      // ネットワークデータがない場合は、APIから取得を試行
      console.log('ネットワークデータがないため、APIからプロジェクト情報を取得中...');
      const response = await fetch('/api/projects/1');
      if (response.ok) {
        const data = await response.json();
        setProjectInfo(data.project_info);
      } else {
        console.warn('プロジェクト情報の取得に失敗しました:', response.status);
        // プロジェクト情報が取得できない場合は、デフォルト値を設定
        setProjectInfo({
          id: '1',
          name: 'デフォルトプロジェクト',
          description: 'プロジェクト情報が取得できませんでした。ネットワークエディタで工程を設定してください。',
          components: {
            processes: 0,
            buffers: 0,
            products: 0,
            total_nodes: 0,
          },
          simulation_ready: false,
        });
      }
    } catch (error) {
      console.error('プロジェクト情報取得エラー:', error);
      // エラーが発生した場合もデフォルト値を設定
      setProjectInfo({
        id: '1',
        name: 'デフォルトプロジェクト',
        description: 'プロジェクト情報の取得中にエラーが発生しました。ネットワークエディタで工程を設定してください。',
        components: {
          processes: 0,
          buffers: 0,
          products: 0,
          total_nodes: 0,
        },
        simulation_ready: false,
      });
    }
  };

  // ネットワークデータの座標を検証・修正する関数
  const validateAndFixNetworkData = (data: any) => {
    if (!data || !data.nodes || !data.edges) {
      console.warn('ネットワークデータが不完全です:', data);
      return data;
    }

    let hasFixedData = false;
    
    // ノードの座標を検証・修正
    const fixedNodes = data.nodes.map((node: any) => {
      let fixedNode = { ...node };
      
      // 座標がNaNまたは無効な値の場合、デフォルト値を設定
      if (typeof node.position?.x !== 'number' || isNaN(node.position.x)) {
        fixedNode.position = { ...node.position, x: 100 };
        hasFixedData = true;
        console.warn(`ノード ${node.id} のX座標を修正: ${node.position?.x} → 100`);
      }
      
      if (typeof node.position?.y !== 'number' || isNaN(node.position.y)) {
        fixedNode.position = { ...node.position, y: 100 };
        hasFixedData = true;
        console.warn(`ノード ${node.id} のY座標を修正: ${node.position?.y} → 100`);
      }
      
      return fixedNode;
    });

    // エッジの座標を検証・修正
    const fixedEdges = data.edges.map((edge: any) => {
      let fixedEdge = { ...edge };
      
      // ソースとターゲットが存在するかチェック
      if (!fixedNodes.find((n: any) => n.id === edge.source)) {
        console.warn(`エッジ ${edge.id} のソースノード ${edge.source} が見つかりません`);
        hasFixedData = true;
      }
      
      if (!fixedNodes.find((n: any) => n.id === edge.target)) {
        console.warn(`エッジ ${edge.id} のターゲットノード ${edge.target} が見つかりません`);
        hasFixedData = true;
      }
      
      return fixedEdge;
    });

    if (hasFixedData) {
      console.log('ネットワークデータの座標を修正しました');
      return { ...data, nodes: fixedNodes, edges: fixedEdges };
    }
    
    return data;
  };

  // ノードクリックハンドラー
  const handleNodeClick = (node: any) => {
    dispatch(setSelectedNode(node.id));
    // 在庫推移タブに切り替え
    setActiveTab(0);
  };

  // エッジクリックハンドラー
  const handleEdgeClick = (edge: any) => {
    dispatch(setSelectedEdge({ id: edge.id, type: edge.type }));
    // 搬送モニタータブに切り替え
    setActiveTab(2);
  };

  // タブ変更ハンドラー
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // 初期読み込み
  useEffect(() => {
    console.log('SimulatorPage初期化開始');
    fetchProjectInfo();
    handleRefreshStatus();
    const interval = setInterval(handleRefreshStatus, 5000); // 5秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  // ネットワークデータが変更されたときのリアルタイム監視設定
  useEffect(() => {
    console.log('ネットワークデータ変更検知:', {
      networkData: networkData ? {
        nodes: networkData.nodes?.length || 0,
        edges: networkData.edges?.length || 0
      } : null,
      enableRealtimeMonitoring,
      simulationStatus: simulationStatus?.status
    });

    // ネットワークデータの座標を検証・修正
    if (networkData) {
      const fixedNetworkData = validateAndFixNetworkData(networkData);
      if (fixedNetworkData !== networkData) {
        console.log('修正されたネットワークデータを設定:', fixedNetworkData);
        // 修正されたデータをReduxストアに反映する必要がある場合はここで処理
      }
      
      // ネットワークデータが変更されたら、プロジェクト情報も更新
      fetchProjectInfo();
    }

    if (enableRealtimeMonitoring && networkData && simulationStatus?.status === 'running') {
      const nodeIds = networkData.nodes?.map(node => node.id) || [];
      const edgeIds = networkData.edges?.map(edge => edge.id) || [];
      console.log('自動リアルタイム監視開始:', { nodeIds, edgeIds });
      subscribeToRealtimeData(nodeIds, edgeIds);
    }
  }, [networkData, enableRealtimeMonitoring, simulationStatus?.status, subscribeToRealtimeData, fetchProjectInfo]);

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
              {currentProject ? `プロジェクト: ${currentProject.name}` : 'リアルタイムでシミュレーションを実行・監視します'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefreshStatus}
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
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                console.log('=== デバッグ情報 ===');
                console.log('シミュレーション状態:', simulationStatus);
                console.log('リアルタイムデータ:', realtimeData);
                console.log('ネットワークデータ:', networkData);
                console.log('WebSocket接続:', isConnected);
                console.log('選択されたノード:', selectedNode);
                console.log('選択されたエッジ:', selectedEdge);
                console.log('==================');
              }}
            >
              デバッグ出力
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
                    <strong>プロジェクト名:</strong> {projectInfo.name}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>説明:</strong> {projectInfo.description}
                  </Typography>
                  
                  {/* ネットワークデータの状況を表示 */}
                  {networkData && networkData.nodes && networkData.nodes.length > 0 ? (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        ✅ ネットワークデータが正常に読み込まれています
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        ノード数: {networkData.nodes.length}, エッジ数: {networkData.edges?.length || 0}
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        ⚠️ ネットワークデータが読み込まれていません
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        ネットワークエディタで工程を設定してください
                      </Typography>
                    </Alert>
                  )}
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
                        🎯 製品数: {projectInfo.components.products}
                      </Typography>
                      <Typography variant="body2">
                        📊 総ノード数: {projectInfo.components.total_nodes}
                      </Typography>
                    </Stack>
                  )}
                </Grid>
              </Grid>

              {/* ネットワークデータの詳細情報 */}
              {networkData && networkData.nodes && networkData.nodes.length > 0 && (
                <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    🔍 ネットワークデータ詳細
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2">
                        <strong>ノード一覧:</strong>
                      </Typography>
                      {networkData.nodes?.map((node: any, index: number) => (
                        <Typography key={node.id} variant="caption" display="block" sx={{ ml: 2 }}>
                          {index + 1}. {node.id} ({node.type || 'unknown'}) - 座標: ({node.position?.x || 'N/A'}, {node.position?.y || 'N/A'})
                        </Typography>
                      ))}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2">
                        <strong>エッジ一覧:</strong>
                      </Typography>
                      {networkData.edges?.map((edge: any, index: number) => (
                        <Typography key={edge.id} variant="caption" display="block" sx={{ ml: 2 }}>
                          {index + 1}. {edge.source} → {edge.target}
                        </Typography>
                      ))}
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" onClose={() => dispatch({ type: 'simulation/clearError' })}>
            {error}
          </Alert>
        )}

        {/* フェーズ1: 上部エリア - グローバルコントロールと主要KPI */}
        <Card>
          <CardHeader
            title="🎮 シミュレーション制御 & 主要KPI"
            subheader="シミュレーションの制御とリアルタイム監視"
          />
          <CardContent>
            <Grid container spacing={3}>
              {/* シミュレーション制御 */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  <PlayArrow sx={{ mr: 1, verticalAlign: 'bottom' }} />
                  シミュレーション制御
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                    onClick={handleStartSimulation}
                    disabled={loading || simulationStatus?.status === 'running'}
                    size="large"
                  >
                    開始
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<Pause />}
                    onClick={handlePauseSimulation}
                    disabled={simulationStatus?.status !== 'running'}
                    size="large"
                  >
                    一時停止
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Stop />}
                    onClick={handleStopSimulation}
                    disabled={loading || simulationStatus?.status === 'stopped'}
                    size="large"
                  >
                    停止
                  </Button>
                </Stack>
                
                {/* シミュレーション状況 */}
                {simulationStatus && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                      label={simulationStatus.status}
                      color={getStatusColor(simulationStatus.status)}
                      icon={getStatusIcon(simulationStatus.status)}
                    />
                    <Typography variant="body2">
                      速度: {simulationStatus.speed}×
                    </Typography>
                    <Typography variant="body2">
                      時刻: {new Date(simulationStatus.currentTime).toLocaleTimeString()}
                    </Typography>
                  </Stack>
                )}
                
                {/* シミュレーション状態が不明な場合 */}
                {!simulationStatus && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                      label="状態不明"
                      color="default"
                      icon={<Info />}
                    />
                    <Typography variant="body2" color="text.secondary">
                      シミュレーション状態を取得中...
                    </Typography>
                  </Stack>
                )}
                
                {/* リアルタイムデータの状況 */}
                {realtimeData && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      最終更新: {new Date(realtimeData.overall?.lastUpdate || Date.now()).toLocaleTimeString()}
                    </Typography>
                  </Box>
                )}
                
                {/* ネットワークデータ状況 */}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    ネットワーク: {networkData?.nodes?.length || 0}ノード, {networkData?.edges?.length || 0}エッジ
                  </Typography>
                </Box>
                
                {/* リアルタイム監視状況 */}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    リアルタイム監視: {enableRealtimeMonitoring ? '有効' : '無効'}
                  </Typography>
                </Box>
                
                {/* リアルタイム監視設定 */}
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enableRealtimeMonitoring}
                        onChange={handleRealtimeMonitoringToggle}
                        color="primary"
                      />
                    }
                    label="リアルタイム監視"
                  />
                  <Typography variant="caption" display="block" color="text.secondary">
                    工程と搬送のリアルタイム状態を監視します
                  </Typography>
                </Box>
              </Grid>

              {/* 主要KPI */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  <Assessment sx={{ mr: 1, verticalAlign: 'bottom' }} />
                  主要KPI
                </Typography>
                <RealtimeStats />
                
                {/* WebSocket接続状況 */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    接続状況
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      icon={isConnected ? <Wifi /> : <WifiOff />}
                      label={isConnected ? 'WebSocket接続中' : 'WebSocket切断'}
                      color={isConnected ? 'success' : 'error'}
                      size="small"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={testWebSocketConnection}
                      disabled={!isConnected}
                    >
                      接続テスト
                    </Button>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* フェーズ1: 中央エリア - ネットワークのリアルタイム可視化 */}
        <Card>
          <CardHeader
            title="🌐 工程ネットワーク監視"
            subheader="リアルタイムでの工程状況と搬送状況の可視化"
            avatar={<NetworkCheck />}
          />
          <CardContent>
            {networkData && networkData.nodes && networkData.nodes.length > 0 ? (
              <Box sx={{ height: 600, width: '100%' }}>
                <NetworkViewer 
                  nodes={networkData.nodes} 
                  edges={networkData.edges}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                />
              </Box>
            ) : (
              <Box sx={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '2px dashed #ccc',
                borderRadius: 2
              }}>
                <Stack spacing={2} alignItems="center">
                  <Typography variant="h6" color="text.secondary">
                    ネットワークデータが読み込まれていません
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    プロジェクトのネットワークエディタで工程を設定してください
                  </Typography>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* フェーズ1: 下部エリア - 詳細情報のタブ切り替え表示 */}
        <Card>
          <CardHeader
            title="📊 詳細情報監視"
            subheader="工程別の詳細な分析とログ情報"
          />
          <CardContent>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={activeTab} onChange={handleTabChange} aria-label="詳細情報タブ">
                <Tab 
                  label="在庫推移" 
                  icon={<Analytics />} 
                  iconPosition="start"
                />
                <Tab 
                  label="出来高分析" 
                  icon={<Timeline />} 
                  iconPosition="start"
                />
                <Tab 
                  label="搬送モニター" 
                  icon={<LocalShipping />} 
                  iconPosition="start"
                />
                <Tab 
                  label="イベントログ" 
                  icon={<History />} 
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            {/* タブコンテンツ */}
            {activeTab === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  📈 在庫推移
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedNode ? 
                    `選択された工程「${selectedNode}」の在庫量の時系列推移を表示します` :
                    '工程ノードをクリックして在庫推移を表示してください'
                  }
                </Typography>
                <InventoryChart 
                  nodeId={selectedNode}
                  nodeName={selectedNode || undefined}
                  realtimeData={realtimeData}
                />
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  📊 出来高分析
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedNode ? 
                    `選択された工程「${selectedNode}」の生産完了数を時系列で表示します` :
                    '工程ノードをクリックして出来高分析を表示してください'
                  }
                </Typography>
                <ProductionChart 
                  nodeId={selectedNode}
                  nodeName={selectedNode || undefined}
                  realtimeData={realtimeData}
                />
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  🚚 搬送モニター
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedEdge && typeof selectedEdge === 'object' ? 
                    `選択された搬送「${(selectedEdge as any).id}」の搬送タスクの一覧と現在の状況を表示します` :
                    '搬送エッジをクリックして搬送状況を表示してください'
                  }
                </Typography>
                <TransportMonitor 
                  edgeId={selectedEdge && typeof selectedEdge === 'object' ? (selectedEdge as any).id : null}
                  edgeInfo={selectedEdge && typeof selectedEdge === 'object' ? selectedEdge : undefined}
                  realtimeData={realtimeData}
                />
              </Box>
            )}

            {activeTab === 3 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  📝 イベントログ
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  シミュレーション全体のイベント履歴を表示します
                </Typography>
                <EventLog />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* 機能説明 */}
        <Card>
          <CardHeader title="📖 新機能説明" />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  🎯 新機能
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><NetworkCheck /></ListItemIcon>
                    <ListItemText primary="インタラクティブな工程ネットワーク表示" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Analytics /></ListItemIcon>
                    <ListItemText primary="工程別の詳細分析タブ" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><LocalShipping /></ListItemIcon>
                    <ListItemText primary="リアルタイム搬送状況監視" />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  📊 監視項目
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="• 工程別リアルタイム状態表示" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• 在庫レベル・材料フロー可視化" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• 搬送タスクの詳細追跡" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• イベントログの時系列表示" />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            {/* デバッグ情報 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                🐛 デバッグ情報
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>WebSocket接続:</strong> {isConnected ? '接続中' : '切断'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>シミュレーション状態:</strong> {simulationStatus?.status || '不明'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>ネットワークノード数:</strong> {networkData?.nodes?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>ネットワークエッジ数:</strong> {networkData?.edges?.length || 0}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>選択されたノード:</strong> {selectedNode || 'なし'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>選択されたエッジ:</strong> {selectedEdge ? `${selectedEdge.id}` : 'なし'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>リアルタイムデータ:</strong> {realtimeData ? '有効' : 'なし'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>アクティブタブ:</strong> {activeTab + 1}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            
            <Alert severity="success">
              <Typography variant="body2">
                🎉 <strong>実装完了:</strong> フェーズ4のWebSocket連携が完成しました！
                リアルタイムデータの統合により、工程ノードや搬送エッジの状態がリアルタイムで更新されます。
                シミュレーションページの刷新が完了し、完全なリアルタイム監視システムが構築されました。
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default SimulatorPage;