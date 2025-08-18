import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  ButtonGroup,
  Typography,
  Chip,
  Slider,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  CheckCircle as ValidateIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  NetworkCheck as NetworkIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import {
  startNetworkSimulation,
  stopNetworkSimulation,
  setNetworkValidationResult,
  setNetworkProductionSummary,
  setNetworkSchedulingAnalysis,
  setNetworkPerformance,
  setNetworkData,
} from '../../store/slices/simulationSlice';
import { networkSimulationApi } from '../../api/simulationApi';

const NetworkSimulationControl: React.FC = () => {
  const dispatch = useDispatch();
  const { network } = useSelector((state: RootState) => state.simulation);
  
  // シミュレーション設定
  const [duration, setDuration] = useState(600); // 10分
  const [enableSchedulingControl, setEnableSchedulingControl] = useState(true);
  const [enableRealTimeUpdate, setEnableRealTimeUpdate] = useState(true);
  const [simulationMode, setSimulationMode] = useState('normal'); // normal, test, optimization
  
  // UI状態
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>('network');
  const [selectedNetworkSource, setSelectedNetworkSource] = useState<'sample' | 'custom' | 'editor'>('sample');

  // カスタムネットワーク設定
  const [customNetworkData, setCustomNetworkData] = useState<string>('');
  const [availableNetworks, setAvailableNetworks] = useState<any[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('');

  // 利用可能なネットワークの取得
  useEffect(() => {
    loadAvailableNetworks();
    
    // ネットワーク編集の状態変更を監視
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (
        e.key.includes('network') || 
        e.key.includes('editor') || 
        e.key.includes('Network') || 
        e.key.includes('Editor')
      )) {
        console.log('🔄 ネットワーク編集の状態変更を検出:', e.key);
        loadAvailableNetworks();
      }
    };
    
    // カスタムイベントでネットワーク編集の状態変更を監視
    const handleNetworkChange = (e: CustomEvent) => {
      console.log('🎯 ネットワーク編集の状態変更イベントを受信:', e.detail);
      if (e.detail && e.detail.nodes) {
        // グローバルにデータを保存
        (window as any).networkEditorData = e.detail;
        localStorage.setItem('currentNetworkState', JSON.stringify(e.detail));
        loadAvailableNetworks();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('networkEditorChange', handleNetworkChange as EventListener);
    
    // ネットワーク編集コンポーネントにデータ共有を要求
    if (typeof window !== 'undefined') {
      (window as any).requestNetworkEditorData = () => {
        console.log('📡 ネットワーク編集コンポーネントにデータ共有を要求');
        // ネットワーク編集コンポーネントにイベントを送信
        window.dispatchEvent(new CustomEvent('requestNetworkData'));
      };
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('networkEditorChange', handleNetworkChange as EventListener);
    };
  }, []);

  const loadAvailableNetworks = async () => {
    try {
      // ローカルストレージからネットワークデータを取得
      const savedNetworks = [];
      
      // デバッグ用：ローカルストレージの全キーを確認
      console.log('🔍 ローカルストレージの全キーを確認中...');
      const allKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          allKeys.push(key);
          console.log(`  - ${key}`);
        }
      }
      console.log('📋 全キー:', allKeys);
      
      // ネットワーク関連のキーを検索
      const networkKeys = allKeys.filter(key => 
        key.startsWith('network_') || 
        key.includes('network') || 
        key.includes('Network') ||
        key.includes('editor') ||
        key.includes('Editor')
      );
      console.log('🌐 ネットワーク関連キー:', networkKeys);
      
      // 各ネットワーク関連キーからデータを取得
      for (const key of networkKeys) {
        try {
          const item = localStorage.getItem(key);
          console.log(`📥 キー "${key}" のデータ:`, item ? item.substring(0, 200) + '...' : 'null');
          
          if (item) {
            const networkData = JSON.parse(item);
            console.log(`🔍 パース結果:`, networkData);
            
            // ネットワークデータの判定条件を緩和
            if (networkData && (
              (networkData.nodes && Array.isArray(networkData.nodes) && networkData.nodes.length > 0) ||
              (networkData.edges && Array.isArray(networkData.edges)) ||
              (networkData.processes && Array.isArray(networkData.processes)) ||
              (networkData.connections && Array.isArray(networkData.connections))
            )) {
              console.log(`✅ 有効なネットワークデータを発見: ${key}`);
              savedNetworks.push({
                id: key,
                name: networkData.name || networkData.label || key.replace(/^(network_|editor_)/, ''),
                data: networkData,
                timestamp: networkData.timestamp || new Date().toISOString(),
                source: 'localStorage'
              });
            }
          }
        } catch (e) {
          console.warn(`⚠️ キー "${key}" のパースに失敗:`, e);
        }
      }
      
      // ネットワーク編集の現在の状態も取得（複数の可能性のあるキーをチェック）
      const possibleCurrentKeys = [
        'currentNetworkState',
        'currentNetwork',
        'networkEditorState',
        'networkState',
        'editorState',
        'currentState'
      ];
      
      let currentNetworkFound = false;
      for (const key of possibleCurrentKeys) {
        const currentNetworkState = localStorage.getItem(key);
        if (currentNetworkState) {
          try {
            console.log(`🔍 現在の状態キー "${key}" をチェック中...`);
            const currentNetwork = JSON.parse(currentNetworkState);
            console.log(`📊 現在の状態データ:`, currentNetwork);
            
            // ネットワークデータの判定条件を緩和
            if (currentNetwork && (
              (currentNetwork.nodes && Array.isArray(currentNetwork.nodes) && currentNetwork.nodes.length > 0) ||
              (currentNetwork.edges && Array.isArray(currentNetwork.edges)) ||
              (currentNetwork.processes && Array.isArray(currentNetwork.processes)) ||
              (currentNetwork.connections && Array.isArray(currentNetwork.connections))
            )) {
              console.log(`✅ 現在のネットワーク状態を発見: ${key}`);
              savedNetworks.unshift({
                id: `current_${key}`,
                name: '現在のネットワーク編集',
                data: currentNetwork,
                timestamp: new Date().toISOString(),
                isCurrent: true,
                source: key
              });
              currentNetworkFound = true;
              break;
            }
          } catch (e) {
            console.warn(`⚠️ 現在の状態キー "${key}" のパースに失敗:`, e);
          }
        }
      }
      
      if (!currentNetworkFound) {
        console.log('⚠️ 現在のネットワーク状態が見つかりませんでした');
      }
      
      console.log(`📊 発見されたネットワーク数: ${savedNetworks.length}`);
      console.log('🌐 利用可能なネットワーク:', savedNetworks);
      
      setAvailableNetworks(savedNetworks);
    } catch (err) {
      console.error('❌ 利用可能なネットワークの取得に失敗:', err);
    }
  };

  // ネットワーク編集からの直接データ取得
  const getNetworkEditorData = () => {
    try {
      // ネットワーク編集コンポーネントの状態を直接取得
      const networkEditorData = (window as any).networkEditorData;
      if (networkEditorData) {
        console.log('🎯 ネットワーク編集から直接データを取得:', networkEditorData);
        return networkEditorData;
      }
      
      // Reduxストアから取得を試行
      const reduxState = (window as any).__REDUX_DEVTOOLS_EXTENSION__?.connect()?.getState();
      if (reduxState) {
        console.log('🔄 Reduxストアからデータを取得:', reduxState);
        // ネットワーク関連の状態を探す
        const networkState = reduxState.network || reduxState.editor || reduxState.networkEditor;
        if (networkState && networkState.nodes) {
          return networkState;
        }
      }
      
      return null;
    } catch (err) {
      console.warn('⚠️ ネットワーク編集からの直接データ取得に失敗:', err);
      return null;
    }
  };

  // ネットワークデータの読み込み
  const loadNetworkData = async (source: 'sample' | 'custom' | 'editor') => {
    try {
      setIsLoading(true);
      setError(null);
      
      let networkData;
      
      switch (source) {
        case 'sample':
          const sampleData = await networkSimulationApi.getSampleData();
          networkData = sampleData.sample_data;
          break;
          
        case 'custom':
          try {
            networkData = JSON.parse(customNetworkData);
          } catch (e) {
            setError('カスタムネットワークデータのJSON形式が正しくありません');
            return;
          }
          break;
          
        case 'editor':
          if (selectedNetworkId === 'current_editor') {
            // 現在のネットワーク編集から取得
            const currentNetworkState = localStorage.getItem('currentNetworkState');
            if (currentNetworkState) {
              try {
                networkData = JSON.parse(currentNetworkState);
              } catch (e) {
                setError('現在のネットワーク編集データの取得に失敗しました');
                return;
              }
            } else {
              // 直接連携を試行
              const directData = getNetworkEditorData();
              if (directData) {
                networkData = directData;
                console.log('✅ 直接連携でデータを取得:', networkData);
              } else {
                setError('現在のネットワーク編集データが見つかりません。ネットワーク編集でノードを配置してください。');
                return;
              }
            }
          } else if (selectedNetworkId) {
            // 保存されたネットワークから取得
            const savedNetwork = availableNetworks.find(n => n.id === selectedNetworkId);
            if (savedNetwork) {
              networkData = savedNetwork.data;
            } else {
              setError('選択されたネットワークデータが見つかりません');
              return;
            }
          } else {
            setError('ネットワークを選択してください');
            return;
          }
          break;
          
        default:
          setError('不明なネットワークソースです');
          return;
      }
      
      dispatch(setNetworkData(networkData));
      console.log('ネットワークデータ読み込み完了:', networkData);
      
    } catch (err) {
      setError('ネットワークデータの読み込みに失敗しました');
      console.error('ネットワークデータ読み込みエラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ネットワークデータの保存
  const saveCurrentNetwork = () => {
    if (!network.networkData) {
      setError('保存するネットワークデータがありません');
      return;
    }

    try {
      const networkName = prompt('ネットワーク名を入力してください:', 'MyNetwork');
      if (!networkName) return;

      const networkToSave = {
        ...network.networkData,
        name: networkName,
        timestamp: new Date().toISOString(),
      };

      const key = `network_${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(networkToSave));
      
      // 利用可能なネットワークリストを更新
      loadAvailableNetworks();
      
      alert(`ネットワーク "${networkName}" を保存しました`);
    } catch (err) {
      setError('ネットワークの保存に失敗しました');
      console.error('保存エラー:', err);
    }
  };

  // ネットワークデータの削除
  const deleteNetwork = (networkId: string) => {
    if (window.confirm('このネットワークを削除しますか？')) {
      try {
        localStorage.removeItem(networkId);
        loadAvailableNetworks();
        
        if (selectedNetworkId === networkId) {
          setSelectedNetworkId('');
        }
      } catch (err) {
        setError('ネットワークの削除に失敗しました');
        console.error('削除エラー:', err);
      }
    }
  };

  // ネットワークデータの検証
  const validateNetworkData = async () => {
    if (!network.networkData) {
      setError('検証するネットワークデータがありません');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await networkSimulationApi.validateNetworkData(network.networkData);
      dispatch(setNetworkValidationResult(result));
      console.log('検証完了:', result);
    } catch (err) {
      setError('ネットワークデータの検証に失敗しました');
      console.error('検証エラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ネットワークシミュレーションの開始
  const startNetworkSim = async () => {
    if (!network.networkData) {
      setError('シミュレーションするネットワークデータがありません');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const config = {
        start_time: new Date().toISOString(),
        duration: duration,
        network_data: network.networkData,
        enable_scheduling_control: enableSchedulingControl,
        enable_real_time_update: enableRealTimeUpdate,
        simulation_mode: simulationMode,
      };
      
      const result = await networkSimulationApi.startNetworkSimulation(config);
      dispatch(startNetworkSimulation({ id: result.simulation_id, data: network.networkData }));
      console.log('ネットワークシミュレーション開始:', result);
    } catch (err) {
      setError('ネットワークシミュレーションの開始に失敗しました');
      console.error('シミュレーション開始エラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ネットワークシミュレーションの停止
  const stopNetworkSim = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await networkSimulationApi.stopNetworkSimulation();
      dispatch(stopNetworkSimulation());
      console.log('ネットワークシミュレーション停止');
    } catch (err) {
      setError('ネットワークシミュレーションの停止に失敗しました');
      console.error('シミュレーション停止エラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // シミュレーション状態の監視
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (network.isNetworkSimulationRunning) {
      interval = setInterval(async () => {
        try {
          const status = await networkSimulationApi.getNetworkSimulationStatus();
          
          if (status.status === 'stopped') {
            // シミュレーション完了時の処理
            const results = await networkSimulationApi.getNetworkSimulationResults();
            dispatch(setNetworkProductionSummary(results.production_summary));
            dispatch(setNetworkSchedulingAnalysis(results.scheduling_analysis));
            dispatch(setNetworkPerformance(results.network_performance));
            dispatch(stopNetworkSimulation());
          }
        } catch (err) {
          console.error('状態監視エラー:', err);
        }
      }, 5000); // 5秒間隔で監視
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [network.isNetworkSimulationRunning, dispatch]);

  // リアルタイムシミュレーション状態
  const [realTimeStatus, setRealTimeStatus] = useState<any>(null);
  const [realTimeInterval, setRealTimeInterval] = useState<NodeJS.Timeout | null>(null);

  // リアルタイム監視の開始
  const startRealTimeMonitoring = () => {
    if (realTimeInterval) return;
    
    const interval = setInterval(async () => {
      try {
        const status = await networkSimulationApi.getNetworkSimulationStatus();
        setRealTimeStatus(status);
      } catch (err) {
        console.error('リアルタイム監視エラー:', err);
      }
    }, 2000); // 2秒間隔で監視
    
    setRealTimeInterval(interval);
  };

  // リアルタイム監視の停止
  const stopRealTimeMonitoring = () => {
    if (realTimeInterval) {
      clearInterval(realTimeInterval);
      setRealTimeInterval(null);
    }
    setRealTimeStatus(null);
  };

  // シミュレーション開始時にリアルタイム監視を開始
  useEffect(() => {
    if (network.isNetworkSimulationRunning && !realTimeInterval) {
      startRealTimeMonitoring();
    } else if (!network.isNetworkSimulationRunning && realTimeInterval) {
      stopRealTimeMonitoring();
    }
  }, [network.isNetworkSimulationRunning]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (realTimeInterval) {
        clearInterval(realTimeInterval);
      }
    };
  }, [realTimeInterval]);

  // ネットワーク情報の表示
  const renderNetworkInfo = () => {
    if (!network.networkData) return null;
    
    const { nodes, edges, products, bom_items } = network.networkData;
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {nodes?.length || 0}
              </Typography>
              <Typography variant="body2">工程ノード</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">
                {edges?.length || 0}
              </Typography>
              <Typography variant="body2">接続関係</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success">
                {products?.length || 0}
              </Typography>
              <Typography variant="body2">製品・部品</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info">
                {bom_items?.length || 0}
              </Typography>
              <Typography variant="body2">BOM関係</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // 工程ノードの詳細表示
  const renderProcessNodes = () => {
    if (!network.networkData?.nodes) return null;
    
    return (
      <List dense>
        {network.networkData.nodes.map((node: any, index: number) => (
          <ListItem key={index}>
            <ListItemIcon>
              <NetworkIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={node.data?.label || node.id}
              secondary={`${node.type} | サイクルタイム: ${node.data?.cycleTime || 'N/A'}秒 | 設備数: ${node.data?.equipmentCount || 1}`}
            />
            {node.data?.schedulingMode && (
              <Chip
                label={node.data.schedulingMode}
                size="small"
                color={node.data.schedulingMode === 'push' ? 'primary' : 
                       node.data.schedulingMode === 'pull' ? 'secondary' : 'default'}
              />
            )}
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        🌐 ネットワークベースシミュレーション
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ネットワークデータソース選択 */}
      <Accordion 
        expanded={expandedAccordion === 'network'} 
        onChange={() => setExpandedAccordion(expandedAccordion === 'network' ? null : 'network')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <NetworkIcon sx={{ mr: 1 }} />
          <Typography variant="h6">ネットワークデータ</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>データソース</InputLabel>
                <Select
                  value={selectedNetworkSource}
                  onChange={(e) => setSelectedNetworkSource(e.target.value as any)}
                  label="データソース"
                >
                  <MenuItem value="sample">サンプルデータ</MenuItem>
                  <MenuItem value="custom">カスタムJSON</MenuItem>
                  <MenuItem value="editor">ネットワーク編集</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {selectedNetworkSource === 'custom' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  label="カスタムネットワークデータ (JSON)"
                  value={customNetworkData}
                  onChange={(e) => setCustomNetworkData(e.target.value)}
                  placeholder='{"nodes": [...], "edges": [...]}'
                  variant="outlined"
                />
              </Grid>
            )}
            
            {selectedNetworkSource === 'editor' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>利用可能なネットワーク</InputLabel>
                  <Select
                    value={selectedNetworkId}
                    onChange={(e) => setSelectedNetworkId(e.target.value)}
                    label="利用可能なネットワーク"
                  >
                    {availableNetworks.map((network) => (
                      <MenuItem key={network.id} value={network.id}>
                        {network.isCurrent ? '🔄 ' : '💾 '}
                        {network.name}
                        {network.timestamp && (
                          <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '8px' }}>
                            ({new Date(network.timestamp).toLocaleString()})
                          </span>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {availableNetworks.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    利用可能なネットワークがありません。ネットワーク編集でネットワークを作成するか、サンプルデータを使用してください。
                  </Alert>
                )}
                
                {availableNetworks.length === 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={loadAvailableNetworks}
                      startIcon={<NetworkIcon />}
                      size="small"
                      sx={{ mr: 2 }}
                    >
                      ネットワーク再検出
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        console.log('🔍 ローカルストレージの内容を確認中...');
                        console.log('📋 全キー:', Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)));
                        console.log('📊 全データ:');
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i);
                          if (key) {
                            const value = localStorage.getItem(key);
                            console.log(`  ${key}:`, value ? value.substring(0, 100) + '...' : 'null');
                          }
                        }
                      }}
                      startIcon={<AssessmentIcon />}
                      size="small"
                    >
                      デバッグ情報表示
                    </Button>
                  </Box>
                )}
                
                {selectedNetworkId && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      選択されたネットワーク情報
                    </Typography>
                    {(() => {
                      const selectedNetwork = availableNetworks.find(n => n.id === selectedNetworkId);
                      if (!selectedNetwork) return null;
                      
                      return (
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              <strong>名前:</strong> {selectedNetwork.name}
                            </Typography>
                            <Typography variant="body2">
                              <strong>ノード数:</strong> {selectedNetwork.data.nodes?.length || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              <strong>エッジ数:</strong> {selectedNetwork.data.edges?.length || 0}
                            </Typography>
                            <Typography variant="body2">
                              <strong>作成日時:</strong> {new Date(selectedNetwork.timestamp).toLocaleString()}
                            </Typography>
                          </Grid>
                        </Grid>
                      );
                    })()}
                  </Box>
                )}
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Button
                variant="contained"
                onClick={() => loadNetworkData(selectedNetworkSource)}
                disabled={isLoading || 
                         (selectedNetworkSource === 'custom' && !customNetworkData.trim()) ||
                         (selectedNetworkSource === 'editor' && !selectedNetworkId)}
                startIcon={isLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                sx={{ mr: 2 }}
              >
                データ読み込み
              </Button>
              
              {network.networkData && (
                <>
                  <Button
                    variant="outlined"
                    onClick={validateNetworkData}
                    disabled={isLoading}
                    startIcon={<ValidateIcon />}
                    sx={{ mr: 2 }}
                  >
                    検証実行
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={saveCurrentNetwork}
                    disabled={isLoading}
                    startIcon={<StorageIcon />}
                    color="success"
                  >
                    ネットワーク保存
                  </Button>
                </>
              )}
            </Grid>
            
            {network.validationResult && (
              <Grid item xs={12}>
                <Alert severity={network.validationResult.is_valid ? 'success' : 'error'}>
                  {network.validationResult.is_valid ? '検証OK' : '検証NG'}
                  {network.validationResult.errors?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold">エラー:</Typography>
                      {network.validationResult.errors.map((error: any, index: number) => (
                        <Typography key={index} variant="body2">• {error.message}</Typography>
                      ))}
                    </Box>
                  )}
                </Alert>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ネットワーク情報表示 */}
      {network.networkData && (
        <Accordion 
          expanded={expandedAccordion === 'info'} 
          onChange={() => setExpandedAccordion(expandedAccordion === 'info' ? null : 'info')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <AssessmentIcon sx={{ mr: 1 }} />
            <Typography variant="h6">ネットワーク情報</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderNetworkInfo()}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>工程ノード詳細</Typography>
            {renderProcessNodes()}
          </AccordionDetails>
        </Accordion>
      )}

      {/* シミュレーション設定 */}
      <Accordion 
        expanded={expandedAccordion === 'settings'} 
        onChange={() => setExpandedAccordion(expandedAccordion === 'settings' ? null : 'settings')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SettingsIcon sx={{ mr: 1 }} />
          <Typography variant="h6">シミュレーション設定</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>
                実行時間: {duration}秒
              </Typography>
              <Slider
                value={duration}
                onChange={(_, value) => setDuration(value as number)}
                min={60}
                max={3600}
                step={60}
                marks={[
                  { value: 60, label: '1分' },
                  { value: 300, label: '5分' },
                  { value: 600, label: '10分' },
                  { value: 1800, label: '30分' },
                  { value: 3600, label: '1時間' },
                ]}
                valueLabelDisplay="auto"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>シミュレーションモード</InputLabel>
                <Select
                  value={simulationMode}
                  onChange={(e) => setSimulationMode(e.target.value)}
                  label="シミュレーションモード"
                >
                  <MenuItem value="normal">通常モード</MenuItem>
                  <MenuItem value="test">テストモード</MenuItem>
                  <MenuItem value="optimization">最適化モード</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableSchedulingControl}
                    onChange={(e) => setEnableSchedulingControl(e.target.checked)}
                  />
                }
                label="スケジューリング制御を有効にする"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={enableRealTimeUpdate}
                    onChange={(e) => setEnableRealTimeUpdate(e.target.checked)}
                  />
                }
                label="リアルタイム更新を有効にする"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* シミュレーション制御 */}
      <Accordion 
        expanded={expandedAccordion === 'control'} 
        onChange={() => setExpandedAccordion(expandedAccordion === 'control' ? null : 'control')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TimelineIcon sx={{ mr: 1 }} />
          <Typography variant="h6">シミュレーション制御</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <ButtonGroup variant="contained" size="large">
              <Button
                onClick={startNetworkSim}
                disabled={!network.networkData || network.isNetworkSimulationRunning || isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
              >
                開始
              </Button>
              <Button
                onClick={stopNetworkSim}
                disabled={!network.isNetworkSimulationRunning || isLoading}
                startIcon={<StopIcon />}
                color="error"
              >
                停止
              </Button>
            </ButtonGroup>

            {network.isNetworkSimulationRunning && (
              <Chip
                label="実行中"
                color="primary"
                sx={{ ml: 2 }}
              />
            )}
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            ネットワークデータが読み込まれ、検証が完了している必要があります。
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* リアルタイム監視 */}
      {network.isNetworkSimulationRunning && realTimeStatus && (
        <Accordion 
          expanded={expandedAccordion === 'monitoring'} 
          onChange={() => setExpandedAccordion(expandedAccordion === 'monitoring' ? null : 'monitoring')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <TimelineIcon sx={{ mr: 1 }} />
            <Typography variant="h6">リアルタイム監視</Typography>
            <Chip
              label="LIVE"
              color="error"
              size="small"
              sx={{ ml: 2, animation: 'pulse 1s infinite' }}
            />
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      シミュレーション進捗
                    </Typography>
                    <Typography variant="body2">
                      現在時刻: {realTimeStatus.current_time || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      状態: {realTimeStatus.status || 'N/A'}
                    </Typography>
                    {realTimeStatus.progress && (
                      <Typography variant="body2">
                        進捗: {Math.round(realTimeStatus.progress * 100)}%
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="secondary">
                      生産状況
                    </Typography>
                    {realTimeStatus.production_summary && (
                      <>
                        <Typography variant="body2">
                          総生産数: {realTimeStatus.production_summary.total_production || 0}
                        </Typography>
                        <Typography variant="body2">
                          生産率: {realTimeStatus.production_summary.production_rate || 0} 個/時間
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {realTimeStatus.scheduling_analysis && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    スケジューリング分析
                  </Typography>
                  <Grid container spacing={2}>
                    {Object.entries(realTimeStatus.scheduling_analysis).map(([processId, analysis]: [string, any]) => (
                      <Grid item xs={6} key={processId}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" gutterBottom>
                              {processId}
                            </Typography>
                            <Typography variant="body2">
                              状態: {analysis.status || 'N/A'}
                            </Typography>
                            {analysis.input_materials && (
                              <Typography variant="body2">
                                入力材料: {analysis.input_materials.length}種類
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* シミュレーション結果表示 */}
      {network.productionSummary && (
        <Accordion 
          expanded={expandedAccordion === 'results'} 
          onChange={() => setExpandedAccordion(expandedAccordion === 'results' ? null : 'results')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <BuildIcon sx={{ mr: 1 }} />
            <Typography variant="h6">シミュレーション結果</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {network.productionSummary.total_production || 0}
                    </Typography>
                    <Typography variant="body2">総生産数</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="secondary">
                      {network.networkPerformance?.total_processes || 0}
                    </Typography>
                    <Typography variant="body2">総工程数</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success">
                      {network.networkPerformance?.kanban_usage || 0}
                    </Typography>
                    <Typography variant="body2">かんばん使用</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default NetworkSimulationControl;
