import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentTime, startSimulation, stopSimulation } from '../store/slices/simulationSlice';
import { updateInventory, updateEquipmentStatus, setKPIData, addAlert } from '../store/slices/monitoringSlice';

const WS_URL = 'ws://localhost:8000/ws/simulation';

export const useWebSocket = () => {
  const dispatch = useDispatch();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('WebSocket接続成功');
        // WebSocket接続成功時の処理（isConnected状態は削除されたため、必要に応じて別の状態管理を検討）
        
        // 接続確認
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
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
            
          case 'process_start':
          case 'process_complete':
          case 'lot_arrival':
            // 個別イベント
            dispatch(addAlert({
              type: 'info',
              message: `${message.type}: ${message.data?.description || 'Event occurred'}`
            }));
            break;
            
          case 'event':
            // イベント追加
            dispatch(addAlert({
              type: message.data?.level === 'error' ? 'error' : 'info',
              message: message.data?.message || 'New event'
            }));
            break;
            
          case 'pong':
            console.log('Pong received');
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocketエラー:', error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket接続終了');
        // WebSocket切断時の処理（isConnected状態は削除されたため、必要に応じて別の状態管理を検討）
        
        // 5秒後に再接続を試みる
        reconnectTimeout.current = setTimeout(() => {
          console.log('再接続を試みています...');
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('WebSocket接続エラー:', error);
      // WebSocket接続エラー時の処理（isConnected状態は削除されたため、必要に応じて別の状態管理を検討）
    }
  }, [dispatch]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket未接続');
    }
  }, []);

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

  return { sendMessage };
};