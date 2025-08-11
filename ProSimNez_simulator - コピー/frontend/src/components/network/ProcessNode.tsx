import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { Box, Typography, Chip, Tooltip, LinearProgress } from '@mui/material';
import {
  Settings as MachiningIcon,
  Build as AssemblyIcon,
  Search as InspectionIcon,
  Inventory as StorageIcon,
  LocalShipping as ShippingIcon,
  Settings,
} from '@mui/icons-material';
import { ProcessNodeData } from '../../types/networkEditor';

const getNodeIcon = (type: ProcessNodeData['type']) => {
  switch (type) {
    case 'machining': return <MachiningIcon />;
    case 'assembly': return <AssemblyIcon />;
    case 'inspection': return <InspectionIcon />;
    case 'storage': return <StorageIcon />;
    case 'shipping': return <ShippingIcon />;
    default: return <Settings />;
  }
};

const getNodeColor = (type: ProcessNodeData['type']) => {
  switch (type) {
    case 'machining': return '#1976d2';
    case 'assembly': return '#388e3c';
    case 'inspection': return '#f57c00';
    case 'storage': return '#7b1fa2';
    case 'shipping': return '#d32f2f';
    default: return '#616161';
  }
};

const getStatusColor = (status?: ProcessNodeData['status']) => {
  switch (status) {
    case 'running': return '#4caf50';
    case 'idle': return '#9e9e9e';
    case 'blocked': return '#ff9800';
    case 'breakdown': return '#f44336';
    default: return '#e0e0e0';
  }
};

const ProcessNode: React.FC<NodeProps<ProcessNodeData>> = ({ data, selected }) => {
  const utilizationPercent = data.utilization || 0;
  const isBottleneck = utilizationPercent > 85;
  
  return (
    <Box
      sx={{
        backgroundColor: 'white',
        border: `2px solid ${selected ? '#1976d2' : getNodeColor(data.type)}`,
        borderRadius: 2,
        padding: 2,
        minWidth: 200,
        position: 'relative',
        boxShadow: selected ? 3 : 1,
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={true}
        style={{
          background: '#1976d2',
          border: '2px solid #fff',
          width: 12,
          height: 12,
          borderRadius: '50%',
        }}
      />
      
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ color: getNodeColor(data.type), mr: 1 }}>
          {getNodeIcon(data.type)}
        </Box>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          {data.label}
        </Typography>
        {data.status && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: getStatusColor(data.status),
            }}
          />
        )}
      </Box>
      
      {/* IE指標 */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          CT: {data.cycleTime}秒 | 設備: {data.equipmentCount}台
        </Typography>
      </Box>
      
      {/* バッファ情報 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Tooltip title="入力バッファ">
          <Chip
            label={`IN: ${data.currentWIP || 0}/${data.inputBufferCapacity}`}
            size="small"
            color={data.currentWIP && data.currentWIP > data.inputBufferCapacity * 0.8 ? 'warning' : 'default'}
          />
        </Tooltip>
        <Tooltip title="出力バッファ">
          <Chip
            label={`OUT: ${data.outputBufferCapacity}`}
            size="small"
            variant="outlined"
          />
        </Tooltip>
      </Box>
      
      {/* 稼働率 */}
      {data.utilization !== undefined && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">稼働率</Typography>
            <Typography variant="caption" color={isBottleneck ? 'error' : 'text.primary'}>
              {utilizationPercent.toFixed(1)}%
              {isBottleneck && ' (ボトルネック)'}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={utilizationPercent}
            color={isBottleneck ? 'error' : 'primary'}
            sx={{ height: 6, borderRadius: 1 }}
          />
        </Box>
      )}
      
      {/* 品質指標 */}
      {data.defectRate > 0 && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          不良率: {data.defectRate}%
        </Typography>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={true}
        style={{
          background: '#4caf50',
          border: '2px solid #fff',
          width: 12,
          height: 12,
          borderRadius: '50%',
        }}
      />
    </Box>
  );
};

export default memo(ProcessNode);