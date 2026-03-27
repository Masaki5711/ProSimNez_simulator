import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { 
  setWebSocketStatus, 
  setCurrentTime, 
  updateRealtimeData,
  startSimulation
} from '../store/slices/simulationSlice';
import { updateEquipmentStatus, updateInventory, setKPIData, addAlert } from '../store/slices/monitoringSlice';

// ログ追加用のコールバック型
export type LogCallback = (logEntry: {
  level: 'info' | 'warning' | 'error' | 'success' | 'debug';
  category: 'simulation' | 'process' | 'buffer' | 'transport' | 'system';
  message: string;
  details?: any;
  nodeId?: string;
  processId?: string;
  equipmentId?: string;
}) => void;

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/simulation';

// WebSocket再接続設定
const WS_CONFIG = {
  maxReconnectAttempts: 10,
  baseReconnectInterval: 1000,  // 1秒
  maxReconnectInterval: 30000,  // 最大30秒
  reconnectBackoffMultiplier: 1.5,
};

// 指数バックオフで再接続間隔を計算
const calculateReconnectDelay = (attemptNumber: number): number => {
  const delay = Math.min(
    WS_CONFIG.baseReconnectInterval * Math.pow(WS_CONFIG.reconnectBackoffMultiplier, attemptNumber),
    WS_CONFIG.maxReconnectInterval
  );
  // ジッター（±10%）を追加してサーバー負荷を分散
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
};

