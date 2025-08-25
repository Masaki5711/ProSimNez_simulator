import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
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
  Box,
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
  components?: Array<{id: string, name: string, transportLotSize: number}>; // 部品データ
  sourceProcessData?: any; // 接続元の工程の詳細データ（出力製品情報を含む）
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
  components = [],
  sourceProcessData,
}) => {
  const { t } = useLanguage();
  const [editData, setEditData] = useState<ConnectionData>({
    transportTime: 30,
    transportLotSize: 10,
    distance: 10,
    transportType: 'conveyor',
    transportSettings: {
      defaultMethod: '',
      enableCapacityControl: true,
      enableRouting: false,
      congestionHandling: 'queue',
    },
    transportMethods: [],
  });

  // 搬送手段の管理
  const [transportMethods, setTransportMethods] = useState<TransportMethod[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Array<{
    id: string, 
    name: string, 
    isSourceOutput?: boolean,
    outputQuantity?: number,
    unit?: string
  }>>([]);

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
    } else {
      // デフォルト値の設定
      setEditData({
        transportTime: 30,
        transportLotSize: 10,
        distance: 10,
        transportType: 'conveyor',
        transportSettings: {
          defaultMethod: '',
          enableCapacityControl: true,
          enableRouting: false,
          congestionHandling: 'queue',
        },
        transportMethods: [],
      });
    }
    
    // 搬送部品の設定：接続元の出力製品を優先的に表示
    if (sourceProcessData && sourceProcessData.outputProducts && sourceProcessData.outputProducts.length > 0) {
      // 接続元の工程の出力製品を優先的に表示
      const sourceOutputProducts = sourceProcessData.outputProducts.map((output: any) => {
        // まず、componentsから該当する部品データを検索
        const component = components.find(c => c.id === output.productId);
        if (component) {
          return {
            id: component.id,
            name: component.name,
            isSourceOutput: true, // 接続元の出力製品であることを示すフラグ
            outputQuantity: output.outputQuantity,
            unit: output.unit
          };
        }
        
        // 部品が見つからない場合は、出力製品の情報を使用
        return {
          id: output.productId,
          name: output.productName || `部品${output.productId}`,
          isSourceOutput: true,
          outputQuantity: output.outputQuantity,
          unit: output.unit
        };
      });
      
      // その他の利用可能な部品も追加（接続元の出力製品以外）
      const otherProducts = components
        .filter(component => !sourceOutputProducts.find((p: any) => p.id === component.id))
        .map(component => ({
          id: component.id,
          name: component.name,
          isSourceOutput: false
        }));
      
      setAvailableProducts([...sourceOutputProducts, ...otherProducts]);
    } else if (sourceNodeData && sourceNodeData.outputs && sourceNodeData.outputs.length > 0) {
      // 従来の方法：接続元の出力部品IDから部品名を取得
      const products = sourceNodeData.outputs.map((productId: string) => {
        // まず、componentsから該当する部品データを検索
        const component = components.find(c => c.id === productId);
        if (component) {
          return {
            id: component.id,
            name: component.name,
            isSourceOutput: true
          };
        }
        
        // 抽象的な部品IDを実際の部品IDにマッピング
        let actualProductId = productId;
        let displayName = '';
        
        switch (productId) {
          case 'STORED_PRODUCT':
            // 保管製品は、前工程の出力製品と同じ
            actualProductId = 'prod_bracket';
            displayName = 'ブラケット（保管製品）';
            break;
          case 'INSPECTED_ASSY':
            actualProductId = 'prod_bracket';
            displayName = 'ブラケット（検査済み）';
            break;
          case 'SUB_ASSY':
            actualProductId = 'prod_bracket';
            displayName = 'ブラケット（サブアセンブリ）';
            break;
          case 'PART_A':
            actualProductId = 'prod_steel';
            displayName = '鋼材（部品A）';
            break;
          case 'PART_B':
            actualProductId = 'prod_bolt';
            displayName = 'ボルト（部品B）';
            break;
          default:
            // 既存の部品IDとの照合を試行
            if (productId.startsWith('prod_')) {
              const existingComponent = components.find(c => c.id === productId);
              if (existingComponent) {
                actualProductId = existingComponent.id;
                displayName = existingComponent.name;
              } else {
                actualProductId = productId;
                displayName = `部品${productId}`;
              }
            } else {
              actualProductId = productId;
              displayName = `部品${productId}`;
            }
        }
        
        // マッピングされた実際の部品IDが存在するかチェック
        const mappedComponent = components.find(c => c.id === actualProductId);
        if (mappedComponent) {
          return {
            id: actualProductId,
            name: mappedComponent.name,
            isSourceOutput: true
          };
        }
        
        return {
          id: actualProductId,
          name: displayName,
          isSourceOutput: true
        };
      });
      
      // その他の利用可能な部品も追加
      const otherProducts = components
        .filter(component => !products.find((p: any) => p.id === component.id))
        .map(component => ({
          id: component.id,
          name: component.name,
          isSourceOutput: false
        }));
      
      setAvailableProducts([...products, ...otherProducts]);
    } else if (components && components.length > 0) {
      // 部品データが利用可能な場合は、すべての部品を表示
      const products = components.map(component => ({
        id: component.id,
        name: component.name,
        isSourceOutput: false
      }));
      setAvailableProducts(products);
    } else {
      // サンプルの利用可能部品を設定（開発用）
      setAvailableProducts([
        { id: 'prod_steel', name: '鋼材', isSourceOutput: false },
        { id: 'prod_bolt', name: 'ボルト', isSourceOutput: false },
        { id: 'prod_bracket', name: 'ブラケット', isSourceOutput: false },
        { id: 'prod_final', name: '完成品A', isSourceOutput: false },
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

    // 接続元の出力製品を優先的に選択
    const sourceOutputProduct = availableProducts.find(p => p.isSourceOutput);
    const selectedProduct = sourceOutputProduct || availableProducts[0];
    const componentData = components?.find(c => c.id === selectedProduct?.id);
    const defaultLotSize = componentData?.transportLotSize || 10;

    const newLot: TransportProduct = {
      id: generateId(),
      productId: selectedProduct?.id || '',
      productName: selectedProduct?.name || '',
      lotSize: defaultLotSize,
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

    // 接続元の出力製品を優先的に選択
    const sourceOutputProduct = availableProducts.find(p => p.isSourceOutput);
    const selectedProduct = sourceOutputProduct || availableProducts[0];

    const newProduct: TransportProduct = {
      id: generateId(),
      productId: selectedProduct?.id || '',
      productName: selectedProduct?.name || '',
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
    // これは搬送手段が一度に運べる総個数ではなく、ロット数の合計
    const totalLotSizes = method.transportProducts.reduce((total, product) => total + product.lotSize, 0);
    
    // 搬送キャパシティは、各搬送部品のロットサイズの合計を基準とする
    // 例：部品A（ロットサイズ10）、部品B（ロットサイズ5）の場合、搬送キャパシティは15ロット
    return totalLotSizes;
  };

  // 搬送可能な部品数の表示
  const getTransportableInfo = (method: TransportMethod) => {
    if (method.transportProducts.length === 0) return '搬送部品が設定されていません';
    
    const capacity = method.transportCapacity; // 搬送キャパシティ（ロット数）
    
    // 各搬送部品の最大搬送可能数を計算
    const products = method.transportProducts.map(product => {
      // 搬送キャパシティ（ロット数）をその部品のロットサイズで割って、最大搬送可能ロット数を計算
      const maxLots = Math.floor(capacity / product.lotSize);
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
          搬送手段設定
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {sourceNodeName} → {targetNodeName} の搬送手段と搬送部品を管理
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
          {/* 搬送手段の管理 */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary">
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
                                                         title="搬送部品ロットサイズから自動計算"
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
                            総搬送可能個数: {method.transportProducts.reduce((total, product) => {
                              const maxLots = Math.floor(method.transportCapacity / product.lotSize);
                              return total + (maxLots * product.lotSize);
                            }, 0)}個
                          </Typography>
                          <Typography variant="caption" color="info.dark" sx={{ display: 'block', mt: 1 }}>
                            💡 搬送キャパシティは各搬送部品のロットサイズの合計で設定されます
                          </Typography>
                        </Box>
                      </Grid>
                      
                      {/* 部品ロットの管理 */}
                      <Grid item xs={12}>
                        <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2" color="primary">
                              <ProductIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                              搬送部品設定
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => addProductLot(method.id)}
                            >
                              搬送部品追加
                            </Button>
                          </Box>
                          
                                                     {/* 接続元の出力製品に関する説明 */}
                           {availableProducts.some(p => p.isSourceOutput) && (
                             <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'success.light', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                               <Typography variant="caption" color="success.dark" sx={{ display: 'block', fontWeight: 'bold' }}>
                                 🎯 接続元の出力製品が優先表示されています
                               </Typography>
                               <Typography variant="caption" color="success.dark">
                                 • 🎯マークの部品は接続元の工程から出力される製品です
                                 • 複数の出力製品がある場合は、それぞれを搬送部品として設定できます
                                 • 接続元の出力製品以外の部品も選択可能です
                               </Typography>
                             </Box>
                           )}
                           
                           {/* 搬送部品設定の説明 */}
                           <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'info.light', borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                             <Typography variant="caption" color="info.dark" sx={{ display: 'block', fontWeight: 'bold' }}>
                                 📦 搬送部品設定の仕組み
                               </Typography>
                               <Typography variant="caption" color="info.dark">
                                 • <strong>ロットサイズ</strong>: 1ロットあたりの個数（例：10個/ロット）
                                 • <strong>搬送キャパシティ</strong>: 搬送手段が一度に運べるロット数
                                 • <strong>搬送可能個数</strong>: ロットサイズ × 搬送キャパシティ
                                 • 例：搬送キャパシティ10ロット、ロットサイズ10個の場合、100個運べます
                               </Typography>
                           </Box>
                          
                                                     {method.transportProducts.length === 0 ? (
                             <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                               搬送部品が設定されていません
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
                                              const componentData = components.find(c => c.id === e.target.value);
                                              const defaultLotSize = componentData?.transportLotSize || 10;
                                              
                                              updateProductLot(method.id, lot.id, { 
                                                productId: e.target.value as string,
                                                productName: product?.name || '',
                                                lotSize: defaultLotSize
                                              });
                                            }}
                                            displayEmpty
                                          >
                                            {/* 接続元の出力製品を優先的に表示 */}
                                            {availableProducts
                                              .filter(product => product.isSourceOutput)
                                              .map((product) => (
                                                <MenuItem 
                                                  key={product.id} 
                                                  value={product.id}
                                                  sx={{ 
                                                    backgroundColor: 'success.light',
                                                    '&:hover': { backgroundColor: 'success.main', color: 'white' }
                                                  }}
                                                >
                                                  🎯 {product.name} (接続元出力)
                                                  {product.outputQuantity && product.unit && 
                                                    ` - ${product.outputQuantity}${product.unit}`
                                                  }
                                                </MenuItem>
                                              ))}
                                            {/* 区切り線 */}
                                            {availableProducts.some(p => p.isSourceOutput) && 
                                             availableProducts.some(p => !p.isSourceOutput) && (
                                              <MenuItem disabled sx={{ borderTop: '1px solid #ccc' }}>
                                                ──────────────────────────
                                              </MenuItem>
                                            )}
                                            {/* その他の部品 */}
                                            {availableProducts
                                              .filter(product => !product.isSourceOutput)
                                              .map((product) => (
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

