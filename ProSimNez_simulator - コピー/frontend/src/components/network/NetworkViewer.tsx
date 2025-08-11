import React, { memo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  BackgroundVariant,
} from 'react-flow-renderer';
import { Box } from '@mui/material';
import ProcessNode from './ProcessNode';
import TransportEdge from './TransportEdge';
import { Node, Edge } from 'react-flow-renderer';

const nodeTypes = {
  process: ProcessNode,
};

const edgeTypes = {
  transport: TransportEdge,
  default: TransportEdge, // デフォルトエッジタイプも同様に処理
};

interface NetworkViewerProps {
  nodes: Node[];
  edges: Edge[];
}

const NetworkViewer: React.FC<NetworkViewerProps> = memo(({ nodes, edges }) => {
  return (
    <Box sx={{ height: 300, width: '100%' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.1 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
});

NetworkViewer.displayName = 'NetworkViewer';

export default NetworkViewer;