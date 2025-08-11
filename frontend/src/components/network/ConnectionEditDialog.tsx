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
  Card,
  CardContent,
  CardActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  LocalShipping as TransportIcon,
  Inventory as ProductIcon,
} from '@mui/icons-material';
import { ConnectionData, TransportMethod, TransportProduct } from '../../types/networkEditor';
import { 
  calculateTransportDistance, 
  estimateTransportTime, 
  estimateTransportCost 
} from '../../utils/distanceCalculator';

// 簡単なID生成関数
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ConnectionEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ConnectionData) => void;
  initialData: ConnectionData | null;
  sourceNodeName?: string;
  targetNodeName?: string;
  sourcePosition?: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  sourceNodeData?: any; // 搬送元のノードデータ
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
  sourceNodeData,
}) => {
  const [editData, setEditData] = useState<ConnectionData>({
    transportTime: 30,
    transportLotSize: 10,
    transportCost: 50,
    distance: 10,
    transportType: 'conveyor',
    maxCapacity: 100,
    transportMethods: [],
  });

  // 搬送手段の管理
  const [transportMethods, setTransportMethods] = useState<TransportMethod[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    console.log('ConnectionEditDialog: Props received', {
      open,
      initialData,
      sourceNodeName,
      targetNodeName,
      sourcePosition,
      targetPosition,
      sourceNodeData
    });
    if (initialData) {
      setEditData({ ...initialData });
      if (initialData.transportMethods) {
        setTransportMethods(initialData.transportMethods);
      }
    }
    
    // 搬送元の出力製品を設定
    if (sourceNodeData && sourceNodeData.outputs && sourceNodeData.outputs.length > 0) {
      // 実際の出力製品IDから製品名を取得（実際の実装では製品マスタから取得）
      const products = sourceNodeData.outputs.map((productId: string, index: number) => ({
        id: productId,
        name: `完成品${String.fromCharCode(65 + index)}` // A, B, C... として表示
      }));
      setAvailableProducts(products);
    } else {
      // サンプルの利用可能製品を設定（実際の実装では搬送元の出力製品を取得）
      setAvailableProducts([
        { id: 'product1', name: '完成品A' },
        { id: 'product2', name: '完成品B' },
        { id: 'product3', name: '完成品C' },
      ]);
    }
  }, [initialData, open, sourceNodeName, targetNodeName, sourcePosition, targetPosition, sourceNodeData]);

  // 搬送手段の追加
  const addTransportMethod = () => {
    const newMethod: TransportMethod = {
      id: generateId(),
      name: `搬送手段${transportMethods.length + 1}`,
      type: 'conveyor',
      transportTime: 30,
      transportCost: 50,
      maxCapacity: 100,
      priority: transportMethods.length + 1,
      isActive: true,
      transportCapacity: 100, // 搬送キャパシティ
      transportInstruction: {
        type: 'process',
        frequency: 30, // 30分間隔
        schedule: ['08:00', '12:00', '17:00'], // デフォルト時刻
      },
      transportProducts: [],
    };
    setTransportMethods([...transportMethods, newMethod]);
  };

  // 搬送手段の削除
  const removeTransportMethod = (id: string) => {
    setTransportMethods(transportMethods.filter(method => method.id !== id));
  };

  // 搬送手段の更新
  const updateTransportMethod = (id: string, updates: Partial<TransportMethod>) => {
    setTransportMethods(transportMethods.map(method => 
      method.id === id ? { ...method, ...updates } : method
    ));
  };

  // 部品ロットの追加
  const addProductLot = (methodId: string) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    const newLot: TransportProduct = {
      id: generateId(),
      productId: availableProducts[0]?.id || '',
      productName: availableProducts[0]?.name || '',
      lotSize: 10,
      priority: method.transportProducts.length + 1,
    };

    updateTransportMethod(methodId, {
      transportProducts: [...method.transportProducts, newLot]
    });
  };

  // 部品ロットの削除
  const removeProductLot = (methodId: string, lotId: string) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    updateTransportMethod(methodId, {
      transportProducts: method.transportProducts.filter(lot => lot.id !== lotId)
    });
  };

  // 部品ロットの更新
  const updateProductLot = (methodId: string, lotId: string, updates: Partial<TransportProduct>) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    updateTransportMethod(methodId, {
      transportProducts: method.transportProducts.map(lot => 
        lot.id === lotId ? { ...lot, ...updates } : lot
      )
    });
  };

  // 搬送部品の追加
  const addTransportProduct = (methodId: string) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    const newProduct: TransportProduct = {
      id: generateId(),
      productId: availableProducts[0]?.id || '',
      productName: availableProducts[0]?.name || '',
      lotSize: 10,
      priority: method.transportProducts.length + 1,
    };

    updateTransportMethod(methodId, {
      transportProducts: [...method.transportProducts, newProduct]
    });

    // 搬送キャパシティを自動調整
    setTimeout(() => autoAdjustTransportCapacity(methodId), 0);
  };

  // 搬送部品の削除
  const removeTransportProduct = (methodId: string, productId: string) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    updateTransportMethod(methodId, {
      transportProducts: method.transportProducts.filter(product => product.id !== productId)
    });

    // 搬送キャパシティを自動調整
    setTimeout(() => autoAdjustTransportCapacity(methodId), 0);
  };

  // 搬送部品の更新
  const updateTransportProduct = (methodId: string, productId: string, updates: Partial<TransportProduct>) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    updateTransportMethod(methodId, {
      transportProducts: method.transportProducts.map(product => 
        product.id === productId ? { ...product, ...updates } : product
      )
    });

    // ロットサイズが変更された場合は搬送キャパシティを自動調整
    if (updates.lotSize !== undefined) {
      setTimeout(() => autoAdjustTransportCapacity(methodId), 0);
    }
  };

  // 搬送キャパシティの計算（現在の搬送部品設定から自動計算）
  const calculateTransportCapacity = (method: TransportMethod) => {
    if (method.transportProducts.length === 0) return 0;
    
    // 各搬送部品のロットサイズの合計（ロット数ベース）
    return method.transportProducts.reduce((total, product) => total + product.lotSize, 0);
  };

  // 搬送可能な部品数の表示
  const getTransportableInfo = (method: TransportMethod) => {
    if (method.transportProducts.length === 0) return '搬送部品が設定されていません';
    
    const capacity = method.transportCapacity; // 搬送キャパシティ（ロット数）
    const products = method.transportProducts.map(product => {
      const maxLots = Math.min(capacity, Math.floor(capacity / product.lotSize));
      const maxQuantity = maxLots * product.lotSize;
      return `${product.productName}: ${maxLots}ロット(${maxQuantity}個)`;
    });
    
    return products.join(', ');
  };

  // 搬送キャパシティの自動調整（部品ロットサイズの合計に合わせる）
  const autoAdjustTransportCapacity = (methodId: string) => {
    const method = transportMethods.find(m => m.id === methodId);
    if (!method) return;

    const calculatedCapacity = calculateTransportCapacity(method);
    updateTransportMethod(methodId, { transportCapacity: calculatedCapacity });
  };

  // 搬送手段の優先度を更新
  const updateTransportMethodPriority = (id: string, newPriority: number) => {
    const method = transportMethods.find(m => m.id === id);
    if (!method) return;

    // 他の搬送手段の優先度を調整
    const updatedMethods = transportMethods.map(m => {
      if (m.id === id) {
        return { ...m, priority: newPriority };
      } else if (m.priority >= newPriority) {
        return { ...m, priority: m.priority + 1 };
      }
      return m;
    });

    setTransportMethods(updatedMethods);
  };

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
      // 搬送手段の情報をeditDataに統合
      const finalData = {
        ...editData,
        transportMethods: transportMethods,
      };
      onSave(finalData);
      onClose();
    } catch (error) {
      console.error('ConnectionEditDialog: Error in handleSave', error);
    }
  }, [editData, transportMethods, onSave, onClose]);

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

          {/* 複数搬送手段の管理 */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              搬送手段の管理
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addTransportMethod}
                sx={{ mb: 2 }}
              >
                搬送手段を追加
              </Button>
            </Box>

            {transportMethods.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">
                  搬送手段が設定されていません。上記のボタンから追加してください。
                </Typography>
              </Box>
            ) : (
              transportMethods.map((method, index) => (
                <Accordion key={method.id} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <TransportIcon color="primary" />
                      <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                        {method.name}
                      </Typography>
                      <Chip 
                        label={method.type} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`優先度: ${method.priority}`} 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={method.isActive}
                            onChange={(e) => updateTransportMethod(method.id, { isActive: e.target.checked })}
                            size="small"
                          />
                        }
                        label="有効"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="搬送手段名"
                          value={method.name}
                          onChange={(e) => updateTransportMethod(method.id, { name: e.target.value })}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>搬送方式</InputLabel>
                          <Select
                            value={method.type}
                            onChange={(e) => updateTransportMethod(method.id, { type: e.target.value as TransportMethod['type'] })}
                            label="搬送方式"
                          >
                            <MenuItem value="conveyor">コンベア</MenuItem>
                            <MenuItem value="agv">AGV</MenuItem>
                            <MenuItem value="manual">手搬送</MenuItem>
                            <MenuItem value="forklift">フォークリフト</MenuItem>
                            <MenuItem value="tugger">牽引車</MenuItem>
                            <MenuItem value="crane">クレーン</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="搬送時間（秒）"
                          value={method.transportTime}
                          onChange={(e) => updateTransportMethod(method.id, { transportTime: Number(e.target.value) || 0 })}
                          size="small"
                          InputProps={{ inputProps: { min: 0 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="搬送コスト（円/回）"
                          value={method.transportCost}
                          onChange={(e) => updateTransportMethod(method.id, { transportCost: Number(e.target.value) || 0 })}
                          size="small"
                          InputProps={{ inputProps: { min: 0 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="最大搬送能力（個/時間）"
                          value={method.maxCapacity}
                          onChange={(e) => updateTransportMethod(method.id, { maxCapacity: Number(e.target.value) || 0 })}
                          size="small"
                          InputProps={{ inputProps: { min: 0 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="優先度"
                          value={method.priority}
                          onChange={(e) => updateTransportMethodPriority(method.id, Number(e.target.value) || 1)}
                          size="small"
                          InputProps={{ inputProps: { min: 1, max: transportMethods.length } }}
                          helperText="1が最高優先度"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="搬送キャパシティ"
                            value={method.transportCapacity}
                            onChange={(e) => updateTransportMethod(method.id, { transportCapacity: Number(e.target.value) || 0 })}
                            size="small"
                            InputProps={{ inputProps: { min: 0 } }}
                            helperText="一度に搬送できる総ロット数"
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => autoAdjustTransportCapacity(method.id)}
                            sx={{ mt: 1, minWidth: 'auto', px: 1 }}
                            title="部品ロットサイズから自動計算"
                          >
                            自動
                          </Button>
                        </Box>
                      </Grid>

                      {/* 搬送指示の設定 */}
                      <Grid item xs={12}>
                        <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            <ProductIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            📋 搬送指示設定
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <FormControl fullWidth size="small">
                                <InputLabel>搬送指示の種類</InputLabel>
                                <Select
                                  value={method.transportInstruction.type}
                                  onChange={(e) => updateTransportMethod(method.id, { 
                                    transportInstruction: { 
                                      ...method.transportInstruction, 
                                      type: e.target.value as 'process' | 'push' | 'pull' | 'kanban' 
                                    } 
                                  })}
                                  label="搬送指示の種類"
                                >
                                  <MenuItem value="process">工程指示</MenuItem>
                                  <MenuItem value="push">プッシュ</MenuItem>
                                  <MenuItem value="pull">プル</MenuItem>
                                  <MenuItem value="kanban">かんばん</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            
                            {method.transportInstruction.type === 'process' && (
                              <>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    fullWidth
                                    type="number"
                                    label="搬送頻度（分間隔）"
                                    value={method.transportInstruction.frequency || ''}
                                    onChange={(e) => updateTransportMethod(method.id, { 
                                      transportInstruction: { 
                                        ...method.transportInstruction, 
                                        frequency: Number(e.target.value) || 0 
                                      } 
                                    })}
                                    size="small"
                                    InputProps={{ inputProps: { min: 1 } }}
                                    helperText="工程からの搬送指示間隔"
                                  />
                                </Grid>
                                
                                <Grid item xs={12}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" color="text.secondary">
                                      搬送時刻:
                                    </Typography>
                                    {method.transportInstruction.schedule?.map((time, index) => (
                                      <TextField
                                        key={index}
                                        type="time"
                                        value={time}
                                        onChange={(e) => {
                                          const newSchedule = [...(method.transportInstruction.schedule || [])];
                                          newSchedule[index] = e.target.value;
                                          updateTransportMethod(method.id, { 
                                            transportInstruction: { 
                                              ...method.transportInstruction, 
                                              schedule: newSchedule 
                                            } 
                                          });
                                        }}
                                        size="small"
                                        sx={{ width: 120 }}
                                      />
                                    ))}
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => {
                                        const newSchedule = [...(method.transportInstruction.schedule || []), '09:00'];
                                        updateTransportMethod(method.id, { 
                                          transportInstruction: { 
                                            ...method.transportInstruction, 
                                            schedule: newSchedule 
                                          } 
                                        });
                                      }}
                                    >
                                      時刻追加
                                    </Button>
                                    {method.transportInstruction.schedule && method.transportInstruction.schedule.length > 0 && (
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                          const newSchedule = method.transportInstruction.schedule?.slice(0, -1) || [];
                                          updateTransportMethod(method.id, { 
                                            transportInstruction: { 
                                              ...method.transportInstruction, 
                                              schedule: newSchedule 
                                            } 
                                          });
                                        }}
                                      >
                                        時刻削除
                                      </Button>
                                    )}
                                  </Box>
                                </Grid>
                              </>
                            )}
                          </Grid>
                        </Box>
                      </Grid>
                      
                      {/* 搬送可能な部品数の情報表示 */}
                      <Grid item xs={12}>
                        <Box sx={{ p: 2, backgroundColor: 'info.light', borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                          <Typography variant="subtitle2" color="info.dark" gutterBottom>
                            📦 搬送可能な部品数
                          </Typography>
                          <Typography variant="body2" color="info.dark">
                            {getTransportableInfo(method)}
                          </Typography>
                          <Typography variant="caption" color="info.dark" sx={{ display: 'block', mt: 1 }}>
                            搬送キャパシティ: {method.transportCapacity}ロット
                          </Typography>
                          <Typography variant="caption" color="info.dark" sx={{ display: 'block' }}>
                            総搬送可能個数: {method.transportProducts.reduce((total, product) => total + (product.lotSize * Math.min(method.transportCapacity, Math.floor(method.transportCapacity / product.lotSize))), 0)}個
                          </Typography>
                        </Box>
                      </Grid>
                      
                      {/* 部品ロットの管理 */}
                      <Grid item xs={12}>
                        <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2" color="primary">
                              <ProductIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                              部品ロット設定
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => addProductLot(method.id)}
                            >
                              部品ロット追加
                            </Button>
                          </Box>
                          
                          {method.transportProducts.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                              部品ロットが設定されていません
                            </Typography>
                          ) : (
                            <List dense>
                              {method.transportProducts.map((lot) => (
                                <ListItem key={lot.id} sx={{ backgroundColor: 'white', mb: 1, borderRadius: 1 }}>
                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <FormControl size="small" sx={{ minWidth: 150 }}>
                                          <Select
                                            value={lot.productId}
                                            onChange={(e) => {
                                              const product = availableProducts.find(p => p.id === e.target.value);
                                              updateProductLot(method.id, lot.id, { 
                                                productId: e.target.value as string,
                                                productName: product?.name || ''
                                              });
                                            }}
                                            displayEmpty
                                          >
                                            {availableProducts.map((product) => (
                                              <MenuItem key={product.id} value={product.id}>
                                                {product.name}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                        <TextField
                                          type="number"
                                          label="ロットサイズ"
                                          value={lot.lotSize}
                                          onChange={(e) => updateProductLot(method.id, lot.id, { lotSize: Number(e.target.value) || 0 })}
                                          size="small"
                                          sx={{ width: 100 }}
                                          InputProps={{ inputProps: { min: 1 } }}
                                        />
                                        <TextField
                                          type="number"
                                          label="優先度"
                                          value={lot.priority}
                                          onChange={(e) => updateProductLot(method.id, lot.id, { priority: Number(e.target.value) || 1 })}
                                          size="small"
                                          sx={{ width: 80 }}
                                          InputProps={{ inputProps: { min: 1 } }}
                                        />
                                      </Box>
                                    }
                                  />
                                  <ListItemSecondaryAction>
                                    <IconButton
                                      edge="end"
                                      onClick={() => removeProductLot(method.id, lot.id)}
                                      color="error"
                                      size="small"
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </ListItemSecondaryAction>
                                </ListItem>
                              ))}
                            </List>
                          )}
                        </Box>
                      </Grid>
                      
                      
                      
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => removeTransportMethod(method.id)}
                            size="small"
                          >
                            この搬送手段を削除
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
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

