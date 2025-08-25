import React from 'react';
import { EdgeProps, getBezierPath, getMarkerEnd } from 'react-flow-renderer';

const EnhancedTransportEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 搬送状況に基づく色とスタイル
  const getEdgeColor = () => {
    const congestionLevel = data?.congestionLevel || 'normal';
    switch (congestionLevel) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#2196f3';
    }
  };

  const getEdgeWidth = () => {
    const currentLoad = data?.currentLoad || 0;
    const maxCapacity = data?.maxCapacity || 100;
    const loadRatio = currentLoad / maxCapacity;
    return Math.max(2, Math.min(8, 2 + loadRatio * 6));
  };

  const isActive = data?.isActive || false;
  const isBlocked = data?.isBlocked || false;

  return (
    <>
      {/* メインエッジ */}
      <path
        id={id}
        style={{
          ...style,
          stroke: getEdgeColor(),
          strokeWidth: getEdgeWidth(),
          strokeDasharray: isBlocked ? '5,5' : undefined,
          animation: isActive ? 'flow 2s linear infinite' : undefined,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      {/* 搬送中のアイテム表示 */}
      {isActive && data?.transportedItems && (
        <>
          {data.transportedItems.map((item: any, index: number) => {
            // アイテムの位置計算（エッジに沿って移動）
            const progress = (item.progress || 0) / 100;
            const x = sourceX + (targetX - sourceX) * progress;
            const y = sourceY + (targetY - sourceY) * progress;

            return (
              <circle
                key={`${id}-item-${index}`}
                cx={x}
                cy={y}
                r={3}
                fill={item.type === 'defective' ? '#f44336' : '#4caf50'}
                stroke="white"
                strokeWidth={1}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  path={edgePath}
                />
              </circle>
            );
          })}
        </>
      )}

      {/* 負荷インジケーター */}
      {data?.currentLoad && data?.maxCapacity && (
        <foreignObject
          width={60}
          height={20}
          x={(sourceX + targetX) / 2 - 30}
          y={(sourceY + targetY) / 2 - 10}
          className="edgebutton-foreignobject"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '2px 4px',
              fontSize: '10px',
              textAlign: 'center',
            }}
          >
            {Math.round((data.currentLoad / data.maxCapacity) * 100)}%
          </div>
        </foreignObject>
      )}

      <style>{`
        @keyframes flow {
          0% {
            stroke-dasharray: 5, 5;
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dasharray: 5, 5;
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </>
  );
};

export default EnhancedTransportEdge;