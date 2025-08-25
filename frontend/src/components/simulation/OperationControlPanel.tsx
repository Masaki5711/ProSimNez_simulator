import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardHeader,
  Slider,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Chip,
  Divider,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Speed,
  Settings,
  Schedule,
  Factory,
  LocalShipping,
  Assessment,
  Warning,
  CheckCircle,
  Store,
  Build,
  Refresh,
} from '@mui/icons-material';

interface OperationControlPanelProps {
  simulationStatus: any;
  networkData: any;
  onSimulationControl: (action: 'start' | 'pause' | 'stop') => void;
  onStoreNodeSettings: (nodeId: string) => void;
  onProcessNodeSettings: (nodeId: string) => void;
  onTransportEdgeSettings: (edgeId: string) => void;
}

const OperationControlPanel: React.FC<OperationControlPanelProps> = ({
  simulationStatus,
  networkData,
  onSimulationControl,
  onStoreNodeSettings,
  onProcessNodeSettings,
  onTransportEdgeSettings,
}) => {
  const [simulationSpeed, setSimulationSpeed] = useState(1.0);
  const [autoMode, setAutoMode] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  const isRunning = simulationStatus?.status === 'running';
  const isPaused = simulationStatus?.status === 'paused';
  const isStopped = simulationStatus?.status === 'stopped' || !simulationStatus?.status;

  // ストアノードリスト
  const storeNodes = networkData?.nodes?.filter((node: any) => 
    node.type === 'store' || node.type === 'buffer'
  ) || [];

  // 工程ノードリスト
  const processNodes = networkData?.nodes?.filter((node: any) => 
    node.type === 'process' || node.type === 'machine' || node.type === 'operation'
  ) || [];

  // 搬送エッジリスト
  const transportEdges = networkData?.edges || [];

  // シミュレーション制御
  const handleStart = () => {
    onSimulationControl('start');
  };

  const handlePause = () => {
    onSimulationControl('pause');
  };

  const handleStop = () => {
    onSimulationControl('stop');
  };

  // 速度変更
  const handleSpeedChange = (event: Event, newValue: number | number[]) => {
    setSimulationSpeed(newValue as number);
    // TODO: バックエンドに速度変更を送信
  };

  // ネットワーク要素の設定
  const handleNodeSettings = (nodeId: string, nodeType: string) => {
    if (nodeType === 'store' || nodeType === 'buffer') {
      onStoreNodeSettings(nodeId);
    } else {
      onProcessNodeSettings(nodeId);
    }
  };

  const handleEdgeSettings = (edgeId: string) => {
    onTransportEdgeSettings(edgeId);
  };

  // シミュレーションの準備状況
  const getSimulationReadiness = () => {
    const hasStores = storeNodes.length > 0;
    const hasProcesses = processNodes.length > 0;
    const hasConnections = transportEdges.length > 0;
    
    const readiness = [
      { label: 'ストアノード', status: hasStores, count: storeNodes.length },
      { label: '工程ノード', status: hasProcesses, count: processNodes.length },
      { label: '搬送接続', status: hasConnections, count: transportEdges.length },
    ];

    const allReady = readiness.every(item => item.status);
    
    return { readiness, allReady };
  };

  const { readiness, allReady } = getSimulationReadiness();

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* シミュレーション制御 */}
      <Card sx={{ mb: 2 }}>
        <CardHeader 
          title="シミュレーション制御" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<Factory color="primary" />}
        />
        <CardContent>
          {/* メイン制御ボタン */}
          <ButtonGroup variant="contained" fullWidth sx={{ mb: 2 }}>
            <Button
              onClick={handleStart}
              disabled={!allReady || isRunning}
              color="success"
              startIcon={<PlayArrow />}
            >
              開始
            </Button>
            <Button
              onClick={handlePause}
              disabled={!isRunning}
              color="warning"
              startIcon={<Pause />}
            >
              {isPaused ? '再開' : '一時停止'}
            </Button>
            <Button
              onClick={handleStop}
              disabled={isStopped}
              color="error"
              startIcon={<Stop />}
            >
              停止
            </Button>
          </ButtonGroup>

          {/* 状態表示 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="body2">状態:</Typography>
            <Chip
              label={simulationStatus?.status || '停止中'}
              color={
                isRunning ? 'success' :
                isPaused ? 'warning' : 'default'
              }
              icon={
                isRunning ? <CheckCircle /> :
                isPaused ? <Pause /> : <Stop />
              }
              size="small"
            />
          </Box>

          {/* 速度制御 */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Speed />
              <Typography variant="body2">速度: ×{simulationSpeed}</Typography>
            </Box>
            <Slider
              value={simulationSpeed}
              onChange={handleSpeedChange}
              min={0.1}
              max={5.0}
              step={0.1}
              marks={[
                { value: 0.5, label: '×0.5' },
                { value: 1.0, label: '×1.0' },
                { value: 2.0, label: '×2.0' },
                { value: 5.0, label: '×5.0' },
              ]}
              valueLabelDisplay="auto"
              disabled={!isRunning}
            />
          </Box>

          {/* 自動制御 */}
          <FormControlLabel
            control={
              <Switch
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                disabled={!isRunning}
              />
            }
            label="自動制御モード"
          />
        </CardContent>
      </Card>

      {/* 準備状況 */}
      <Card sx={{ mb: 2 }}>
        <CardHeader 
          title="システム準備状況" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<Assessment color="primary" />}
        />
        <CardContent>
          {readiness.map((item, index) => (
            <Box key={index} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">{item.label}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption">{item.count}個</Typography>
                  {item.status ? (
                    <CheckCircle color="success" fontSize="small" />
                  ) : (
                    <Warning color="warning" fontSize="small" />
                  )}
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={item.status ? 100 : 0}
                color={item.status ? 'success' : 'warning'}
                sx={{ height: 4, borderRadius: 1 }}
              />
            </Box>
          ))}
          
          {!allReady && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              シミュレーション開始には、ストア・工程・接続の設定が必要です。
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ストアノード管理 */}
      <Card sx={{ mb: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardHeader 
          title="ストア管理" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<Store color="primary" />}
          action={
            <Tooltip title="スケジュール一括設定">
              <IconButton size="small">
                <Schedule />
              </IconButton>
            </Tooltip>
          }
        />
        <CardContent sx={{ flex: 1, overflow: 'auto' }}>
          {storeNodes.length > 0 ? (
            <List dense>
              {storeNodes.map((node: any) => (
                <ListItem
                  key={node.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleNodeSettings(node.id, node.type)}
                    >
                      <Settings />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <Store />
                  </ListItemIcon>
                  <ListItemText
                    primary={node.data?.label || node.id}
                    secondary={`タイプ: ${node.data?.storeType || 'general'}`}
                  />
                  <Chip
                    label={`在庫: ${node.data?.currentInventory || 0}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              ストアノードが設定されていません
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* 工程ノード管理 */}
      <Card sx={{ mb: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardHeader 
          title="工程管理" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<Build color="primary" />}
        />
        <CardContent sx={{ flex: 1, overflow: 'auto' }}>
          {processNodes.length > 0 ? (
            <List dense>
              {processNodes.map((node: any) => (
                <ListItem
                  key={node.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleNodeSettings(node.id, node.type)}
                    >
                      <Settings />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <Build />
                  </ListItemIcon>
                  <ListItemText
                    primary={node.data?.label || node.id}
                    secondary={`CT: ${node.data?.cycleTime || 0}秒`}
                  />
                  <Chip
                    label={`稼働率: ${((node.data?.utilization || 0) * 100).toFixed(0)}%`}
                    size="small"
                    color={node.data?.utilization > 0.8 ? 'warning' : 'default'}
                    variant="outlined"
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              工程ノードが設定されていません
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* 搬送管理 */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardHeader 
          title="搬送管理" 
          titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
          avatar={<LocalShipping color="primary" />}
        />
        <CardContent sx={{ flex: 1, overflow: 'auto' }}>
          {transportEdges.length > 0 ? (
            <List dense>
              {transportEdges.map((edge: any) => (
                <ListItemButton
                  key={edge.id}
                  onClick={() => handleEdgeSettings(edge.id)}
                >
                  <ListItemIcon>
                    <LocalShipping />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${edge.source} → ${edge.target}`}
                    secondary={edge.data?.transportType || 'コンベア'}
                  />
                  <Chip
                    label={`負荷: ${((edge.data?.currentLoad || 0) / (edge.data?.maxCapacity || 100) * 100).toFixed(0)}%`}
                    size="small"
                    color={edge.data?.currentLoad > edge.data?.maxCapacity * 0.8 ? 'warning' : 'success'}
                    variant="outlined"
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              搬送接続が設定されていません
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default OperationControlPanel;