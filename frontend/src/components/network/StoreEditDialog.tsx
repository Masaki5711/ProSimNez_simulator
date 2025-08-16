import React, { useState, useEffect } from 'react';
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
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Grid,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { ProcessNodeData, ProductionScheduleItem, InventoryLevel } from '../../types/networkEditor';
import { Product, AdvancedProcessData } from '../../types/productionTypes';

interface StoreEditDialogProps {
  open: boolean;
  onClose: () => void;
  nodeData: ProcessNodeData | null;
  products?: Product[];
  nodes?: any[];
  edges?: any[];
  processAdvancedData?: Map<string, AdvancedProcessData>;
  onSave: (nodeData: ProcessNodeData) => void;
}

const StoreEditDialog: React.FC<StoreEditDialogProps> = ({
  open,
  onClose,
  nodeData,
  products = [],
  nodes = [],
  edges = [],
  processAdvancedData = new Map(),
  onSave,
}) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<ProcessNodeData>({
    label: '',
    type: 'store',
    cycleTime: 5,
    setupTime: 0,
    equipmentCount: 0,
    operatorCount: 0,
    inputBufferCapacity: 1000,
    outputBufferCapacity: 1000,
    defectRate: 0,
    reworkRate: 0,
    operatingCost: 10,
    inputs: [],
    outputs: [],
    storeType: 'component',
    productionSchedule: [],
    inventoryLevels: [],
  });

  const [editingSchedule, setEditingSchedule] = useState<ProductionScheduleItem | null>(null);
  const [editingInventory, setEditingInventory] = useState<InventoryLevel | null>(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isAddingInventory, setIsAddingInventory] = useState(false);

  useEffect(() => {
    if (nodeData) {
      setFormData({
        ...nodeData,
        storeType: nodeData.storeType || 'component',
        productionSchedule: nodeData.productionSchedule || [],
        inventoryLevels: nodeData.inventoryLevels || [],
      });
    }
  }, [nodeData]);

  // 前工程を取得する関数
  const getPrecedingProcesses = () => {
    if (!nodeData?.id) return [];
    
    return edges
      .filter(edge => edge.target === nodeData.id)
      .map(edge => {
        const sourceNode = nodes.find(node => node.id === edge.source);
        const sourceProcessData = processAdvancedData.get(edge.source);
        return {
          id: edge.source,
          name: sourceNode?.data?.label || sourceNode?.data?.name || 'Unknown Process',
          data: sourceProcessData
        };
      })
      .filter(process => process.data);
  };

  // 前工程の出力製品を取得する関数
  const getPrecedingOutputProducts = () => {
    const precedingProcesses = getPrecedingProcesses();
    const outputProducts: any[] = [];
    
    precedingProcesses.forEach(process => {
      if (process.data?.outputProducts) {
        process.data.outputProducts.forEach((output: any) => {
          const product = products.find(p => p.id === output.productId);
          if (product) {
            outputProducts.push({
              ...product,
              processName: process.name,
              processId: process.id,
              outputQuantity: output.outputQuantity,
              qualityLevel: output.qualityLevel
            });
          }
        });
      }
    });
    
    return outputProducts;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddSchedule = () => {
    const newSchedule: ProductionScheduleItem = {
      id: `schedule_${Date.now()}`,
      productId: '',
      productName: '',
      quantity: 1,
      unit: '個',
      priority: 1,
      sequence: (formData.productionSchedule?.length || 0) + 1,
      startTime: '08:00',
      endTime: '17:00',
      isActive: true,
    };
    setEditingSchedule(newSchedule);
    setIsAddingSchedule(true);
  };

  const handleEditSchedule = (schedule: ProductionScheduleItem) => {
    setEditingSchedule(schedule);
    setIsAddingSchedule(false);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setFormData(prev => ({
      ...prev,
      productionSchedule: prev.productionSchedule?.filter(s => s.id !== scheduleId) || [],
    }));
  };

  const handleSaveSchedule = () => {
    if (!editingSchedule) return;

    if (isAddingSchedule) {
      setFormData(prev => ({
        ...prev,
        productionSchedule: [...(prev.productionSchedule || []), editingSchedule],
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        productionSchedule: prev.productionSchedule?.map(s =>
          s.id === editingSchedule.id ? editingSchedule : s
        ) || [],
      }));
    }

    setEditingSchedule(null);
    setIsAddingSchedule(false);
  };

  const handleAddInventory = () => {
    const newInventory: InventoryLevel = {
      productId: '',
      productName: '',
      currentStock: 0,
      minStock: 10,
      maxStock: 100,
      unit: '個',
      reorderPoint: 20,
    };
    setEditingInventory(newInventory);
    setIsAddingInventory(true);
  };

  const handleEditInventory = (inventory: InventoryLevel) => {
    setEditingInventory(inventory);
    setIsAddingInventory(false);
  };

  const handleDeleteInventory = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      inventoryLevels: prev.inventoryLevels?.filter(i => i.productId !== productId) || [],
    }));
  };

  const handleSaveInventory = () => {
    if (!editingInventory) return;

    if (isAddingInventory) {
      setFormData(prev => ({
        ...prev,
        inventoryLevels: [...(prev.inventoryLevels || []), editingInventory],
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        inventoryLevels: prev.inventoryLevels?.map(i =>
          i.productId === editingInventory.productId ? editingInventory : i
        ) || [],
      }));
    }

    setEditingInventory(null);
    setIsAddingInventory(false);
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
                     <Typography variant="h6">{t('store.title')}</Typography>
          <Chip
                         label={formData.storeType === 'finished_product' ? t('store.finishedProductStore') : t('store.componentStore')}
            color={formData.storeType === 'finished_product' ? 'success' : 'warning'}
            size="small"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* 基本設定 */}
          <Grid item xs={12}>
                         <Typography variant="h6" gutterBottom>{t('process.basicSettings')}</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label={t('network.storeName')}
                  value={formData.label}
                  onChange={(e) => handleInputChange('label', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                                     <InputLabel>{t('store.storeType')}</InputLabel>
                  <Select
                    value={formData.storeType}
                    onChange={(e) => handleInputChange('storeType', e.target.value)}
                                         label={t('store.storeType')}
                  >
                                         <MenuItem value="finished_product">{t('store.finishedProductStore')}</MenuItem>
                     <MenuItem value="component">{t('store.componentStore')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                                     label={t('store.inputBufferCapacity')}
                  type="number"
                  value={formData.inputBufferCapacity}
                  onChange={(e) => handleInputChange('inputBufferCapacity', parseInt(e.target.value))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                                     label={t('store.outputBufferCapacity')}
                  type="number"
                  value={formData.outputBufferCapacity}
                  onChange={(e) => handleInputChange('outputBufferCapacity', parseInt(e.target.value))}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* 生産計画 */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">{t('store.productionSchedule')}</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSchedule}
                size="small"
              >
                                 {t('store.addSchedule')}
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                                         <TableCell>{t('store.sequence')}</TableCell>
                     <TableCell>{t('store.productName')}</TableCell>
                     <TableCell>{t('store.quantity')}</TableCell>
                     <TableCell>{t('store.unit')}</TableCell>
                     <TableCell>{t('store.priority')}</TableCell>
                     <TableCell>{t('store.startTime')}</TableCell>
                     <TableCell>{t('store.endTime')}</TableCell>
                     <TableCell>{t('store.status')}</TableCell>
                     <TableCell>{t('store.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.productionSchedule?.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>{schedule.sequence}</TableCell>
                      <TableCell>{schedule.productName}</TableCell>
                      <TableCell>{schedule.quantity}</TableCell>
                      <TableCell>{schedule.unit}</TableCell>
                      <TableCell>{schedule.priority}</TableCell>
                      <TableCell>{schedule.startTime}</TableCell>
                      <TableCell>{schedule.endTime}</TableCell>
                      <TableCell>
                        <Chip
                          label={schedule.isActive ? t('store.active') : t('store.inactive')}
                          color={schedule.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* 在庫レベル */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">{t('store.inventoryLevels')}</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddInventory}
                size="small"
              >
                                 {t('store.addInventory')}
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                                         <TableCell>{t('store.productName')}</TableCell>
                     <TableCell>{t('store.currentStock')}</TableCell>
                     <TableCell>{t('store.minStock')}</TableCell>
                     <TableCell>{t('store.maxStock')}</TableCell>
                     <TableCell>{t('store.unit')}</TableCell>
                     <TableCell>{t('store.reorderPoint')}</TableCell>
                     <TableCell>{t('store.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.inventoryLevels?.map((inventory) => (
                    <TableRow key={inventory.productId}>
                      <TableCell>{inventory.productName}</TableCell>
                      <TableCell>{inventory.currentStock}</TableCell>
                      <TableCell>{inventory.minStock}</TableCell>
                      <TableCell>{inventory.maxStock}</TableCell>
                      <TableCell>{inventory.unit}</TableCell>
                      <TableCell>{inventory.reorderPoint}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEditInventory(inventory)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteInventory(inventory.productId)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>

        {/* 生産計画編集ダイアログ */}
        {editingSchedule && (
          <Dialog open={!!editingSchedule} onClose={() => setEditingSchedule(null)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {isAddingSchedule ? '生産計画追加' : '生産計画編集'}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>製品選択</InputLabel>
                    <Select
                      value={editingSchedule.productId}
                      onChange={(e) => {
                        const selectedProduct = [...getPrecedingOutputProducts(), ...products].find(p => p.id === e.target.value);
                        if (selectedProduct) {
                          setEditingSchedule(prev => prev ? { 
                            ...prev, 
                            productId: e.target.value,
                            productName: selectedProduct.name,
                            unit: selectedProduct.unit || '個'
                          } : null);
                        }
                      }}
                      label="製品選択"
                    >
                      {getPrecedingOutputProducts().length > 0 && (
                        <>
                          <MenuItem disabled>
                            <em>前工程からの出力製品 (生産計画候補)</em>
                          </MenuItem>
                          {getPrecedingOutputProducts().map(product => (
                            <MenuItem key={`preceding-${product.id}`} value={product.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography>{product.name}</Typography>
                                <Chip label={product.processName} size="small" color="primary" />
                                <Chip label={`出力量: ${product.outputQuantity}`} size="small" color="info" />
                              </Box>
                            </MenuItem>
                          ))}
                          <MenuItem disabled>
                            <em>全ての製品</em>
                          </MenuItem>
                        </>
                      )}
                      {products.map(product => (
                        <MenuItem key={product.id} value={product.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography>{product.name}</Typography>
                            <Chip label={product.type} size="small" />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="製品名"
                    value={editingSchedule.productName}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, productName: e.target.value } : null)}
                    InputProps={{ readOnly: true }}
                    helperText="製品選択で自動入力されます"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="数量"
                    type="number"
                    value={editingSchedule.quantity}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, quantity: parseInt(e.target.value) } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="単位"
                    value={editingSchedule.unit}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, unit: e.target.value } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="優先度"
                    type="number"
                    value={editingSchedule.priority}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, priority: parseInt(e.target.value) } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="順序"
                    type="number"
                    value={editingSchedule.sequence}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, sequence: parseInt(e.target.value) } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="開始時刻"
                    type="time"
                    value={editingSchedule.startTime}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, startTime: e.target.value } : null)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="終了時刻"
                    type="time"
                    value={editingSchedule.endTime}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, endTime: e.target.value } : null)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingSchedule.isActive}
                        onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                      />
                    }
                    label="有効"
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingSchedule(null)}>キャンセル</Button>
              <Button onClick={handleSaveSchedule} variant="contained" startIcon={<SaveIcon />}>
                保存
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {/* 在庫レベル編集ダイアログ */}
        {editingInventory && (
          <Dialog open={!!editingInventory} onClose={() => setEditingInventory(null)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {isAddingInventory ? '在庫レベル追加' : '在庫レベル編集'}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>製品選択</InputLabel>
                    <Select
                      value={editingInventory.productId}
                      onChange={(e) => {
                        const selectedProduct = [...getPrecedingOutputProducts(), ...products].find(p => p.id === e.target.value);
                        if (selectedProduct) {
                          setEditingInventory(prev => prev ? { 
                            ...prev, 
                            productId: e.target.value,
                            productName: selectedProduct.name,
                            unit: selectedProduct.unit || '個'
                          } : null);
                        }
                      }}
                      label="製品選択"
                    >
                      {getPrecedingOutputProducts().length > 0 && (
                        <>
                          <MenuItem disabled>
                            <em>前工程からの出力製品 (在庫候補)</em>
                          </MenuItem>
                          {getPrecedingOutputProducts().map(product => (
                            <MenuItem key={`preceding-inventory-${product.id}`} value={product.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography>{product.name}</Typography>
                                <Chip label={product.processName} size="small" color="secondary" />
                                <Chip label={`品質: ${product.qualityLevel || 'standard'}`} size="small" color="info" />
                              </Box>
                            </MenuItem>
                          ))}
                          <MenuItem disabled>
                            <em>全ての製品</em>
                          </MenuItem>
                        </>
                      )}
                      {products.map(product => (
                        <MenuItem key={product.id} value={product.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography>{product.name}</Typography>
                            <Chip label={product.type} size="small" />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="製品名"
                    value={editingInventory.productName}
                    onChange={(e) => setEditingInventory(prev => prev ? { ...prev, productName: e.target.value } : null)}
                    InputProps={{ readOnly: true }}
                    helperText="製品選択で自動入力されます"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="現在在庫"
                    type="number"
                    value={editingInventory.currentStock}
                    onChange={(e) => setEditingInventory(prev => prev ? { ...prev, currentStock: parseInt(e.target.value) } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="単位"
                    value={editingInventory.unit}
                    onChange={(e) => setEditingInventory(prev => prev ? { ...prev, unit: e.target.value } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="最小在庫"
                    type="number"
                    value={editingInventory.minStock}
                    onChange={(e) => setEditingInventory(prev => prev ? { ...prev, minStock: parseInt(e.target.value) } : null)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="最大在庫"
                    type="number"
                    value={editingInventory.maxStock}
                    onChange={(e) => setEditingInventory(prev => prev ? { ...prev, maxStock: parseInt(e.target.value) } : null)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="発注点"
                    type="number"
                    value={editingInventory.reorderPoint}
                    onChange={(e) => setEditingInventory(prev => prev ? { ...prev, reorderPoint: parseInt(e.target.value) } : null)}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingInventory(null)}>キャンセル</Button>
              <Button onClick={handleSaveInventory} variant="contained" startIcon={<SaveIcon />}>
                保存
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </DialogContent>

      <DialogActions>
                 <Button onClick={onClose}>{t('common.cancel')}</Button>
         <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>
           {t('common.save')}
         </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoreEditDialog; 