export const useWebSocket = (onLog?: LogCallback) => {
  const dispatch = useDispatch();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [simulationStartTime, setSimulationStartTime] = useState<number>(0);
  const reconnectAttemptRef = useRef<number>(0);
  const urlIndexRef = useRef<number>(0);
  const hasEverConnectedRef = useRef<boolean>(false);
  const candidateUrlsRef = useRef<string[]>([
    WS_URL,
    'ws://localhost:8000/ws/simulation',
  ]);

  const connect = useCallback(() => {
    try {
      const urls = candidateUrlsRef.current;
      if (!urls || urls.length === 0) {
        console.error('WebSocket URL候補がありません');
        return;
      }
      const urlToUse = urls[urlIndexRef.current % urls.length];
      console.log('WebSocket接続先:', urlToUse);
      ws.current = new WebSocket(urlToUse);

      ws.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        dispatch(setWebSocketStatus(true));
        hasEverConnectedRef.current = true;
        reconnectAttemptRef.current = 0;  // 接続成功時にカウンターをリセット

        // 接続時にシミュレーション時間をリセット
        setSimulationStartTime(0);
        dispatch(setCurrentTime(0));

        // 接続確認
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // メッセージタイプの判定（typeまたはevent_typeを使用）
          const messageType = message.type || message.event_type;
          
          if (!messageType) {
            console.warn('メッセージタイプが設定されていません:', message);
            return;
          }
          
          // シミュレーションイベントの処理
          if (message.event_type) {
            handleSimulationEvent(message);
            return;
          }
          
          switch (messageType) {
            case 'state_update':
              // 状態更新
              if (message.data) {
                dispatch(setCurrentTime(message.data.timestamp));
                
                // 在庫更新
                if (message.data.inventories) {
                  Object.entries(message.data.inventories).forEach(([bufferId, inventory]: [string, any]) => {
                    dispatch(updateInventory({
                      nodeId: bufferId,
                      quantity: inventory.total || 0,
                    }));
                  });
                }
                
                // 設備状態更新
                if (message.data.equipment_states) {
                  Object.entries(message.data.equipment_states).forEach(([processId, process]: [string, any]) => {
                    Object.entries(process.equipments).forEach(([equipmentId, state]: [string, any]) => {
                      dispatch(updateEquipmentStatus({
                        nodeId: equipmentId,
                        status: state.status
                      }));
                    });
                  });
                }
                
                // KPI更新
                if (message.data.kpis) {
                  dispatch(setKPIData({
                    oee: message.data.kpis.equipment_utilization || 0,
                    throughput: message.data.kpis.total_production || 0,
                    cycleTime: message.data.kpis.average_lead_time || 0,
                    quality: message.data.kpis.quality_rate || 100,
                  }));
                }
              }
              break;
              
            case 'realtime_update':
              // リアルタイムデータ更新（新しく追加）
              if (message.data) {
                // ノード状態の更新（ログ記録）
                if (message.data.nodes) {
                  Object.entries(message.data.nodes).forEach(([nodeId, nodeData]: [string, any]) => {
                    // ログに記録
                    onLog?.({
                      level: 'info',
                      category: 'process',
                      message: `ノード状態更新: ${nodeId}`,
                      details: nodeData,
                      nodeId
                    });
                  });
                }
                
                // エッジ状態の更新（ログ記録）
                if (message.data.edges) {
                  Object.entries(message.data.edges).forEach(([edgeId, edgeData]: [string, any]) => {
                    // ログに記録
                    onLog?.({
                      level: 'info',
                      category: 'transport',
                      message: `エッジ状態更新: ${edgeId}`,
                      details: edgeData,
                      nodeId: edgeId
                    });
                  });
                }
                
                // 全体データの更新
                if (message.data.overall) {
                  dispatch(updateRealtimeData({
                    overall: {
                      totalWIP: message.data.overall.totalWIP || 0,
                      totalProcessed: message.data.overall.totalProcessed || 0,
                      overallEfficiency: message.data.overall.overallEfficiency || 0,
                      bottleneck: message.data.overall.bottleneck || null,
                      lastUpdate: new Date().toISOString(),
                    }
                  }));
                }
              }
              break;
              
            case 'node_status_update':
              // 個別ノード状態更新（ログ記録）
              if (message.data) {
                onLog?.({
                  level: 'info',
                  category: 'process',
                  message: `ノード状態更新: ${message.data.nodeId || 'unknown'}`,
                  details: message.data,
                  nodeId: message.data.nodeId
                });
              }
              break;
              
            case 'edge_status_update':
              // 個別エッジ状態更新（ログ記録）
              if (message.data) {
                onLog?.({
                  level: 'info',
                  category: 'transport',
                  message: `エッジ状態更新: ${message.data.edgeId || 'unknown'}`,
                  details: message.data,
                  nodeId: message.data.edgeId
                });
              }
              break;
              
            case 'process_start':
            case 'process_complete':
            case 'lot_arrival':
            case 'transport_start':
            case 'transport_complete':
              // 個別イベント
              const eventType = message.type === 'process_start' ? 'info' :
                              message.type === 'process_complete' ? 'info' :
                              message.type === 'lot_arrival' ? 'info' :
                              message.type === 'transport_start' ? 'info' :
                              message.type === 'transport_complete' ? 'info' : 'info';
              
              // シミュレーションイベントとして追加
              // ログに記録
              onLog?.({
                level: 'info',
                category: 'system',
                message: message.data?.description || `${message.type}: Event occurred`,
                details: message.data,
                nodeId: message.data?.nodeId
              });
              
              // 既存のアラートシステムにも追加
              dispatch(addAlert({
                type: 'info',
                message: message.data?.description || `${message.type}: Event occurred`
              }));
              break;
              
            case 'simulation_event':
              // シミュレーションイベント
              // ログに記録
              onLog?.({
                level: message.data?.level === 'error' ? 'error' : 
                       message.data?.level === 'warning' ? 'warning' :
                       message.data?.level === 'success' ? 'success' : 'info',
                category: 'simulation',
                message: message.data?.message || 'New simulation event',
                details: message.data,
                nodeId: message.data?.nodeId
              });
              break;
              
            case 'message_received':
              // メッセージ受信確認（ログ出力のみ）
              console.log('Message received confirmation:', message.data);
              break;
              
            case 'pong':
              console.log('Pong received');
              break;
          
            case 'connection_established':
              console.log('WebSocket connection established');
              break;
              
            default:
              console.log('Unknown message type:', message.type, 'Message:', message);
          }
        } catch (error) {
          console.error('WebSocketメッセージの解析エラー:', error, 'Raw data:', event.data);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        dispatch(setWebSocketStatus(false));
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        dispatch(setWebSocketStatus(false));

        // 正常終了（code 1000）の場合は再接続しない
        if (event.code === 1000) {
          return;
        }

        // 再接続試行回数をチェック
        if (reconnectAttemptRef.current >= WS_CONFIG.maxReconnectAttempts) {
          console.error(`Max reconnect attempts (${WS_CONFIG.maxReconnectAttempts}) reached. Giving up.`);
          onLog?.({
            level: 'error',
            category: 'system',
            message: 'WebSocket connection failed after maximum retry attempts',
            details: { attempts: reconnectAttemptRef.current }
          });
          return;
        }

        // URL候補を切り替え
        urlIndexRef.current = (urlIndexRef.current + 1) % candidateUrlsRef.current.length;

        // 指数バックオフで再接続
        const delay = calculateReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;

        const nextUrl = candidateUrlsRef.current[urlIndexRef.current % candidateUrlsRef.current.length];
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${WS_CONFIG.maxReconnectAttempts})...`);

        reconnectTimeout.current = setTimeout(() => {
          console.log(`Attempting reconnection to: ${nextUrl}`);
          connect();
        }, delay);
      };
    } catch (error) {
      console.error('WebSocket接続エラー:', error);
      setIsConnected(false);
      dispatch(setWebSocketStatus(false));
    }
  }, [dispatch]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket未接続');
    }
  }, []);

  // シミュレーション制御メッセージの送信
  const sendSimulationControl = useCallback((controlType: string, data?: any) => {
    const message = {
      type: 'simulation_control',
      control: controlType,
      data: data || {},
      timestamp: new Date().toISOString(),
    };
    sendMessage(message);
  }, [sendMessage]);

  // リアルタイムデータの購読開始
  const subscribeToRealtimeData = useCallback((nodeIds?: string[], edgeIds?: string[]) => {
    const message = {
      type: 'subscribe_realtime',
      nodes: nodeIds || [],
      edges: edgeIds || [],
      timestamp: new Date().toISOString(),
    };
    sendMessage(message);
  }, [sendMessage]);

  // リアルタイムデータの購読停止
  const unsubscribeFromRealtimeData = useCallback((nodeIds?: string[], edgeIds?: string[]) => {
    const message = {
      type: 'unsubscribe_realtime',
      nodes: nodeIds || [],
      edges: edgeIds || [],
      timestamp: new Date().toISOString(),
    };
    sendMessage(message);
  }, [sendMessage]);

  // シミュレーションイベントの処理
  const handleSimulationEvent = (message: any) => {
    console.log('シミュレーションイベント受信:', message);
    
    const { event_type, timestamp, process_id, equipment_id, data } = message;
    
    // シミュレーション時間の更新（修正版）
    let simulationTime = 0;
    
    // 1. タイムスタンプから時間を計算
    if (timestamp) {
      try {
        const eventTime = new Date(timestamp);
        const baseTime = new Date('2024-01-01T08:00:00');
        simulationTime = Math.floor((eventTime.getTime() - baseTime.getTime()) / 1000);
        console.log('タイムスタンプから時間計算:', { timestamp, simulationTime });
      } catch (e) {
        console.warn('タイムスタンプ解析エラー:', e);
      }
    }
    
    // 2. データからシミュレーション時間を抽出（優先）
    console.log('データ構造詳細:', { 
      event_type, 
      timestamp, 
      data, 
      hasSimTime: data?.simulation_time !== undefined,
      dataKeys: data ? Object.keys(data) : [],
      dataValues: {
        simulation_time: data?.simulation_time,
        current_time: data?.current_time,  
        elapsed_time: data?.elapsed_time,
        timestamp: data?.timestamp
      }
    });
    
    // state_updateイベントの場合、より詳細にデバッグ
    if (event_type === 'state_update') {
      console.log('🔍 state_updateイベント詳細分析:', JSON.stringify(data, null, 2));
    }
    
    if (data?.simulation_time !== undefined) {
      simulationTime = Number(data.simulation_time);
      console.log('✅ データからシミュレーション時間を取得:', simulationTime, 'raw:', data.simulation_time);
    } else if (data?.current_time !== undefined) {
      simulationTime = Number(data.current_time);
      console.log('✅ データから現在時間を取得:', simulationTime, 'raw:', data.current_time);
    } else if (data?.elapsed_time !== undefined) {
      simulationTime = Number(data.elapsed_time);
      console.log('✅ データから経過時間を取得:', simulationTime, 'raw:', data.elapsed_time);
    } else {
      // 3. フォールバック：タイムスタンプから計算された時間を使用
      if (simulationTime === 0) {
        // リアルタイム計算も試行
        if (simulationStartTime === 0) {
          setSimulationStartTime(Date.now());
          simulationTime = 0;
        } else {
          const realElapsed = Math.floor((Date.now() - simulationStartTime) / 1000);
          simulationTime = Math.min(realElapsed * 5, 3600); // 5倍速で進行、最大1時間
        }
        console.log('⚠️ フォールバック時間計算:', simulationTime);
      } else {
        console.log('✅ タイムスタンプベース時間:', simulationTime);
      }
    }
    
    // 異常値チェック（24時間 = 86400秒を超える場合は制限）
    const maxSimulationTime = 24 * 60 * 60; // 24時間（秒）
    if (simulationTime > maxSimulationTime || simulationTime < 0 || isNaN(simulationTime)) {
      console.warn('異常なシミュレーション時間を検出:', {
        originalTime: simulationTime,
        maxTime: maxSimulationTime,
        data: data,
        timestamp: timestamp
      });
      // 異常な値の場合は0にリセット
      simulationTime = 0;
      setSimulationStartTime(Date.now());
    }
    
    // シミュレーション時間をReduxに設定（秒単位）
    dispatch(setCurrentTime(Math.floor(simulationTime)));
    
    console.log('シミュレーション時間更新:', {
      simulationTime: Math.floor(simulationTime),
      eventType: event_type,
      hasSimulationTime: data?.simulation_time !== undefined,
      hasCurrentTime: data?.current_time !== undefined,
      hasElapsedTime: data?.elapsed_time !== undefined,
      rawData: data
    });
    
    switch (event_type) {
      case 'simulation_start':
        console.log('シミュレーション開始イベント:', data);
        // シミュレーション開始時の初期化
        setSimulationStartTime(Date.now());
        dispatch(setCurrentTime(0));
        if (data && data.network) {
          console.log('ネットワークデータ受信:', data.network);
          
          // 初期設備状態を設定
          if (data.network.nodes) {
            const initialEquipmentStatus: Record<string, string> = {};
            const initialInventoryData: Record<string, number> = {};
            
            Object.values(data.network.nodes).forEach((node: any) => {
              if (node.type === 'assembly' || node.type === 'inspection' || node.type === 'machine') {
                // 工程ノードの設備を初期化
                if (node.equipmentCount && node.equipmentCount > 0) {
                  for (let i = 0; i < node.equipmentCount; i++) {
                    const equipmentId = `${node.id}_equipment_${i}`;
                    initialEquipmentStatus[equipmentId] = 'idle';
                  }
                }
              }
              
              // バッファノードの初期在庫を設定
              if (node.type === 'store' || node.type === 'storage' || node.type === 'buffer') {
                const initialQuantity = node.inputBufferCapacity || node.outputBufferCapacity || 0;
                if (initialQuantity > 0) {
                  initialInventoryData[node.id] = Math.floor(initialQuantity * 0.3); // 初期在庫を30%に設定
                }
              }
            });
            
            // 初期設備状態をReduxストアに設定
            Object.entries(initialEquipmentStatus).forEach(([equipmentId, status]) => {
              dispatch(updateEquipmentStatus({
                nodeId: equipmentId,
                status: status
              }));
            });
            
            // 初期在庫データをReduxストアに設定
            Object.entries(initialInventoryData).forEach(([bufferId, quantity]) => {
              dispatch(updateInventory({
                nodeId: bufferId,
                quantity: quantity
              }));
            });
            
            console.log('初期設備状態設定完了:', initialEquipmentStatus);
            console.log('初期在庫データ設定完了:', initialInventoryData);
          }
        }
        // シミュレーション開始時刻をリセット
        setSimulationStartTime(Date.now());
        dispatch(setCurrentTime(0));
        break;
        
      case 'simulation_stop':
        console.log('シミュレーション停止イベント');
        // シミュレーション停止時の処理
        setSimulationStartTime(0);
        dispatch(setCurrentTime(0));
        break;
        
      case 'process_start':
        console.log('工程開始イベント:', { process_id, equipment_id, data });
        // 工程開始時の処理
        if (process_id) {
          // 設備状態の更新
          if (equipment_id) {
            dispatch(updateEquipmentStatus({
              nodeId: equipment_id,
              status: 'running'
            }));
          }
          
          // ログに記録
          onLog?.({
            level: 'info',
            category: 'process',
            message: `工程開始: ${process_id}`,
            details: data,
            processId: process_id,
            equipmentId: equipment_id
          });
          
          // 在庫データの更新（入力バッファから消費）
          if (data && data.input_buffer_id && data.input_quantity !== undefined) {
            dispatch(updateInventory({
              nodeId: data.input_buffer_id,
              quantity: Math.max(0, data.input_quantity - 1),
            }));
          }
        }
        break;
        
      case 'process_complete':
        console.log('工程完了イベント:', { process_id, equipment_id, data });
        // 工程完了時の処理
        if (process_id) {
          // 設備状態の更新
          if (equipment_id) {
            dispatch(updateEquipmentStatus({
              nodeId: equipment_id,
              status: 'idle'
            }));
          }
          
          // ログに記録
          onLog?.({
            level: 'info',
            category: 'process',
            message: `工程完了: ${process_id}`,
            details: data,
            processId: process_id,
            equipmentId: equipment_id
          });
          
          // 在庫データの更新（出力バッファに追加）
          if (data && data.output_buffer_id && data.output_quantity !== undefined) {
            dispatch(updateInventory({
              nodeId: data.output_buffer_id,
              quantity: data.output_quantity + 1,
            }));
          }
        }
        break;
        
      case 'buffer_update':
        console.log('バッファ更新イベント:', data);
        // バッファ更新時の処理（ログ記録）
        if (data && data.buffer_id && data.quantity !== undefined) {
          onLog?.({
            level: 'info',
            category: 'buffer',
            message: `バッファ更新: ${data.buffer_id} - 数量: ${data.quantity}`,
            details: data,
            nodeId: data.buffer_id
          });
          
          dispatch(updateInventory({
            nodeId: data.buffer_id,
            quantity: data.quantity,
          }));
        }
        break;
        
      case 'equipment_status_update':
        console.log('設備状態更新イベント:', data);
        // 設備状態更新時の処理（ログ記録）
        if (data && data.equipment_id && data.status) {
          onLog?.({
            level: 'info',
            category: 'process',
            message: `設備状態更新: ${data.equipment_id} - 状態: ${data.status}`,
            details: data,
            equipmentId: data.equipment_id
          });
          
          dispatch(updateEquipmentStatus({
            nodeId: data.equipment_id,
            status: data.status
          }));
        }
        break;
        
      case 'kpi_update':
        console.log('KPI更新イベント:', data);
        // KPI更新時の処理
        if (data) {
          const kpiData = {
            oee: data.oee || data.equipment_utilization || 0,
            throughput: data.throughput || data.total_production || 0,
            cycleTime: data.cycleTime || data.average_lead_time || 0,
            quality: data.quality || data.quality_rate || 100,
          };
          console.log('KPIデータ更新:', kpiData);
          dispatch(setKPIData(kpiData));
        }
        break;
        
      case 'inventory_update':
        console.log('在庫更新イベント:', data);
        // 在庫更新時の処理（ログ記録）
        if (data && data.buffer_id && data.quantity !== undefined) {
          onLog?.({
            level: 'info',
            category: 'buffer',
            message: `在庫更新: ${data.buffer_id} - 数量: ${data.quantity}`,
            details: data,
            nodeId: data.buffer_id
          });
          
          dispatch(updateInventory({
            nodeId: data.buffer_id,
            quantity: data.quantity,
          }));
        }
        break;
        
      case 'state_update':
        console.log('状態更新イベント:', data);
        console.log('Redux dispatch前のチェック - 在庫データ:', data?.inventories);
        console.log('Redux dispatch前のチェック - 設備状態:', data?.equipment_states);
        console.log('Redux dispatch前のチェック - KPIデータ:', data?.kpis);
        
        // 状態更新時の処理
        if (data) {
          // シミュレーション時間の更新
          if (data.simulation_time !== undefined) {
            console.log('シミュレーション時間更新:', data.simulation_time);
            dispatch(setCurrentTime(Math.floor(data.simulation_time)));
          } else if (data.current_time !== undefined) {
            console.log('現在時刻更新:', data.current_time);
            dispatch(setCurrentTime(Math.floor(data.current_time)));
          } else if (data.elapsed_time !== undefined) {
            console.log('経過時間更新:', data.elapsed_time);
            dispatch(setCurrentTime(Math.floor(data.elapsed_time)));
          }
          
          // 在庫データの更新
          if (data.inventories) {
            console.log('在庫データ更新処理開始:', Object.keys(data.inventories));
            Object.entries(data.inventories).forEach(([bufferId, inventory]: [string, any]) => {
              if (inventory.total !== undefined) {
                console.log(`在庫更新: ${bufferId} -> ${inventory.total}`);
                dispatch(updateInventory({
                  nodeId: bufferId,
                  quantity: inventory.total,
                }));
              }
            });
          }
          
          // 設備状態の更新
          if (data.equipment_states) {
            console.log('設備状態更新処理開始:', Object.keys(data.equipment_states));
            Object.entries(data.equipment_states).forEach(([processId, processData]: [string, any]) => {
              if (processData.equipments) {
                Object.entries(processData.equipments).forEach(([equipmentId, equipmentData]: [string, any]) => {
                  if (equipmentData.status) {
                    console.log(`設備状態更新: ${equipmentId} -> ${equipmentData.status}`);
                    dispatch(updateEquipmentStatus({
                      nodeId: equipmentId,
                      status: equipmentData.status
                    }));
                  }
                });
              }
            });
          }
          
          // KPIデータの更新
          if (data.kpis) {
            const kpiData = {
              oee: data.kpis.equipment_utilization || 0,
              throughput: data.kpis.total_production || 0,
              cycleTime: data.kpis.average_lead_time || 0,
              quality: 100, // 品質データがない場合は100%と仮定
            };
            console.log('KPIデータ更新:', kpiData);
            dispatch(setKPIData(kpiData));
          }
        }
        break;
        
      case 'node_status_update':
        console.log('ノード状態更新イベント:', data);
        // ノード状態更新時の処理（ログ記録）
        if (data && data.node_id) {
          onLog?.({
            level: 'info',
            category: 'process',
            message: `ノード状態更新: ${data.node_id} - 状態: ${data.status || 'idle'}`,
            details: data,
            nodeId: data.node_id
          });
        }
        break;
        
      case 'simulation_started':
        console.log('✅ シミュレーション開始確認イベント受信:', data);
        // バックエンドからの確認を受けてRedux状態を更新
        dispatch(startSimulation());
        console.log('✅ Redux状態をrunningに更新しました');
        onLog?.({
          level: 'success',
          category: 'system',
          message: 'シミュレーションが正常に開始されました',
          details: data
        });
        break;
        
      case 'progress_update':
        console.log('進捗更新イベント:', data);
        // 進捗とシミュレーション時間を更新
        if (data?.current_time !== undefined) {
          dispatch(setCurrentTime(Math.floor(data.current_time)));
        }
        break;
        
      case 'error':
        console.error('エラーイベント:', data);
        onLog?.({
          level: 'error',
          category: 'system',
          message: `エラー: ${data?.message || '不明なエラー'}`,
          details: data
        });
        break;
        
      default:
        console.log('未処理のイベントタイプ:', event_type, message);
        break;
    }
  };

  // WebSocket接続の管理（再接続ロジックあり）
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return { 
    sendMessage, 
    isConnected,
    sendSimulationControl,
    subscribeToRealtimeData,
    unsubscribeFromRealtimeData,
  };
};