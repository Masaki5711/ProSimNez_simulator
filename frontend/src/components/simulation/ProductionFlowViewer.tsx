import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  ReactFlowInstance,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'react-flow-renderer';
import { Box, Paper, Typography, Chip, Alert } from '@mui/material';
import ProcessNode from '../network/ProcessNode';
import StoreNode from '../network/StoreNode';
import EnhancedTransportEdge from './EnhancedTransportEdge';

interface ProductionFlowViewerProps {
  networkData: any;
  realtimeData: any;
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  simulationStatus: any;
}

const nodeTypes = {
  process: ProcessNode,
  store: StoreNode,
  buffer: StoreNode,
};

const edgeTypes = {
  transport: EnhancedTransportEdge,
  default: EnhancedTransportEdge,
};

const ProductionFlowViewer: React.FC<ProductionFlowViewerProps> = ({
  networkData,
  realtimeData,
  onNodeClick,
  onEdgeClick,
  simulationStatus,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // ネットワークデータからReactFlowの形式に変換
  useEffect(() => {
    if (networkData && networkData.nodes && networkData.edges) {
      // ノードの変換とリアルタイムデータの統合
      const flowNodes: Node[] = networkData.nodes.map((node: any) => {
        const realtimeNodeData = realtimeData?.nodes?.[node.id] || {};
        
        return {
          id: node.id,
          type: node.type || 'process',
          position: node.position || { x: Math.random() * 400, y: Math.random() * 300 },
          data: {
            ...node.data,
            // リアルタイムデータを統合
            status: realtimeNodeData.status || node.data?.status || 'idle',
            utilization: realtimeNodeData.utilization || node.data?.utilization || 0,
            currentWIP: realtimeNodeData.currentWIP || node.data?.currentWIP || 0,
            currentInventory: realtimeNodeData.currentInventory || node.data?.currentInventory || 0,
            // 物流監視用の追加情報
            throughput: realtimeNodeData.throughput || 0,
            efficiency: realtimeNodeData.efficiency || 0,
            isBottleneck: realtimeNodeData.isBottleneck || false,
            // ストック状況の可視化
            stockLevel: realtimeNodeData.stockLevel || 'normal', // low, normal, high, overflow
            demandForecast: realtimeNodeData.demandForecast || 0,
          },
          style: {
            // リアルタイム状況に基づく視覚的表現
            border: getNodeBorderStyle(realtimeNodeData, node),
            backgroundColor: getNodeBackgroundColor(realtimeNodeData, node),
            boxShadow: realtimeNodeData.isBottleneck ? '0 0 10px #ff5722' : undefined,
          },
        };
      });

      // エッジの変換とリアルタイムデータの統合
      const flowEdges: Edge[] = networkData.edges.map((edge: any) => {
        const realtimeEdgeData = realtimeData?.edges?.[edge.id] || {};
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'transport',
          animated: realtimeEdgeData.isActive || false,
          data: {
            ...edge.data,
            // リアルタイム搬送データ
            currentLoad: realtimeEdgeData.currentLoad || 0,
            maxCapacity: edge.data?.maxCapacity || 100,
            transportType: edge.data?.transportType || 'conveyor',
            speed: realtimeEdgeData.speed || edge.data?.speed || 1,
            efficiency: realtimeEdgeData.efficiency || 100,
            // 搬送状況の可視化
            congestionLevel: realtimeEdgeData.congestionLevel || 'normal', // low, normal, high, critical
            transportedItems: realtimeEdgeData.transportedItems || [],
          },
          style: {
            stroke: getEdgeColor(realtimeEdgeData, edge),
            strokeWidth: getEdgeWidth(realtimeEdgeData, edge),
            strokeDasharray: realtimeEdgeData.isBlocked ? '5,5' : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: getEdgeColor(realtimeEdgeData, edge),
          },
        };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [networkData, realtimeData]);

  // ノードの境界線スタイル
  const getNodeBorderStyle = (realtimeData: any, node: any) => {
    if (realtimeData.isBottleneck) return '3px solid #ff5722';
    if (realtimeData.status === 'running') return '2px solid #4caf50';
    if (realtimeData.status === 'blocked') return '2px solid #ff9800';
    if (realtimeData.status === 'breakdown') return '2px solid #f44336';
    return '2px solid #e0e0e0';
  };

  // ノードの背景色
  const getNodeBackgroundColor = (realtimeData: any, node: any) => {
    const stockLevel = realtimeData.stockLevel || 'normal';
    switch (stockLevel) {
      case 'low': return '#ffebee';
      case 'high': return '#e8f5e8';
      case 'overflow': return '#fff3e0';
      default: return '#ffffff';
    }
  };

  // エッジの色
  const getEdgeColor = (realtimeData: any, edge: any) => {
    const congestionLevel = realtimeData.congestionLevel || 'normal';
    switch (congestionLevel) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#2196f3';
    }
  };

  // エッジの幅
  const getEdgeWidth = (realtimeData: any, edge: any) => {
    const loadRatio = (realtimeData.currentLoad || 0) / (edge.data?.maxCapacity || 100);
    return Math.max(2, Math.min(8, 2 + loadRatio * 6));
  };

  // ノードクリックハンドラー
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    onNodeClick(node.id);
  }, [onNodeClick]);

  // エッジクリックハンドラー
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    onEdgeClick(edge.id);
  }, [onEdgeClick]);

  // ReactFlowインスタンスの初期化
  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    // 自動フィット
    setTimeout(() => {
      instance.fitView({ padding: 0.1 });
    }, 100);
  }, []);

  // 接続処理
  const onConnect = useCallback(() => {
    // 読み取り専用なので何もしない
  }, []);

  // パネルクリック処理
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // リアルタイム更新のハイライト
  const getRealtimeStatusChips = () => {
    if (!simulationStatus?.status) return null;

    const isRunning = simulationStatus.status === 'running';
    const totalNodes = nodes.length;
    const activeNodes = nodes.filter(n => n.data?.status === 'running').length;
    const bottleneckNodes = nodes.filter(n => n.data?.isBottleneck).length;

    return (
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Chip
            label={`アクティブ工程: ${activeNodes}/${totalNodes}`}
            color={isRunning ? 'success' : 'default'}
            size="small"
          />
          {bottleneckNodes > 0 && (
            <Chip
              label={`ボトルネック: ${bottleneckNodes}箇所`}
              color="warning"
              size="small"
            />
          )}
          <Chip
            label={`シミュレーション: ${simulationStatus.status}`}
            color={isRunning ? 'primary' : 'default'}
            size="small"
          />
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {networkData && networkData.nodes ? (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.1}
            maxZoom={2}
          >
            <Controls
              showInteractive={false}
              showFitView={true}
              showZoom={true}
            />
            <MiniMap
              nodeColor={(node) => {
                switch (node.data?.status) {
                  case 'running': return '#4caf50';
                  case 'blocked': return '#ff9800';
                  case 'breakdown': return '#f44336';
                  default: return '#e0e0e0';
                }
              }}
              maskColor="rgba(255, 255, 255, 0.2)"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
            />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1} 
              color="#e0e0e0"
            />
          </ReactFlow>

          {/* リアルタイム状況表示 */}
          {getRealtimeStatusChips()}

          {/* 選択されたノード/エッジの情報表示 */}
          {selectedNodeId && (
            <Paper 
              elevation={3} 
              sx={{ 
                position: 'absolute', 
                top: 16, 
                right: 16, 
                p: 2, 
                minWidth: 250,
                zIndex: 1000,
              }}
            >
              <Typography variant="h6" gutterBottom>
                ノード詳細: {selectedNodeId}
              </Typography>
              {(() => {
                const node = nodes.find(n => n.id === selectedNodeId);
                if (!node) return null;
                return (
                  <Box>
                    <Typography variant="body2">
                      タイプ: {node.type}
                    </Typography>
                    <Typography variant="body2">
                      状態: {node.data?.status || 'idle'}
                    </Typography>
                    <Typography variant="body2">
                      稼働率: {((node.data?.utilization || 0) * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2">
                      在庫: {node.data?.currentInventory || 0}個
                    </Typography>
                    {node.data?.isBottleneck && (
                      <Chip label="ボトルネック" color="warning" size="small" sx={{ mt: 1 }} />
                    )}
                  </Box>
                );
              })()}
            </Paper>
          )}

          {selectedEdgeId && (
            <Paper 
              elevation={3} 
              sx={{ 
                position: 'absolute', 
                top: 120, 
                right: 16, 
                p: 2, 
                minWidth: 250,
                zIndex: 1000,
              }}
            >
              <Typography variant="h6" gutterBottom>
                搬送詳細: {selectedEdgeId}
              </Typography>
              {(() => {
                const edge = edges.find(e => e.id === selectedEdgeId);
                if (!edge) return null;
                return (
                  <Box>
                    <Typography variant="body2">
                      搬送手段: {edge.data?.transportType || 'コンベア'}
                    </Typography>
                    <Typography variant="body2">
                      現在負荷: {edge.data?.currentLoad || 0}/{edge.data?.maxCapacity || 100}
                    </Typography>
                    <Typography variant="body2">
                      効率: {edge.data?.efficiency || 100}%
                    </Typography>
                    <Typography variant="body2">
                      渋滞レベル: {edge.data?.congestionLevel || 'normal'}
                    </Typography>
                  </Box>
                );
              })()}
            </Paper>
          )}
        </>
      ) : (
        <Alert severity="warning" sx={{ m: 2 }}>
          ネットワークデータが読み込まれていません。ネットワークエディタで工程を設定してください。
        </Alert>
      )}
    </Box>
  );
};

export default ProductionFlowViewer;