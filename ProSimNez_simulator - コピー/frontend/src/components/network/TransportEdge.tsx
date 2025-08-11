import React, { memo } from 'react';
import { EdgeProps, getBezierPath } from 'react-flow-renderer';
import { Box, Typography, Chip } from '@mui/material';
import {
  LocalShipping as TruckIcon,
  DirectionsCar as AGVIcon,
  DirectionsWalk as ManualIcon,
  Construction as ForkliftIcon,
} from '@mui/icons-material';
import { ConnectionData } from '../../types/networkEditor';

const getTransportIcon = (type: ConnectionData['transportType']) => {
  switch (type) {
    case 'conveyor': return null;
    case 'agv': return <AGVIcon fontSize="small" />;
    case 'manual': return <ManualIcon fontSize="small" />;
    case 'forklift': return <ForkliftIcon fontSize="small" />;
    default: return null;
  }
};

const getEdgeColor = (type: ConnectionData['transportType']) => {
  switch (type) {
    case 'conveyor': return '#2196f3';
    case 'agv': return '#4caf50';
    case 'manual': return '#ff9800';
    case 'forklift': return '#f44336';
    default: return '#9e9e9e';
  }
};

const TransportEdge: React.FC<EdgeProps<ConnectionData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}) => {
  console.log('TransportEdge rendering:', { id, sourceX, sourceY, targetX, targetY, data });
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = data ? getEdgeColor(data.transportType) : '#2196f3';
  
  return (
    <>
      {/* 基本的なエッジパス - 必ず表示される */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#ff5722' : edgeColor,
          strokeWidth: selected ? 5 : 3,
          fill: 'none',
          cursor: 'pointer',
        }}
      />
      
      {/* 選択時の強調表示 */}
      {selected && (
        <path
          d={edgePath}
          style={{
            stroke: '#ff5722',
            strokeWidth: 8,
            fill: 'none',
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* デバッグ用の追加要素 */}
      <circle
        cx={Number(labelX)}
        cy={Number(labelY)}
        r="3"
        fill="red"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* 簡素化されたラベル */}
      {data && (
        <text
          x={Number(labelX)}
          y={Number(labelY) - 10}
          textAnchor="middle"
          fontSize="12"
          fill={edgeColor}
          style={{ pointerEvents: 'none', fontWeight: 'bold' }}
        >
          {data.transportTime}s
        </text>
      )}
    </>
  );
};

export default memo(TransportEdge);