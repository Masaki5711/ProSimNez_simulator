import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Divider,
  Slider,
  Box,
  InputAdornment,
} from '@mui/material';
import { ConnectionData } from '../../types/networkEditor';
import { 
  calculateTransportDistance, 
  estimateTransportTime, 
  estimateTransportCost 
} from '../../utils/distanceCalculator';

interface ConnectionEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ConnectionData) => void;
  initialData: ConnectionData | null;
  sourceNodeName?: string;
  targetNodeName?: string;
  sourcePosition?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
}

const ConnectionEditDialog: React.FC<ConnectionEditDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  sourceNodeName = '',
  targetNodeName = '',
  sourcePosition,
  targetPosition,
}) => {
  const [editData, setEditData] = useState<ConnectionData>({
    transportTime: 30,
    transportLotSize: 10,
    transportCost: 50,
    distance: 10,
    transportType: 'conveyor',
    maxCapacity: 100,
  });

  useEffect(() => {
    console.log('ConnectionEditDialog: Props received', {
      open,
      initialData,
      sourceNodeName,
      targetNodeName,
      sourcePosition,
      targetPosition
    });
    if (initialData) {
      setEditData({ ...initialData });
    }
  }, [initialData, open, sourceNodeName, targetNodeName, sourcePosition, targetPosition]);

  const handleChange = (field: keyof ConnectionData) => (
    event: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    const value = event.target.value;
    let processedValue: any = value;

    // 数値フィールドの処理
    const numericFields = ['transportTime', 'transportLotSize', 'transportCost', 'distance', 'maxCapacity'];
    
    if (numericFields.includes(field)) {
      const numValue = Number(value) || 0;
      processedValue = Math.max(0, numValue);
    }

    setEditData({
      ...editData,
      [field]: processedValue,
    });
  };

  const handleSliderChange = (field: keyof ConnectionData) => (
    event: Event,
    newValue: number | number[]
  ) => {
    setEditData({
      ...editData,
      [field]: newValue as number,
    });
  };

  const handleSave = useCallback(() => {
    console.log('ConnectionEditDialog: handleSave called', editData);
    try {
      onSave(editData);
      onClose();
    } catch (error) {
      console.error('ConnectionEditDialog: Error in handleSave', error);
    }
  }, [editData, onSave, onClose]);

  const handleCancel = useCallback(() => {
    console.log('ConnectionEditDialog: handleCancel called');
    try {
      if (initialData) {
        setEditData({ ...initialData });
      }
      onClose();
    } catch (error) {
      console.error('ConnectionEditDialog: Error in handleCancel', error);
    }
  }, [initialData, onClose]);

  // 距離の自動計算
  const handleAutoCalculateDistance = () => {
    if (sourcePosition && targetPosition) {
      const calculatedDistance = calculateTransportDistance(
        sourcePosition,
        targetPosition,
        editData.transportType
      );
      const estimatedTime = estimateTransportTime(calculatedDistance, editData.transportType);
      const estimatedCost = estimateTransportCost(calculatedDistance, editData.transportType);
      
      setEditData({
        ...editData,
        distance: calculatedDistance,
        transportTime: estimatedTime,
        transportCost: estimatedCost,
      });
    }
  };

  // 搬送タイプに応じたデフォルト値の設定
  const handleTransportTypeChange = (transportType: string) => {
    let defaults = {};
    
    switch (transportType) {
      case 'conveyor':
        defaults = { transportTime: 30, transportCost: 20, maxCapacity: 200 };
        break;
      case 'agv':
        defaults = { transportTime: 60, transportCost: 100, maxCapacity: 50 };
        break;
      case 'manual':
        defaults = { transportTime: 120, transportCost: 150, maxCapacity: 20 };
        break;
      case 'forklift':
        defaults = { transportTime: 90, transportCost: 80, maxCapacity: 100 };
        break;
    }

    setEditData({
      ...editData,
      transportType: transportType as ConnectionData['transportType'],
      ...defaults,
    });
  };

  const getTransportTypeColor = (type: string) => {
    switch (type) {
      case 'conveyor': return '#4caf50';
      case 'agv': return '#2196f3';
      case 'manual': return '#ff9800';
      case 'forklift': return '#9c27b0';
      default: return '#666';
    }
  };

  const calculateEfficiency = () => {
    // 効率指標の計算（簡易版）
    const timeEfficiency = Math.max(0, 100 - editData.transportTime / 2);
    const costEfficiency = Math.max(0, 100 - editData.transportCost / 5);
    const capacityEfficiency = editData.maxCapacity ? editData.maxCapacity / 2 : 50;
    
    return ((timeEfficiency + costEfficiency + capacityEfficiency) / 3).toFixed(1);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel}
      maxWidth="md" 
      fullWidth
      scroll="body"
      PaperProps={{
        sx: { 
          maxHeight: '90vh',
          height: 'auto',
          overflow: 'auto'
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">
          接続線の編集
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {sourceNodeName} → {targetNodeName}
        </Typography>
      </DialogTitle>

      <DialogContent 
        dividers
        sx={{
          maxHeight: '60vh',
          overflow: 'auto',
          pb: 2
        }}
      >
        <Grid container spacing={3}>
          {/* 基本設定 */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary">
              基本設定
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>搬送方式</InputLabel>
              <Select
                value={editData.transportType}
                onChange={(e) => handleTransportTypeChange(e.target.value as string)}
                label="搬送方式"
              >
                <MenuItem value="conveyor">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        backgroundColor: getTransportTypeColor('conveyor'),
                        borderRadius: '50%',
                        mr: 1 
                      }} 
                    />
                    コンベア
                  </Box>
                </MenuItem>
                <MenuItem value="agv">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        backgroundColor: getTransportTypeColor('agv'),
                        borderRadius: '50%',
                        mr: 1 
                      }} 
                    />
                    AGV
                  </Box>
                </MenuItem>
                <MenuItem value="manual">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        backgroundColor: getTransportTypeColor('manual'),
                        borderRadius: '50%',
                        mr: 1 
                      }} 
                    />
                    手搬送
                  </Box>
                </MenuItem>
                <MenuItem value="forklift">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        backgroundColor: getTransportTypeColor('forklift'),
                        borderRadius: '50%',
                        mr: 1 
                      }} 
                    />
                    フォークリフト
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                type="number"
                label="距離"
                value={editData.distance}
                onChange={handleChange('distance')}
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  inputProps: { min: 0, step: 0.1 }
                }}
                helperText="工程間の物理的距離"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAutoCalculateDistance}
                disabled={!sourcePosition || !targetPosition}
                sx={{ mt: 1, minWidth: 'auto', px: 1 }}
                title="座標から距離を自動計算"
              >
                自動
              </Button>
            </Box>
          </Grid>

          {/* 搬送パラメータ */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              搬送パラメータ
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography gutterBottom>搬送時間: {editData.transportTime}秒</Typography>
            <Slider
              value={editData.transportTime}
              onChange={handleSliderChange('transportTime')}
              min={5}
              max={300}
              step={5}
              marks={[
                { value: 5, label: '5s' },
                { value: 60, label: '1分' },
                { value: 180, label: '3分' },
                { value: 300, label: '5分' },
              ]}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="搬送ロットサイズ"
              value={editData.transportLotSize}
              onChange={handleChange('transportLotSize')}
              InputProps={{
                endAdornment: <InputAdornment position="end">個</InputAdornment>,
                inputProps: { min: 1 }
              }}
              helperText="一度に搬送する個数"
            />
          </Grid>

          {/* コストと能力 */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              コストと能力
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography gutterBottom>搬送コスト: ¥{editData.transportCost}/回</Typography>
            <Slider
              value={editData.transportCost}
              onChange={handleSliderChange('transportCost')}
              min={10}
              max={500}
              step={10}
              marks={[
                { value: 10, label: '¥10' },
                { value: 100, label: '¥100' },
                { value: 300, label: '¥300' },
                { value: 500, label: '¥500' },
              ]}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="最大搬送能力"
              value={editData.maxCapacity || ''}
              onChange={handleChange('maxCapacity')}
              InputProps={{
                endAdornment: <InputAdornment position="end">個/時間</InputAdornment>,
                inputProps: { min: 1 }
              }}
              helperText="時間あたりの最大搬送能力"
            />
          </Grid>

          {/* 効率指標 */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              効率指標
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box 
              sx={{ 
                p: 2, 
                backgroundColor: 'grey.50', 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Typography variant="body1">
                総合効率:
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: calculateEfficiency() > '70' ? 'success.main' : 
                         calculateEfficiency() > '50' ? 'warning.main' : 'error.main'
                }}
              >
                {calculateEfficiency()}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                (時間・コスト・能力を考慮)
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: 2, 
          gap: 1, 
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          zIndex: 1
        }}
      >
        <Button 
          onClick={() => {
            console.log('TEST: Cancel button clicked directly');
            handleCancel();
          }}
          variant="outlined"
          size="medium"
          sx={{ minWidth: 100 }}
          data-testid="cancel-button"
        >
          キャンセル
        </Button>
        <Button 
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            console.log('TEST: Save button clicked directly');
            handleSave();
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            console.log('TEST: Save button mouse down');
          }}
          variant="contained"
          color="primary"
          size="medium"
          sx={{ 
            minWidth: 100,
            zIndex: 2,
            pointerEvents: 'auto',
            cursor: 'pointer'
          }}
          data-testid="save-button"
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectionEditDialog;

