import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { Box, Typography } from '@mui/material';
import { Inventory } from '@mui/icons-material';

interface BufferNodeData {
  label: string;
  capacity: number;
  currentStock: number;
  status: 'normal' | 'warning' | 'critical';
  lastUpdate: string;
}

const BufferNode: React.FC<NodeProps<BufferNodeData>> = memo(({ data, selected }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'critical':
        return '#f44336';
      default:
        return '#666';
    }
  };

  const getFillPercentage = () => {
    if (data.capacity === 0) return 0;
    return Math.min((data.currentStock / data.capacity) * 100, 100);
  };

  const fillPercentage = getFillPercentage();
  const statusColor = getStatusColor(data.status);

  return (
    <Box
      sx={{
        position: 'relative',
        width: 120,
        height: 80,
        backgroundColor: 'white',
        border: `2px solid ${selected ? '#2196f3' : statusColor}`,
        borderRadius: 2,
        padding: 1,
        cursor: 'pointer',
        boxShadow: selected ? '0 0 10px rgba(33, 150, 243, 0.5)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* 入力ハンドル */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#666',
          width: 8,
          height: 8,
        }}
      />

      {/* 出力ハンドル */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#666',
          width: 8,
          height: 8,
        }}
      />

      {/* アイコン */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Inventory 
          sx={{ 
            fontSize: 20, 
            color: statusColor,
          }} 
        />
      </Box>

      {/* ラベル */}
      <Typography
        variant="caption"
        sx={{
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '10px',
          lineHeight: 1,
          mb: 1,
          display: 'block',
        }}
      >
        {data.label}
      </Typography>

      {/* 在庫情報 */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            fontSize: '9px',
            color: 'text.secondary',
            display: 'block',
            mb: 0.5,
          }}
        >
          {data.currentStock} / {data.capacity}
        </Typography>
        
        {/* 在庫バー */}
        <Box
          sx={{
            width: '100%',
            height: 4,
            backgroundColor: '#e0e0e0',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: `${fillPercentage}%`,
              height: '100%',
              backgroundColor: statusColor,
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Box>

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

      {/* 選択状態インジケーター */}
      {selected && (
        <Box
          sx={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            border: '2px solid #2196f3',
            borderRadius: 3,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}
    </Box>
  );
});

BufferNode.displayName = 'BufferNode';

export default BufferNode;
