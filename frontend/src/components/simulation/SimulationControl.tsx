import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  ButtonGroup,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { startSimulation, pauseSimulation, stopSimulation } from '../../store/slices/simulationSlice';
import { simulationApi, networkSimulationApi } from '../../api/simulationApi';
import { BufferUtils } from '../../utils/bufferUtils';

const SimulationControl: React.FC = () => {
  const dispatch = useDispatch();
  const { isRunning, isPaused } = useSelector((state: RootState) => state.simulation);
  const { networkData } = useSelector((state: RootState) => state.project);
  
  // 製品IDから製品名を取得する関数
  const getProductNameById = (productId: string): string => {
    console.log(`🔍 Looking up product name for ID: "${productId}"`);
    
    // 旧サンプルデータのIDマッピング
    const legacyIdMapping: Record<string, string> = {
      'prod_steel': '部品A',
      'prod_bolt': '部品B', 
      'prod_bracket': '完成品A'
    };
    
    // まず旧IDマッピングを確認
    if (legacyIdMapping[productId]) {
      console.log(`🔍 Legacy ID mapping: ${productId} -> ${legacyIdMapping[productId]}`);
      return legacyIdMapping[productId];
    }
    
    // 次に製品リストから検索
    if (networkData?.products) {
      console.log(`🔍 Searching in products list:`, networkData.products.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      
      // 正確なIDマッチ
      const exactMatch = networkData.products.find((p: any) => p.id === productId);
      if (exactMatch) {
        console.log(`🔍 Exact ID match: ${productId} -> ${exactMatch.name || exactMatch.label}`);
        return exactMatch.name || exactMatch.label || productId;
      }
      
      // コードでのマッチ
      const codeMatch = networkData.products.find((p: any) => p.code === productId);
      if (codeMatch) {
        console.log(`🔍 Code match: ${productId} -> ${codeMatch.name || codeMatch.label}`);
        return codeMatch.name || codeMatch.label || productId;
      }
      
      // 名前での部分マッチ（フォールバック）
      const nameMatch = networkData.products.find((p: any) => 
        (p.name && p.name.includes(productId)) || 
        (p.label && p.label.includes(productId))
      );
      if (nameMatch) {
        console.log(`🔍 Name partial match: ${productId} -> ${nameMatch.name || nameMatch.label}`);
        return nameMatch.name || nameMatch.label || productId;
      }
    } else {
      console.log(`🔍 No products list available in networkData`);
    }
    
    // 数字のIDの場合、部品リストの順序から推測を試行
    if (/^\d+$/.test(productId)) {
      console.log(`🔍 Numeric ID detected: ${productId}, attempting to map to known products`);
      
      // よく使われる製品名のマッピングを試行
      const commonProductMapping: Record<string, string> = {
        '1755496282693': '完成品A',  // 実際に表示されているIDに対するマッピング
        'ProductA': '完成品A',
        'ProductB': '完成品B',
        'PartsA': '部品A',
        'PartsB': '部品B'
      };
      
      if (commonProductMapping[productId]) {
        console.log(`🔍 Common product mapping: ${productId} -> ${commonProductMapping[productId]}`);
        return commonProductMapping[productId];
      }
    }
    
    console.log(`🔍 No mapping found for: ${productId}, returning as-is`);
    return productId; // 見つからない場合はIDをそのまま返す
  };
  
  // ローカル状態管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');
  const [simulationStatus, setSimulationStatus] = useState<any>(null);
  const [simulationResults, setSimulationResults] = useState<any>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [logVisible, setLogVisible] = useState(true);
  const monitoringActiveRef = useRef(false);
  
  // ネットワークデータの検証
  const validateNetworkData = () => {
    if (!networkData) {
      return { isValid: false, message: 'ネットワークデータがありません。ネットワーク設計タブでノードを追加してください。' };
    }
    if (!networkData.nodes || networkData.nodes.length === 0) {
      return { isValid: false, message: 'ノードがありません。ネットワーク設計タブで工程ノードを追加してください。' };
    }
    const processNodes = networkData.nodes.filter(node => node.type === 'process');
    if (processNodes.length === 0) {
      return { isValid: false, message: '工程ノードがありません。シミュレーションには少なくとも1つの工程ノードが必要です。' };
    }
    return { isValid: true, message: `工程ノード${processNodes.length}個、接続${networkData.edges?.length || 0}個で実行準備完了` };
  };
  
  const validation = validateNetworkData();

  const handleStart = async () => {
    console.log('開始ボタンが押されました');
    setLoading(true);
    setError(null);
    
    try {
      // ネットワークデータ検証
      if (!validation.isValid) {
        setError(validation.message);
        return;
      }
      
      console.log('ネットワークデータ:', networkData);
      console.log('工程ノード数:', networkData?.nodes?.filter(n => n.type === 'process').length);
      console.log('接続数:', networkData?.edges?.length || 0);
      
      // 詳細ログを追加
      const processNodes = networkData?.nodes?.filter(n => n.type === 'process') || [];
      console.log('=== ネットワークデータ詳細確認 ===');
      
      // 全ノードの詳細を出力
      networkData?.nodes?.forEach(node => {
        console.log(`\n📋 ノード: ${node.id} (${node.type})`);
        console.log(`  位置: x=${node.position?.x}, y=${node.position?.y}`);
        console.log(`  データ全体:`, node.data);
        
        if (node.data) {
          Object.entries(node.data).forEach(([key, value]) => {
            console.log(`    ${key}: ${JSON.stringify(value)}`);
          });
        }
      });
      
      console.log('\n🔗 エッジ（接続）詳細:');
      networkData?.edges?.forEach(edge => {
        console.log(`  ${edge.source} → ${edge.target} (${edge.id})`);
        console.log(`    データ:`, edge.data);
      });
      
      console.log('\n📦 製品データ:');
      if (networkData?.products) {
        console.log(`  製品配列:`, networkData.products);
      } else {
        console.log(`  製品データなし`);
      }
      
      console.log('=====================================');
      
      // ネットワークシミュレーションAPIを使用
      const config = {
        start_time: new Date().toISOString(),
        duration: 300, // 5分間のシミュレーション（長めに設定）
        speed: 1,
        network_data: {
          nodes: networkData?.nodes || [],
          edges: networkData?.edges || [],
          products: networkData?.products || []
        },
        enable_scheduling_control: true,
        enable_real_time_update: true
      };
      
      console.log('ネットワークシミュレーション開始:', config);
      const result = await networkSimulationApi.startNetworkSimulation(config);
      console.log('ネットワークシミュレーション結果:', result);
      
      // API成功時にRedux状態更新（監視開始前に実行）
      dispatch(startSimulation());
      setApiStatus('connected');
      
      console.log('Redux状態更新後 - 監視開始前チェック');
      
      // すぐに監視開始
      startStatusMonitoring();
      
      // ログをクリア
      setEventLog([]);
      addLog(`🚀 シミュレーション開始: ${new Date().toLocaleTimeString()}`);
      addLog(`📊 ネットワーク構成: ${processNodes.length}工程, ${networkData?.edges?.length || 0}接続`);
      
      // 各工程の基本情報をログに記録
      processNodes.forEach(node => {
        addLog(`🏭 工程: ${node.data.label} (CT:${node.data.cycleTime}秒, 設備:${node.data.equipmentCount}台)`);
        
        // 設定の問題をチェック
        if ((node.data.equipmentCount || 0) === 0) {
          addLog(`⚠️ 警告: ${node.data.label} - 設備数が0台です。シミュレーションが動作しません。`);
        }
        if ((node.data.cycleTime || 0) === 0 && node.data.type !== 'storage') {
          addLog(`⚠️ 警告: ${node.data.label} - サイクルタイムが0秒です。`);
        }
      });
      
      // 接続の確認
      const edges = networkData?.edges || [];
      if (processNodes.length > 0 && edges.length === 0) {
        addLog(`⚠️ 警告: 工程間の接続がありません。材料フローが発生しません。`);
      }
      
      // 初期材料の警告と開始工程特定
      const startingProcesses = processNodes.filter(node => {
        const incomingEdges = edges.filter(edge => edge.target === node.id);
        return incomingEdges.length === 0; // 入力接続がない = 開始工程
      });
      
      if (processNodes.length > 0 && startingProcesses.length === 0) {
        addLog(`⚠️ 警告: 開始工程が見つかりません。初期材料投入が必要です。`);
      } else if (startingProcesses.length > 0) {
        startingProcesses.forEach(process => {
          addLog(`🎯 開始工程特定: ${process.data.label} - 初期材料投入予定`);
        });
        addLog(`📋 バックエンドサーバーが更新コードを読み込んでいれば材料投入されます`);
      }
      
    } catch (err: any) {
      console.error('シミュレーション開始エラー:', err);
      setError(err.message || 'シミュレーション開始に失敗しました');
      setApiStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    console.log('一時停止ボタンが押されました');
    setLoading(true);
    setError(null);
    
    try {
      if (isPaused) {
        console.log('API再開呼び出し');
        const result = await simulationApi.resume();
        console.log('再開結果:', result);
        dispatch(startSimulation()); // 再開
      } else {
        console.log('API一時停止呼び出し');
        const result = await simulationApi.pause();
        console.log('一時停止結果:', result);
        dispatch(pauseSimulation());
      }
      setApiStatus('connected');
      
    } catch (err: any) {
      console.error('一時停止/再開エラー:', err);
      setError(err.message || '操作に失敗しました');
      setApiStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    console.log('停止ボタンが押されました');
    setLoading(true);
    setError(null);
    
    try {
      console.log('API停止呼び出し');
      const result = await simulationApi.stop();
      console.log('停止結果:', result);
      
      dispatch(stopSimulation());
      setApiStatus('connected');
      monitoringActiveRef.current = false;
      
    } catch (err: any) {
      console.error('停止エラー:', err);
      setError(err.message || 'シミュレーション停止に失敗しました');
      setApiStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  // ログにメッセージを追加
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLog(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]); // 最新20件を保持
  };

  // ステータス監視を開始
  const startStatusMonitoring = () => {
    monitoringActiveRef.current = true;
    console.log('監視フラグ設定:', monitoringActiveRef.current);
    
    const intervalId = setInterval(async () => {
      console.log('監視実行チェック - monitoringActive:', monitoringActiveRef.current);
      
      if (!monitoringActiveRef.current) {
        console.log('監視停止 - monitoringActive:', monitoringActiveRef.current);
        clearInterval(intervalId);
        return;
      }
      
      try {
        console.log('ステータス監視実行中...', new Date().toLocaleTimeString());
        const status = await networkSimulationApi.getNetworkSimulationStatus();
        const prevStatus = simulationStatus;
        setSimulationStatus(status);
        
        // デバッグ: 毎回のステータス取得をログ
        addLog(`🔄 ステータス更新: ${new Date().toLocaleTimeString()}`);
        
        // ステータス変化をログに記録
        if (!prevStatus || prevStatus.status !== status.status) {
          addLog(`📊 状態変更: ${status.status}`);
        }
        
        // シミュレーション時刻の進行を監視（定期的に記録）
        const currentMinute = Math.floor(Date.now() / 30000); // 30秒ごと
        const prevLogTime = prevStatus?.logTime || 0;
        
        if (status.current_time && currentMinute !== prevLogTime) {
          const simTime = new Date(status.current_time).toLocaleTimeString();
          addLog(`⏰ シミュレーション進行中... ${simTime}`);
          status.logTime = currentMinute; // 次回比較用
        }
        
        // 生産数変化をログに記録
        if (status.production_summary && status.production_summary.total_production !== prevStatus?.production_summary?.total_production) {
          addLog(`📦 生産数更新: ${status.production_summary.total_production}個`);
        }
        
        // 工程別生産数をチェック
        if (status.production_summary?.process_production) {
          Object.entries(status.production_summary.process_production).forEach(([processId, count]) => {
            const prevCount = prevStatus?.production_summary?.process_production?.[processId] || 0;
            if (count !== prevCount) {
              addLog(`🏭 ${processId}: ${count}個 (+${Number(count) - Number(prevCount)})`);
            }
          });
        }
        
        // アクティビティがない場合の詳細診断ログ（毎回実行）
        if (status.status === 'running') {
          const totalProduction = status.production_summary?.total_production || 0;
          const processCount = Object.keys(status.production_summary?.process_production || {}).length;
          const bufferCount = Object.keys(status.production_summary?.buffer_inventory || {}).length;
          
          // 生産活動がない場合は問題診断
          if (totalProduction === 0 && processCount === 0) {
            // ネットワーク設定の問題をチェック
            const processNodes = networkData?.nodes?.filter(n => n.type === 'process') || [];
            const problemNodes = processNodes.filter(node => 
              (node.data?.equipmentCount || 0) === 0 || 
              (node.data?.cycleTime || 0) === 0
            );
            
            if (problemNodes.length > 0) {
              problemNodes.forEach(node => {
                const issues = [];
                if ((node.data?.equipmentCount || 0) === 0) issues.push('設備数0');
                if ((node.data?.cycleTime || 0) === 0) issues.push('サイクルタイム0');
                addLog(`⚠️ 問題: ${node.data?.label} - ${issues.join(', ')}`);
              });
            } else {
              addLog(`🔍 診断: 初期材料または接続設定を確認中...`);
            }
          } else {
            addLog(`🔄 監視中: 生産${totalProduction}個, 稼働工程${processCount}, バッファ${bufferCount}`);
          }
        }
        
        // バッファ在庫変化をチェック
        if (status.production_summary?.buffer_inventory) {
          Object.entries(status.production_summary.buffer_inventory).forEach(([bufferId, inventory]) => {
            const prevInventory = prevStatus?.production_summary?.buffer_inventory?.[bufferId] || 0;
            if (inventory !== prevInventory && Number(inventory) > 0) {
              addLog(`📋 ${bufferId}: ${inventory}個在庫`);
            }
          });
        }
        
        // スケジューリング分析をチェック
        if (status.scheduling_analysis && Object.keys(status.scheduling_analysis).length > 0) {
          Object.entries(status.scheduling_analysis).forEach(([processId, analysis]: [string, any]) => {
            if (analysis.status && analysis.status !== prevStatus?.scheduling_analysis?.[processId]?.status) {
              addLog(`⚙️ ${processId}スケジューリング: ${analysis.status}`);
            }
          });
        }
        
        // シミュレーションが完了した場合
        if (status.status === 'stopped' || status.status === 'completed') {
          addLog(`✅ シミュレーション完了: ${new Date().toLocaleTimeString()}`);
          
          const results = await networkSimulationApi.getNetworkSimulationResults();
          setSimulationResults(results);
          console.log('シミュレーション結果:', results);
          
          // 監視停止
          monitoringActiveRef.current = false;
          
          // Redux状態を更新
          dispatch(stopSimulation());
          setApiStatus('connected');
        }
        
      } catch (err) {
        console.error('ステータス取得エラー:', err);
        addLog(`❌ ステータス取得エラー: ${err}`);
        setApiStatus('disconnected');
      }
    }, 2000); // 2秒ごとに更新
    
    // デバッグ: インターバルIDを保存
    console.log('ステータス監視開始:', intervalId);
  };

  // 現在の状態を文字列で取得
  const getStatusText = () => {
    if (isRunning && !isPaused) return "実行中";
    if (isRunning && isPaused) return "一時停止中";
    return "停止中";
  };

  const getStatusColor = () => {
    if (isRunning && !isPaused) return "success";
    if (isRunning && isPaused) return "warning";
    return "default";
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            シミュレーション制御
          </Typography>
          
          {/* エラー表示 */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {/* ネットワーク状態表示 */}
          <Alert 
            severity={validation.isValid ? 'success' : 'warning'} 
            sx={{ mb: 2 }}
          >
            {validation.message}
          </Alert>
          
          {/* ネットワーク詳細情報 */}
          {networkData && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              {/* デバッグ: 製品情報の存在確認 */}
              {(() => {
                console.log('\n📊 ===== NetworkData全体分析 =====');
                console.log('📊 NetworkData keys:', Object.keys(networkData));
                console.log('📊 NetworkData.products:', networkData.products);
                console.log('📊 NetworkData.nodes数:', networkData.nodes?.length || 0);
                console.log('📊 NetworkData.edges数:', networkData.edges?.length || 0);
                
                // 各ノードの現在の inputs/outputs 状況をまとめて確認
                console.log('\n📋 全ノードの材料設定状況:');
                networkData.nodes?.filter(n => n.type === 'process' || n.type === 'store').forEach(node => {
                  const nodeType = node.type === 'store' ? 'ストア' : '工程';
                  console.log(`  ${nodeType}: ${node.data?.label}(${node.id}): inputs=${node.data?.inputs?.length || 0}, outputs=${node.data?.outputs?.length || 0}`);
                  
                  // ストアノードの場合、製品スケジュール情報も表示
                  if (node.type === 'store') {
                    const scheduleData = node.data?.productSchedule || 
                                       node.data?.schedule || 
                                       node.data?.productionPlan || 
                                       node.data?.productionSchedule || 
                                       node.data?.planItems || 
                                       node.data?.scheduleItems;
                    if (scheduleData) {
                      console.log(`    生産計画/スケジュール:`, scheduleData);
                    } else {
                      console.log(`    生産計画/スケジュール: 設定なし`);
                    }
                  }
                });
                
                return null;
              })()}
              <Typography variant="body2" color="text.secondary" gutterBottom>
                現在のネットワーク構成:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip 
                  label={`総ノード: ${networkData.nodes?.length || 0}`} 
                  size="small" 
                  variant="outlined"
                />
                <Chip 
                  label={`工程: ${networkData.nodes?.filter(n => n.type === 'process').length || 0}`} 
                  size="small" 
                  variant="outlined"
                  color="primary"
                />
                <Chip 
                  label={`バッファ: ${networkData.nodes?.filter(n => n.type === 'store').length || 0}`} 
                  size="small" 
                  variant="outlined"
                  color="secondary"
                />
                <Chip 
                  label={`接続: ${networkData.edges?.length || 0}`} 
                  size="small" 
                  variant="outlined"
                  color="info"
                />
              </Box>
              
              {/* 工程ノード一覧 */}
              {networkData.nodes?.filter(n => n.type === 'process').length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    工程ノード一覧:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {networkData.nodes.filter(n => n.type === 'process' || n.type === 'store').map(node => (
                      <Chip 
                        key={node.id}
                        label={`${node.data?.label || node.id} (${node.data?.cycleTime || 60}秒)`}
                        size="small"
                        variant="filled"
                        color="primary"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {networkData.nodes?.length === 0 && (
                <Alert severity="info">
                  ネットワーク設計タブでノードを追加してからシミュレーションを実行してください。
                </Alert>
              )}
            </Box>
          )}
          
          {/* 状態表示 */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="h6" component="span">
              現在の状態:
            </Typography>
            <Chip 
              label={getStatusText()} 
              color={getStatusColor() as any}
              size="medium"
            />
            <Chip
              label={apiStatus === 'connected' ? 'API接続中' : 'API未接続'}
              color={apiStatus === 'connected' ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </Box>


          {/* コントロールボタン */}
          <ButtonGroup variant="contained" size="large" sx={{ gap: 1 }}>
            <Button
              onClick={handleStart}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
              disabled={loading || (isRunning && !isPaused) || !validation.isValid}
              color="success"
            >
              開始
            </Button>
            
            <Button
              onClick={handlePause}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PauseIcon />}
              disabled={loading || !isRunning}
              color="warning"
            >
              {isPaused ? '再開' : '一時停止'}
            </Button>
            
            <Button
              onClick={handleStop}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <StopIcon />}
              disabled={loading || !isRunning}
              color="error"
            >
              停止
            </Button>
          </ButtonGroup>

          {/* シミュレーション監視情報 */}
          {(simulationStatus || simulationResults) && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
              <Typography variant="h6" color="primary.main" gutterBottom>
                シミュレーション監視
              </Typography>
              
              {simulationStatus && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>現在の状態:</strong> {simulationStatus.status}
                  </Typography>
                  {simulationStatus.current_time && (
                    <Typography variant="body2" color="text.secondary">
                      <strong>シミュレーション時刻:</strong> {simulationStatus.current_time}
                    </Typography>
                  )}
                  {simulationStatus.production_summary && (
                    <Typography variant="body2" color="text.secondary">
                      <strong>総生産数:</strong> {simulationStatus.production_summary.total_production || 0}個
                    </Typography>
                  )}
                </Box>
              )}

              {simulationResults && (
                <Box>
                  <Typography variant="subtitle1" color="success.main" gutterBottom>
                    シミュレーション完了！
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>実行時間:</strong> {simulationResults.duration || 0}秒
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>総イベント数:</strong> {simulationResults.total_events || 0}
                  </Typography>
                  {simulationResults.production_summary && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        <strong>最終生産数:</strong> {simulationResults.production_summary.total_production || 0}個
                      </Typography>
                      {simulationResults.production_summary.process_production && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>工程別生産数:</strong>
                          </Typography>
                          {Object.entries(simulationResults.production_summary.process_production).map(([processId, count]) => (
                            <Typography key={processId} variant="caption" display="block" sx={{ ml: 2 }}>
                              {processId}: {String(count)}個
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* リアルタイムイベントログ */}
          {eventLog.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" color="primary.main">
                  リアルタイムログ
                </Typography>
                <Button
                  size="small"
                  onClick={() => setLogVisible(!logVisible)}
                  startIcon={logVisible ? '🔽' : '🔼'}
                >
                  {logVisible ? '折りたたむ' : '展開する'}
                </Button>
              </Box>
              
              {logVisible && (
                <Box 
                  sx={{ 
                    maxHeight: 300, 
                    overflow: 'auto', 
                    bgcolor: 'grey.900', 
                    color: 'common.white',
                    p: 1.5, 
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    lineHeight: 1.4
                  }}
                >
                  {eventLog.length === 0 ? (
                    <Typography variant="caption" color="grey.400">
                      イベントログは表示されません
                    </Typography>
                  ) : (
                    eventLog.map((log, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          mb: 0.5,
                          '&:last-child': { mb: 0 }
                        }}
                      >
                        {log}
                      </Box>
                    ))
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* データ更新ボタン */}
          <Box sx={{ mt: 2, mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              データ再読み込み
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              工程設定が反映されない場合はクリックしてください
            </Typography>
          </Box>

          {/* デバッグ情報 */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              デバッグ情報:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Redux状態: isRunning={String(isRunning)}, isPaused={String(isPaused)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              API状態: {apiStatus}, Loading: {String(loading)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ネットワーク検証: {validation.isValid ? '✓ 有効' : '✗ 無効'}
            </Typography>
            
            {/* 詳細ネットワークデータ表示 */}
            {networkData?.nodes && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>📋 全工程パラメーター詳細:</strong>
                </Typography>
                
                {networkData.nodes.filter(n => n.type === 'process' || n.type === 'store').map(node => (
                  <Box key={node.id} sx={{ 
                    mb: 2, 
                    p: 1.5, 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    borderRadius: 1, 
                    bgcolor: 'background.paper' 
                  }}>
                    <Typography variant="subtitle2" color="primary.main" gutterBottom>
                      {node.type === 'store' ? '🏪' : '🏭'} {node.data?.label || node.id} (ID: {node.id})
                    </Typography>
                    
                    {/* 基本設定 */}
                    <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      <strong>基本設定:</strong>
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                      工程タイプ: {node.data?.type || 'unknown'} | 設備: {node.data?.equipmentCount || 0}台 | 作業者: {node.data?.operatorCount || 0}人
                    </Typography>
                    {/* 時間関連情報は出力製品ごとに設定されるため、基本設定からは削除 */}
                    {/* 効率情報 */}
                    {(node.data?.efficiency || node.data?.availability || node.data?.performanceRate) && (
                      <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                        効率: {node.data?.efficiency || 100}% | 稼働率: {node.data?.availability || 100}% | 性能: {node.data?.performanceRate || 100}%
                      </Typography>
                    )}
                    
                    {/* ストアノード専用の情報 */}
                    {node.type === 'store' && (
                      <>
                        <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                          容量: {node.data?.capacity || node.data?.inputBufferCapacity || 'N/A'}
                        </Typography>
                        {node.data?.scheduleType && (
                          <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                            スケジュールタイプ: {node.data.scheduleType}
                          </Typography>
                        )}
                      </>
                    )}
                    
                    {/* 在庫・バッファ状態は工程バッファサマリーで表示されるため削除 */}
                    
                    {/* 品質設定 */}
                    {node.data?.qualitySettings && (
                      <>
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 1, mb: 0.5 }}>
                          <strong>品質設定:</strong>
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                          不良率: {node.data.qualitySettings.defectRate || 0}%
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                          手直し率: {node.data.qualitySettings.reworkRate || 0}%
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                          廃棄率: {node.data.qualitySettings.scrapRate || 0}%
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                          検査時間: {node.data.qualitySettings.inspectionTime || 0}秒
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                          検査能力: {node.data.qualitySettings.inspectionCapacity || 0}個/時
                        </Typography>
                      </>
                    )}
                    
                    {/* 材料設定（入力・出力） */}
                    {(node.data?.inputs || node.data?.outputs) && (
                      <>
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 1, mb: 0.5 }}>
                          <strong>材料・バッファ設定（各部品ごとに個別管理）:</strong>
                        </Typography>
                        {/* デバッグログ - バッファ設定特化 */}
                        {(() => {
                          console.log(`\n🔍 =================================`);
                          console.log(`🔍 [${node.data?.label || node.id}] バッファ設定デバッグ`);
                          console.log(`🔍 ノードID: ${node.id}`);
                          console.log(`🔍 ノードタイプ: ${node.type}`);
                          console.log(`🔍 =================================`);
                          
                          // 入力材料のバッファ設定詳細チェック
                          if (node.data?.inputs) {
                            console.log(`🔍 入力材料数: ${node.data.inputs.length}`);
                            node.data.inputs.forEach((input: any, idx: number) => {
                              console.log(`🔍 入力[${idx}]:`, {
                                materialId: input.materialId,
                                materialName: input.materialName,
                                hasBufferSettings: !!input.bufferSettings,
                                bufferSettingsEnabled: input.bufferSettings?.enabled,
                                bufferSettingsStructure: input.bufferSettings,
                                hasInitialBufferSettings: !!input.initialBufferSettings, // 旧プロパティ
                                allProperties: Object.keys(input)
                              });
                            });
                          }
                          
                          // 出力製品のバッファ設定詳細チェック
                          if (node.data?.outputs) {
                            console.log(`🔍 出力製品数: ${node.data.outputs.length}`);
                            node.data.outputs.forEach((output: any, idx: number) => {
                              console.log(`🔍 出力[${idx}]:`, {
                                productId: output.productId,
                                productName: output.productName,
                                hasBufferSettings: !!output.bufferSettings,
                                bufferSettingsEnabled: output.bufferSettings?.enabled,
                                bufferSettingsStructure: output.bufferSettings,
                                allProperties: Object.keys(output)
                              });
                            });
                          }
                          
                          console.log(`🔍 node.data全体:`, node.data);
                          console.log(`🔍 =================================`);
                          
                          // ストアノード固有の情報
                          if (node.type === 'store') {
                            console.log(`🔍 ストア専用情報:`);
                            console.log(`🔍 - productSchedule:`, node.data?.productSchedule);
                            console.log(`🔍 - schedule:`, node.data?.schedule);
                            console.log(`🔍 - productionPlan:`, node.data?.productionPlan);
                            console.log(`🔍 - productionSchedule:`, node.data?.productionSchedule);
                            console.log(`🔍 - planItems:`, node.data?.planItems);
                            console.log(`🔍 - scheduleItems:`, node.data?.scheduleItems);
                            console.log(`🔍 - storeType:`, node.data?.storeType);
                            console.log(`🔍 - storagePolicy:`, node.data?.storagePolicy);
                            console.log(`🔍 - capacity:`, node.data?.capacity);
                            
                            // 全プロパティをチェック
                            console.log(`🔍 全てのストアノードプロパティ:`, Object.keys(node.data || {}));
                          }
                          
                          // processAdvancedDataもチェック（もしあれば）
                          const globalWindow = window as any;
                          if (globalWindow.processAdvancedData) {
                            console.log(`🔍 processAdvancedData存在:`, !!globalWindow.processAdvancedData);
                            const advancedData = globalWindow.processAdvancedData.get?.(node.id);
                            if (advancedData) {
                              console.log(`🔍 [${node.id}] advancedData:`, advancedData);
                              console.log(`🔍 [${node.id}] advancedData.inputMaterials:`, advancedData.inputMaterials);
                              console.log(`🔍 [${node.id}] advancedData.outputProducts:`, advancedData.outputProducts);
                            } else {
                              console.log(`🔍 [${node.id}] advancedDataなし`);
                            }
                          }
                          return null;
                        })()}
                        
                        {node.data?.inputs?.length > 0 && (
                          <>
                            <Typography variant="caption" display="block" sx={{ ml: 1, color: 'info.main' }}>
                              入力材料: {node.data.inputs.length}種類
                            </Typography>
                            {node.data.inputs.map((input: any, idx: number) => {
                              // デバッグ：各inputオブジェクトの構造を確認
                              console.log(`🔍 [${node.id}] Input ${idx}:`, input);
                              console.log(`🔍 [${node.id}] Input type:`, typeof input);
                              console.log(`🔍 [${node.id}] Is string:`, typeof input === 'string');
                              console.log(`🔍 [${node.id}] Available properties:`, Object.keys(input));
                              
                              let materialName, quantity, bufferInfo;
                              
                              if (typeof input === 'string') {
                                // 古い形式（文字列の製品ID）
                                const productName = getProductNameById(input);
                                materialName = productName !== input ? productName : input;
                                quantity = 1;
                                bufferInfo = null;
                                console.log(`🔍 [${node.id}] String input - ID: "${input}", Name: "${materialName}"`);
                              } else {
                                // 新しい形式（MaterialInputオブジェクト）
                                materialName = input.materialName || input.product_name || input.name || input.product_id || input.material_id || `材料${idx+1}`;
                                quantity = input.requiredQuantity || input.required_quantity || input.quantity || 1;
                                
                                // ロットサイズベースのバッファ情報
                              console.log(`🔍 入力バッファチェック[${materialName}]:`, {
                                hasBufferSettings: !!input.bufferSettings,
                                enabled: input.bufferSettings?.enabled,
                                bufferSettings: input.bufferSettings
                              });
                              
                              if (input.bufferSettings && input.bufferSettings.enabled) {
                                  const materialId = input.materialId || input.material_id || input.product_id || '';
                                  const lotSize = BufferUtils.getLotSize(materialId, networkData?.products || []);
                                  const maxLots = input.bufferSettings.maxLots || 5;
                                  const maxCapacity = maxLots * lotSize;
                                  const initialStock = input.bufferSettings.initialStock || 0;
                                  const safetyStock = input.bufferSettings.safetyStock || 0;
                                  
                                  bufferInfo = {
                                    maxLots,
                                    maxCapacity,
                                    initialStock,
                                    safetyStock,
                                    lotSize
                                  };
                                }
                                
                                console.log(`🔍 [${node.id}] Object input - Name: "${materialName}", quantity: ${quantity}, buffer:`, bufferInfo);
                              }
                              
                              // BOM情報を取得して、実際の使用量を表示
                              let bomUsage = quantity; // デフォルトはnode.dataの数量
                              let bomInfo = '';
                              
                              // BOM情報がある場合、詳細な使用量を表示
                              if (networkData?.products && input.materialId) {
                                // ここでBOMデータから実際の使用量を取得できる
                                // 現状ではnode.dataの設定値を使用
                                bomUsage = quantity;
                                bomInfo = input.unit ? ` (${input.unit})` : ' (個)';
                              }
                              
                              return (
                                <Typography key={idx} variant="caption" display="block" sx={{ ml: 2, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                  - {materialName}
                                  <br />
                                  　BOM使用量: {bomUsage}{bomInfo}/製品 {input.timing && `(投入: ${input.timing})`}
                                  {bufferInfo ? (
                                    <>
                                      <br />
                                      　📦 入力バッファ: 最大{bufferInfo.maxLots}ロット = {bufferInfo.maxCapacity}個 (1ロット={bufferInfo.lotSize}個)
                                      <br />
                                      　　初期在庫: {bufferInfo.initialStock}個 ({Math.floor(bufferInfo.initialStock / bufferInfo.lotSize)}ロット) | 安全在庫: {bufferInfo.safetyStock}個 ({Math.floor(bufferInfo.safetyStock / bufferInfo.lotSize)}ロット)
                                    </>
                                  ) : (
                                    <>
                                      <br />
                                      　⚠️ 入力バッファ: 未設定（旧形式または無効）
                                    </>
                                  )}
                                  {input.supplyMethod && (
                                    <>
                                      <br />
                                      　供給方式: {input.supplyMethod === 'manual' ? '手動' : input.supplyMethod === 'automated' ? '自動' : input.supplyMethod}
                                    </>
                                  )}
                                </Typography>
                              );
                            })}
                          </>
                        )}
                        
                        {node.data?.outputs?.length > 0 && (
                          <>
                            <Typography variant="caption" display="block" sx={{ ml: 1, color: 'success.main' }}>
                              出力製品: {node.data.outputs.length}種類
                            </Typography>
                            {node.data.outputs.map((output: any, idx: number) => {
                              // デバッグ：各outputオブジェクトの構造を確認
                              console.log(`🔍 [${node.id}] Output ${idx}:`, output);
                              console.log(`🔍 [${node.id}] Output type:`, typeof output);
                              console.log(`🔍 [${node.id}] Is string:`, typeof output === 'string');
                              console.log(`🔍 [${node.id}] Available properties:`, Object.keys(output));
                              
                              let productName, quantity, cycleTime, setupTime, bufferInfo;
                              
                              if (typeof output === 'string') {
                                // 古い形式（文字列の製品ID）
                                const resolvedProductName = getProductNameById(output);
                                productName = resolvedProductName !== output ? resolvedProductName : output;
                                quantity = 1;
                                cycleTime = undefined;
                                setupTime = undefined;
                                bufferInfo = null;
                                console.log(`🔍 [${node.id}] String output - ID: "${output}", Name: "${productName}"`);
                              } else {
                                // 新しい形式（ProductOutputオブジェクト）
                                productName = output.productName || output.product_name || output.name || output.product_id || output.material_id || `製品${idx+1}`;
                                quantity = output.outputQuantity || output.quantity || 1;
                                cycleTime = output.cycleTime;
                                setupTime = output.setupTime;
                                
                                // ロットサイズベースの出力バッファ情報
                              console.log(`🔍 出力バッファチェック[${productName}]:`, {
                                hasBufferSettings: !!output.bufferSettings,
                                enabled: output.bufferSettings?.enabled,
                                bufferSettings: output.bufferSettings
                              });
                              
                              if (output.bufferSettings && output.bufferSettings.enabled) {
                                  const productId = output.productId || output.product_id || output.material_id || '';
                                  const lotSize = BufferUtils.getLotSize(productId, networkData?.products || []);
                                  const maxLots = output.bufferSettings.maxLots || 5;
                                  const maxCapacity = maxLots * lotSize;
                                  const initialStock = output.bufferSettings.initialStock || 0;
                                  const safetyStock = output.bufferSettings.safetyStock || 0;
                                  
                                  bufferInfo = {
                                    maxLots,
                                    maxCapacity,
                                    initialStock,
                                    safetyStock,
                                    lotSize
                                  };
                                }
                                
                                console.log(`🔍 [${node.id}] Object output - Name: "${productName}", quantity: ${quantity}, cycle: ${cycleTime}, setup: ${setupTime}, buffer:`, bufferInfo);
                              }
                              
                              return (
                                <Typography key={idx} variant="caption" display="block" sx={{ ml: 2, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                  - {productName}
                                  <br />
                                  　生産数: {quantity}個/サイクル {output.unit && `(${output.unit})`}
                                  <br />
                                  　⏱️ サイクルタイム: {cycleTime || 60}秒 | 段取り時間: {setupTime || 0}分
                                  {bufferInfo ? (
                                    <>
                                      <br />
                                      　📦 出力バッファ: 最大{bufferInfo.maxLots}ロット = {bufferInfo.maxCapacity}個 (1ロット={bufferInfo.lotSize}個)
                                      <br />
                                      　　初期在庫: {bufferInfo.initialStock}個 ({Math.floor(bufferInfo.initialStock / bufferInfo.lotSize)}ロット) | 安全在庫: {bufferInfo.safetyStock}個 ({Math.floor(bufferInfo.safetyStock / bufferInfo.lotSize)}ロット)
                                    </>
                                  ) : (
                                    <>
                                      <br />
                                      　⚠️ 出力バッファ: 未設定（旧形式または無効）
                                    </>
                                  )}
                                  {(output.qualityLevel || output.packagingSpec) && (
                                    <>
                                      <br />
                                      　品質: {output.qualityLevel || 'standard'} {output.packagingSpec && `| 包装: ${output.packagingSpec}`}
                                    </>
                                  )}
                                </Typography>
                              );
                            })}
                          </>
                        )}
                        
                        {/* 製品スケジュール情報 - 複数のプロパティ名をチェック */}
                        {(() => {
                          const scheduleData = node.data?.productSchedule || 
                                             node.data?.schedule || 
                                             node.data?.productionPlan || 
                                             node.data?.productionSchedule || 
                                             node.data?.planItems || 
                                             node.data?.scheduleItems;
                          
                          if (!scheduleData) return null;
                          
                          return (
                            <>
                              <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 1, mb: 0.5 }}>
                                <strong>生産計画/スケジュール:</strong>
                              </Typography>
                              {Array.isArray(scheduleData) ? (
                                scheduleData.map((schedule: any, idx: number) => {
                                  // 生産計画のデータ構造に対応
                                  console.log(`🔍 Schedule ${idx} data:`, schedule);
                                  const productId = schedule.productId || 
                                                  schedule.product_id || 
                                                  schedule.productName || 
                                                  schedule.product_name ||
                                                  schedule.name ||
                                                  `製品${idx+1}`;
                                  console.log(`🔍 Schedule ${idx} productId:`, productId);
                                  
                                  const productName = getProductNameById(productId);
                                  console.log(`🔍 Schedule ${idx} resolved name:`, productName);
                                  const quantity = schedule.quantity || schedule.amount || '';
                                  const unit = schedule.unit || '個';
                                  const priority = schedule.priority || schedule.order || '';
                                  const startTime = schedule.startTime || schedule.start_time || schedule.開始時刻 || '';
                                  const endTime = schedule.endTime || schedule.end_time || schedule.終了時刻 || '';
                                  const status = schedule.status || schedule.state || schedule.状態 || '';
                                  
                                  return (
                                    <Typography key={idx} variant="caption" display="block" sx={{ ml: 2, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                      {priority && `${priority}. `}{productName}
                                      {quantity && ` (${quantity}${unit})`}
                                      {startTime && ` [${startTime}`}
                                      {endTime && `-${endTime}]`}
                                      {status && ` {${status}}`}
                                    </Typography>
                                  );
                                })
                              ) : (
                                <Typography variant="caption" display="block" sx={{ ml: 2, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                  スケジュール設定: {JSON.stringify(scheduleData)}
                                </Typography>
                              )}
                            </>
                          );
                        })()}
                        
                        {/* バッファ設定サマリー */}
                        {(() => {
                          // 全バッファのサマリーを計算
                          const inputBuffersWithSettings = node.data?.inputs?.filter((input: any) => 
                            input.bufferSettings?.enabled
                          ) || [];
                          const outputBuffersWithSettings = node.data?.outputs?.filter((output: any) => 
                            output.bufferSettings?.enabled
                          ) || [];
                          
                          const totalInputCapacity = inputBuffersWithSettings.reduce((sum: number, input: any) => {
                            const materialId = input.materialId || input.material_id || input.product_id || '';
                            const lotSize = BufferUtils.getLotSize(materialId, networkData?.products || []);
                            const maxLots = input.bufferSettings.maxLots || 5;
                            return sum + (maxLots * lotSize);
                          }, 0);
                          
                          const totalOutputCapacity = outputBuffersWithSettings.reduce((sum: number, output: any) => {
                            const productId = output.productId || output.product_id || output.material_id || '';
                            const lotSize = BufferUtils.getLotSize(productId, networkData?.products || []);
                            const maxLots = output.bufferSettings.maxLots || 5;
                            return sum + (maxLots * lotSize);
                          }, 0);
                          
                          if (inputBuffersWithSettings.length > 0 || outputBuffersWithSettings.length > 0) {
                            return (
                              <>
                                <Typography variant="caption" display="block" sx={{ color: 'primary.main', mt: 1.5, mb: 0.5 }}>
                                  <strong>📈 工程バッファサマリー:</strong>
                                </Typography>
                                {inputBuffersWithSettings.length > 0 && (
                                  <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace', color: 'info.main' }}>
                                    入力バッファ: {inputBuffersWithSettings.length}種類 → 合計最大容量: {totalInputCapacity}個
                                  </Typography>
                                )}
                                {outputBuffersWithSettings.length > 0 && (
                                  <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace', color: 'success.main' }}>
                                    出力バッファ: {outputBuffersWithSettings.length}種類 → 合計最大容量: {totalOutputCapacity}個
                                  </Typography>
                                )}
                                {/* 部品ごとの詳細は上記の材料設定セクションで表示される */}
                                <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace', color: 'text.secondary' }}>
                                  ※ 部品ごとの詳細は上記材料設定で確認できます
                                </Typography>
                              </>
                            );
                          }
                          
                          // 旧形式の場合のフォールバック表示
                          const hasOldFormat = (node.data?.inputBufferCapacity || node.data?.outputBufferCapacity);
                          if (hasOldFormat && inputBuffersWithSettings.length === 0 && outputBuffersWithSettings.length === 0) {
                            return (
                              <Typography variant="caption" display="block" sx={{ color: 'warning.main', mt: 1, ml: 1 }}>
                                ⚠️ 旧形式バッファ設定使用中。新形式では部品ごとに個別設定が必要です。
                              </Typography>
                            );
                          }
                          
                          return null;
                        })()}
                        
                        {/* ストア設定 */}
                        {(node.data?.storeType || node.data?.storagePolicy) && (
                          <>
                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 1, mb: 0.5 }}>
                              <strong>ストア設定:</strong>
                            </Typography>
                            {node.data.storeType && (
                              <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                                タイプ: {node.data.storeType}
                              </Typography>
                            )}
                            {node.data.storagePolicy && (
                              <Typography variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                                保管ポリシー: {node.data.storagePolicy}
                              </Typography>
                            )}
                          </>
                        )}
                      </>
                    )}
                    
                    {/* 位置情報 */}
                    <Typography variant="caption" display="block" sx={{ color: 'text.disabled', mt: 1 }}>
                      位置: ({node.position?.x || 0}, {node.position?.y || 0})
                    </Typography>
                  </Box>
                ))}
                
                {/* 接続情報 */}
                {networkData.edges && networkData.edges.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>🔗 接続詳細:</strong>
                    </Typography>
                    {networkData.edges.map(edge => (
                      <Typography key={edge.id} variant="caption" display="block" sx={{ ml: 1, fontFamily: 'monospace' }}>
                        {edge.source} → {edge.target}
                        {edge.data?.transportTime && ` (搬送: ${edge.data.transportTime}秒)`}
                        {edge.data?.transportLotSize && ` (搬送ロット: ${edge.data.transportLotSize}個)`}
                        {edge.data?.capacity && ` (容量: ${edge.data.capacity}個)`}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
            
            {error && (
              <Typography variant="body2" color="error">
                最新エラー: {error}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SimulationControl;