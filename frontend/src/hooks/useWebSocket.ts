import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { 
  setCurrentTime, 
  startSimulation, 
  stopSimulation,
  updateRealtimeData,
  updateNodeStatus,
  updateEdgeStatus,
  addEvent,
  setWebSocketStatus
} from '../store/slices/simulationSlice';
import { updateInventory, updateEquipmentStatus, setKPIData, addAlert } from '../store/slices/monitoringSlice';

const WS_URL = 'ws://localhost:8000/ws/simulation';

export const useWebSocket = () => {
  const dispatch = useDispatch();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('WebSocket接続成功');
        setIsConnected(true);
        dispatch(setWebSocketStatus(true));
        
        // 接続確認
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // メッセージタイプが存在しない場合の処理
          if (!message.type) {
            console.warn('メッセージタイプが設定されていません:', message);
            return;
          }
          
          switch (message.type) {
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
                // ノード状態の更新
                if (message.data.nodes) {
                  Object.entries(message.data.nodes).forEach(([nodeId, nodeData]: [string, any]) => {
                    dispatch(updateNodeStatus({
                      id: nodeId,
                      type: nodeData.type || 'process',
                      status: nodeData.status || 'unknown',
                      wip: nodeData.wip || 0,
                      processed: nodeData.processed || 0,
                      efficiency: nodeData.efficiency || 0,
                      throughput: nodeData.throughput || 0,
                      utilization: nodeData.utilization || 0,
                      quality: nodeData.quality || 100,
                      lastUpdate: new Date().toISOString(),
                    }));
                  });
                }
                
                // エッジ状態の更新
                if (message.data.edges) {
                  Object.entries(message.data.edges).forEach(([edgeId, edgeData]: [string, any]) => {
                    dispatch(updateEdgeStatus({
                      id: edgeId,
                      source: edgeData.source || '',
                      target: edgeData.target || '',
                      transportStatus: edgeData.transportStatus || 'waiting',
                      lotCount: edgeData.lotCount || 0,
                      productInfo: edgeData.productInfo || '',
                      transportTime: edgeData.transportTime || 0,
                      distance: edgeData.distance || 0,
                      lastUpdate: new Date().toISOString(),
                    }));
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
              // 個別ノード状態更新
              if (message.data) {
                dispatch(updateNodeStatus({
                  id: message.data.nodeId,
                  type: message.data.type || 'process',
                  status: message.data.status || 'unknown',
                  wip: message.data.wip || 0,
                  processed: message.data.processed || 0,
                  efficiency: message.data.efficiency || 0,
                  throughput: message.data.throughput || 0,
                  utilization: message.data.utilization || 0,
                  quality: message.data.quality || 100,
                  lastUpdate: new Date().toISOString(),
                }));
              }
              break;
              
            case 'edge_status_update':
              // 個別エッジ状態更新
              if (message.data) {
                dispatch(updateEdgeStatus({
                  id: message.data.edgeId,
                  source: message.data.source || '',
                  target: message.data.target || '',
                  transportStatus: message.data.transportStatus || 'waiting',
                  lotCount: message.data.lotCount || 0,
                  productInfo: message.data.productInfo || '',
                  transportTime: message.data.transportTime || 0,
                  distance: message.data.distance || 0,
                  lastUpdate: new Date().toISOString(),
                }));
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
              dispatch(addEvent({
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                type: eventType,
                message: message.data?.description || `${message.type}: Event occurred`,
                nodeId: message.data?.nodeId,
                edgeId: message.data?.edgeId,
                details: message.data,
              }));
              
              // 既存のアラートシステムにも追加
              dispatch(addAlert({
                type: 'info',
                message: message.data?.description || `${message.type}: Event occurred`
              }));
              break;
              
            case 'simulation_event':
              // シミュレーションイベント
              dispatch(addEvent({
                id: message.data?.id || Date.now().toString(),
                timestamp: message.data?.timestamp || new Date().toISOString(),
                type: message.data?.level === 'error' ? 'error' : 
                      message.data?.level === 'warning' ? 'warning' :
                      message.data?.level === 'success' ? 'success' : 'info',
                message: message.data?.message || 'New simulation event',
                nodeId: message.data?.nodeId,
                edgeId: message.data?.edgeId,
                details: message.data,
              }));
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
        console.error('WebSocketエラー:', error);
        setIsConnected(false);
        dispatch(setWebSocketStatus(false));
      };

      ws.current.onclose = () => {
        console.log('WebSocket接続終了');
        setIsConnected(false);
        dispatch(setWebSocketStatus(false));
        
        // 5秒後に再接続を試みる
        reconnectTimeout.current = setTimeout(() => {
          console.log('再接続を試みています...');
          connect();
        }, 5000);
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