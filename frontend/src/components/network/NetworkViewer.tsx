import React, { memo, useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  useReactFlow,
} from 'react-flow-renderer';
import { Box, Tooltip, Badge, Chip } from '@mui/material';
import ProcessNode from './ProcessNode';
import BufferNode from './BufferNode';
import TransportEdge from './TransportEdge';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const nodeTypes = {
  process: ProcessNode,
  store: BufferNode,
  buffer: BufferNode,
};

const edgeTypes = {
  transport: TransportEdge,
  default: TransportEdge,
};

interface NetworkViewerProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (node: Node) => void;
  onEdgeClick?: (edge: Edge) => void;
}

interface SimulationNodeData {
  id: string;
  type: string;
  status: 'running' | 'idle' | 'breakdown' | 'maintenance' | 'unknown';
  wip: number;
  processed: number;
  efficiency: number;
  lastUpdate: string;
}

interface SimulationEdgeData {
  id: string;
  source: string;
  target: string;
  transportStatus: 'waiting' | 'in_transit' | 'completed';
  lotCount: number;
  productInfo: string;
  lastUpdate: string;
}

const NetworkViewer: React.FC<NetworkViewerProps> = memo(({ 
  nodes, 
  edges, 
  onNodeClick,
  onEdgeClick 
}) => {
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  
  // Reduxストアからシミュレーション状態を取得
  const simulationStatus = useSelector((state: RootState) => state.simulation?.status);
  const realtimeData = useSelector((state: RootState) => state.simulation?.realtimeData);

  // ノードクリックハンドラー
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  // エッジクリックハンドラー
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    if (onEdgeClick) {
      onEdgeClick(edge);
    }
  }, [onEdgeClick]);

  // ノードのダブルクリックで詳細表示
  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node double clicked:', node);
    // ここで詳細情報モーダルを開くなどの処理を追加
  }, []);

  // エッジのダブルクリックで詳細表示
  const handleEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    console.log('Edge double clicked:', edge);
    // ここで搬送詳細モーダルを開くなどの処理を追加
  }, []);

  // リアルタイムデータに基づいてノードの状態を更新
  const getNodeStatusColor = (nodeId: string) => {
    if (!realtimeData || !realtimeData.nodes) return '#666';
    
    const nodeData = realtimeData.nodes[nodeId];
    if (!nodeData) return '#666';
    
    switch (nodeData.status) {
      case 'running':
        return '#4caf50';
      case 'idle':
        return '#ff9800';
      case 'breakdown':
        return '#f44336';
      case 'maintenance':
        return '#2196f3';
      default:
        return '#666';
    }
  };

  // リアルタイムデータに基づいてエッジの状態を更新
  const getEdgeStatusColor = (edgeId: string) => {
    if (!realtimeData || !realtimeData.edges) return '#666';
    
    const edgeData = realtimeData.edges[edgeId];
    if (!edgeData) return '#666';
    
    switch (edgeData.transportStatus) {
      case 'waiting':
        return '#ff9800';
      case 'in_transit':
        return '#2196f3';
      case 'completed':
        return '#4caf50';
      default:
        return '#666';
    }
  };

  // ノードのWIP（仕掛品）数を取得
  const getNodeWIP = (nodeId: string) => {
    if (!realtimeData || !realtimeData.nodes) return 0;
    return realtimeData.nodes[nodeId]?.wip || 0;
  };

  // エッジの搬送中ロット数を取得
  const getEdgeLotCount = (edgeId: string) => {
    if (!realtimeData || !realtimeData.edges) return 0;
    return realtimeData.edges[edgeId]?.lotCount || 0;
  };

  // リアルタイムデータが更新されたときの処理
  useEffect(() => {
    if (reactFlowInstance && realtimeData) {
      // ノードとエッジの状態を更新
      reactFlowInstance.setNodes((currentNodes: Node[]) =>
        currentNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            status: realtimeData.nodes?.[node.id]?.status || 'unknown',
            wip: realtimeData.nodes?.[node.id]?.wip || 0,
            processed: realtimeData.nodes?.[node.id]?.processed || 0,
            efficiency: realtimeData.nodes?.[node.id]?.efficiency || 0,
          },
        }))
      );

      reactFlowInstance.setEdges((currentEdges: Edge[]) =>
        currentEdges.map((edge) => ({
          ...edge,
          data: {
            ...edge.data,
            transportStatus: realtimeData.edges?.[edge.id]?.transportStatus || 'waiting',
            lotCount: realtimeData.edges?.[edge.id]?.lotCount || 0,
            productInfo: realtimeData.edges?.[edge.id]?.productInfo || '',
          },
        }))
      );
    }
  }, [reactFlowInstance, realtimeData]);

  // カスタムノードレンダリング（状態表示付き）
  const renderCustomNode = (node: Node) => {
    const statusColor = getNodeStatusColor(node.id);
    const wip = getNodeWIP(node.id);
    
    return (
      <Tooltip
        title={
          <div>
            <div><strong>工程ID:</strong> {node.id}</div>
            <div><strong>状態:</strong> {node.data?.status || 'unknown'}</div>
            <div><strong>仕掛品数:</strong> {wip}</div>
            <div><strong>処理済み:</strong> {node.data?.processed || 0}</div>
            <div><strong>効率:</strong> {(node.data?.efficiency || 0).toFixed(1)}%</div>
          </div>
        }
        arrow
      >
        <Box
          sx={{
            position: 'relative',
            cursor: 'pointer',
            border: selectedNode?.id === node.id ? '3px solid #2196f3' : 'none',
            borderRadius: 1,
          }}
        >
          <Badge
            badgeContent={wip}
            color="primary"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                backgroundColor: statusColor,
                color: 'white',
                fontWeight: 'bold',
              },
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            >
              {/* 状態インジケーター */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  border: '2px solid white',
                  zIndex: 10,
                }}
              />
              
              {/* 効率バー */}
              {node.data?.efficiency && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: 3,
                    width: `${Math.min(node.data.efficiency, 100)}%`,
                    backgroundColor: statusColor,
                    borderRadius: '0 0 0 4px',
                  }}
                />
              )}
            </Box>
          </Badge>
        </Box>
      </Tooltip>
    );
  };

  // カスタムエッジレンダリング（搬送状況表示付き）
  const renderCustomEdge = (edge: Edge) => {
    const statusColor = getEdgeStatusColor(edge.id);
    const lotCount = getEdgeLotCount(edge.id);
    
    return (
      <Tooltip
        title={
          <div>
            <div><strong>搬送ID:</strong> {edge.id}</div>
            <div><strong>搬送元:</strong> {edge.source}</div>
            <div><strong>搬送先:</strong> {edge.target}</div>
            <div><strong>搬送中ロット数:</strong> {lotCount}</div>
            <div><strong>状態:</strong> {edge.data?.transportStatus || 'waiting'}</div>
            <div><strong>製品情報:</strong> {edge.data?.productInfo || 'N/A'}</div>
          </div>
        }
        arrow
      >
        <Box
          sx={{
            position: 'relative',
            cursor: 'pointer',
            border: selectedEdge?.id === edge.id ? '2px solid #2196f3' : 'none',
            borderRadius: 1,
          }}
        >
          {/* 搬送状況インジケーター */}
          {lotCount > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: statusColor,
                color: 'white',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '2px solid white',
                zIndex: 10,
              }}
            >
              {lotCount}
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box sx={{ height: 600, width: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onInit={setReactFlowInstance}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          defaultEdgeOptions={{
            style: { strokeWidth: 2 },
            animated: true,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </ReactFlowProvider>

      {/* 選択状態表示 */}
      {selectedNode && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 2,
            borderRadius: 2,
            border: '1px solid #ddd',
            zIndex: 1000,
          }}
        >
          <Chip
            label={`選択中: ${selectedNode.id}`}
            color="primary"
            size="small"
            onDelete={() => setSelectedNode(null)}
          />
        </Box>
      )}

      {selectedEdge && (
        <Box
          sx={{
            position: 'absolute',
            top: 50,
            right: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 2,
            borderRadius: 2,
            border: '1px solid #ddd',
            zIndex: 1000,
          }}
        >
          <Chip
            label={`選択中: ${selectedEdge.id}`}
            color="secondary"
            size="small"
            onDelete={() => setSelectedEdge(null)}
          />
        </Box>
      )}
    </Box>
  );
});

NetworkViewer.displayName = 'NetworkViewer';

export default NetworkViewer;