import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Chip,
  Paper,
  Divider,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as ClearIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Schedule as TimeIcon,
  Engineering as ProcessIcon,
  Inventory as BufferIcon,
  LocalShipping as TransportIcon,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success' | 'debug';
  category: 'simulation' | 'process' | 'buffer' | 'transport' | 'system';
  message: string;
  details?: any;
  nodeId?: string;
  processId?: string;
  equipmentId?: string;
}

interface SimulationLogProps {
  isVisible?: boolean;
  logs?: any[];
  onLog?: (logEntry: any) => void;
}

const SimulationLog: React.FC<SimulationLogProps> = ({ isVisible = true, logs: externalLogs = [], onLog }) => {
  const dispatch = useDispatch();
  const { currentTime, isRunning, isPaused } = useSelector((state: RootState) => state.simulation);
  const { networkData } = useSelector((state: RootState) => state.project);
  
  const [internalLogs, setInternalLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [maxLogs, setMaxLogs] = useState<number>(1000);
  
  // 内部ログと外部ログを結合
  const allLogs = [...internalLogs, ...externalLogs];
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allLogs, autoScroll]);

  // ログの追加
  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('ja-JP', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      }),
    };

    setInternalLogs((prevLogs: LogEntry[]) => {
      const newLogs = [...prevLogs, newLog];
      // 最大ログ数を超えた場合、古いログを削除
      if (newLogs.length > maxLogs) {
        return newLogs.slice(-maxLogs);
      }
      return newLogs;
    });
  };

  // ログのクリア
  const clearLogs = () => {
    setInternalLogs([]);
  };

  // ログのエクスポート
  const exportLogs = () => {
    const logText = allLogs.map((log: any) => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ログレベルのアイコン取得
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <InfoIcon color="info" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'error': return <ErrorIcon color="error" />;
      case 'success': return <SuccessIcon color="success" />;
      case 'debug': return <InfoIcon color="action" />;
      default: return <InfoIcon />;
    }
  };

  // ログカテゴリのアイコン取得
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'simulation': return <PlayIcon color="primary" />;
      case 'process': return <ProcessIcon color="secondary" />;
      case 'buffer': return <BufferIcon color="info" />;
      case 'transport': return <TransportIcon color="warning" />;
      case 'system': return <InfoIcon color="action" />;
      default: return <InfoIcon />;
    }
  };

  // ログレベルの色取得
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'info.main';
      case 'warning': return 'warning.main';
      case 'error': return 'error.main';
      case 'success': return 'success.main';
      case 'debug': return 'text.secondary';
      default: return 'text.primary';
    }
  };

  // フィルタリングされたログ
  const filteredLogs = allLogs.filter((log: any) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  // シミュレーション状態の監視
  useEffect(() => {
    if (isRunning && !isPaused) {
      addLog({
        level: 'info',
        category: 'simulation',
        message: `シミュレーション実行中 - 経過時間: ${Math.floor(currentTime / 60)}分${currentTime % 60}秒`,
        details: { currentTime }
      });
    } else if (isPaused) {
      addLog({
        level: 'warning',
        category: 'simulation',
        message: 'シミュレーション一時停止',
        details: { currentTime }
      });
    }
  }, [isRunning, isPaused, currentTime]);

  // ネットワークデータの監視
  useEffect(() => {
    if (networkData?.nodes) {
      addLog({
        level: 'info',
        category: 'system',
        message: `ネットワークデータ読み込み完了 - ノード数: ${networkData.nodes.length}, エッジ数: ${networkData.edges?.length || 0}`,
        details: { nodeCount: networkData.nodes.length, edgeCount: networkData.edges?.length || 0 }
      });
    }
  }, [networkData]);

  if (!isVisible) return null;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="h2">
            📋 シミュレーションログ
          </Typography>
          <Box>
            <Chip 
              label={`${filteredLogs.length}/${allLogs.length}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* コントロールバー */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {/* フィルター */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>レベル</InputLabel>
            <Select
              value={filterLevel}
              label="レベル"
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="info">情報</MenuItem>
              <MenuItem value="warning">警告</MenuItem>
              <MenuItem value="error">エラー</MenuItem>
              <MenuItem value="success">成功</MenuItem>
              <MenuItem value="debug">デバッグ</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={filterCategory}
              label="カテゴリ"
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="simulation">シミュレーション</MenuItem>
              <MenuItem value="process">工程</MenuItem>
              <MenuItem value="buffer">バッファ</MenuItem>
              <MenuItem value="transport">搬送</MenuItem>
              <MenuItem value="system">システム</MenuItem>
            </Select>
          </FormControl>

          {/* 検索 */}
          <TextField
            size="small"
            placeholder="ログを検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ minWidth: 150 }}
          />

          {/* ボタン群 */}
          <Button
            size="small"
            variant="outlined"
            onClick={clearLogs}
            startIcon={<ClearIcon />}
          >
            クリア
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={exportLogs}
            startIcon={<DownloadIcon />}
          >
            エクスポート
          </Button>
        </Box>

        {/* ログ表示エリア */}
        <Paper 
          ref={logContainerRef}
          variant="outlined" 
          sx={{ 
            flex: 1, 
            overflow: 'auto', 
            maxHeight: 400,
            bgcolor: 'background.default'
          }}
        >
          {filteredLogs.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                ログがありません
              </Typography>
            </Box>
          ) : (
            <List dense>
              {filteredLogs.map((log) => (
                <ListItem key={log.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getLevelIcon(log.level)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {log.timestamp}
                        </Typography>
                        <Chip
                          label={log.category}
                          size="small"
                          icon={getCategoryIcon(log.category)}
                          variant="outlined"
                        />
                        <Typography 
                          variant="body2" 
                          component="span"
                          sx={{ color: getLevelColor(log.level) }}
                        >
                          {log.message}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      log.details && (
                        <Typography variant="caption" color="text.secondary">
                          {JSON.stringify(log.details, null, 2)}
                        </Typography>
                      )
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
          <div ref={logEndRef} />
        </Paper>

        {/* 設定 */}
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>最大ログ数</InputLabel>
            <Select
              value={maxLogs}
              label="最大ログ数"
              onChange={(e) => setMaxLogs(Number(e.target.value))}
            >
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={500}>500</MenuItem>
              <MenuItem value={1000}>1000</MenuItem>
              <MenuItem value={5000}>5000</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            size="small"
            variant={autoScroll ? "contained" : "outlined"}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            自動スクロール {autoScroll ? 'ON' : 'OFF'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SimulationLog;
