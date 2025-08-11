import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { Store as StoreIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { ProcessNodeData } from '../../types/networkEditor';

interface StoreNodeData extends ProcessNodeData {
  storeType?: 'finished_product' | 'component';
  productionSchedule?: any[];
  inventoryLevels?: any[];
}

const StoreNode: React.FC<NodeProps<StoreNodeData>> = ({ data, selected, id }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleSettingsClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const customEvent = new CustomEvent('storeNodeSettings', {
      detail: { nodeId: data.id || '', nodeData: data }
    });
    window.dispatchEvent(customEvent);
  }, [data]);

  const getStoreTypeColor = (type?: string) => {
    switch (type) {
      case 'finished_product':
        return '#4caf50'; // 緑色
      case 'component':
        return '#ff9800'; // オレンジ色
      default:
        return '#2196f3'; // 青色
    }
  };

  const getStoreTypeLabel = (type?: string) => {
    switch (type) {
      case 'finished_product':
        return '完成品';
      case 'component':
        return '部品';
      default:
        return 'ストア';
    }
  };

  const scheduleCount = data.productionSchedule?.length || 0;
  const inventoryCount = data.inventoryLevels?.length || 0;

  // デバッグ用：コンソールにアイコン情報を出力
  console.log('StoreNode rendering with:', {
    id: id,
    type: data.type,
    storeType: data.storeType,
    icon: 'Store'
  });

  return (
    <Box
      sx={{
        position: 'relative',
        width: 120,
        height: 80,
        backgroundColor: selected ? '#e3f2fd' : '#ffffff',
        border: `2px solid ${selected ? '#2196f3' : getStoreTypeColor(data.storeType)}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          transform: 'translateY(-2px)',
        },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 入力ハンドル */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#555', width: 8, height: 8 }}
      />

      {/* ストアアイコン */}
      <StoreIcon
        sx={{
          fontSize: 28,
          color: getStoreTypeColor(data.storeType),
          mb: 0.5,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
        }}
      />

      {/* ストアタイプラベル */}
      <Chip
        label={getStoreTypeLabel(data.storeType)}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.7rem',
          backgroundColor: getStoreTypeColor(data.storeType),
          color: 'white',
          mb: 0.5,
        }}
      />

      {/* ストア名 */}
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.7rem',
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </Typography>

      {/* 統計情報 */}
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
        {scheduleCount > 0 && (
          <Chip
            label={`計画: ${scheduleCount}`}
            size="small"
            sx={{ height: 16, fontSize: '0.6rem', backgroundColor: '#4caf50', color: 'white' }}
          />
        )}
        {inventoryCount > 0 && (
          <Chip
            label={`在庫: ${inventoryCount}`}
            size="small"
            sx={{ height: 16, fontSize: '0.6rem', backgroundColor: '#ff9800', color: 'white' }}
          />
        )}
      </Box>

      {/* 設定ボタン */}
      {isHovered && (
        <IconButton
          size="small"
          onClick={handleSettingsClick}
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            backgroundColor: 'rgba(255,255,255,0.9)',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,1)',
            },
          }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      )}

      {/* 出力ハンドル */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#555', width: 8, height: 8 }}
      />
    </Box>
  );
};

export default StoreNode; 