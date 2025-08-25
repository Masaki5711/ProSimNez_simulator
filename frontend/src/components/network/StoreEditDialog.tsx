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
  Card,
  CardContent,
  CardHeader,
  Grid,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Store,
  Schedule,
  Inventory,
  AccessTime,
  Add,
  Delete,
  Edit,
  Settings,
} from '@mui/icons-material';
import { ProcessNodeData, ProductionScheduleItem, InventoryLevel, WorkingHours } from '../../types/networkEditor';
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

// Remove local interface and use the one from networkEditor types

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

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
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<ProcessNodeData>({
    label: '',
    type: 'store',
    cycleTime: 5,
    setupTime: 0,
    equipmentCount: 0,
    operatorCount: 0,
    // バッファ設定は材料設定で管理
    defectRate: 0,
    reworkRate: 0,
    operatingCost: 10,
    inputs: [],
    outputs: [],
    storeType: 'component',
    productionSchedule: [],
    inventoryLevels: [],
  });

  // スケジュール設定
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [capacity, setCapacity] = useState(1000);
  const [safetyStock, setSafetyStock] = useState(50);
  const [reorderPoint, setReorderPoint] = useState(100);
  const [autoReplenishment, setAutoReplenishment] = useState(true);

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

      // スケジュール設定の初期化
      setCapacity(nodeData.capacity || 1000);
      setSafetyStock(nodeData.safetyStock || 50);
      setReorderPoint(nodeData.reorderPoint || 100);
      setAutoReplenishment(nodeData.autoReplenishment !== false);
      setWorkingHours(nodeData.workingHours || getDefaultWorkingHours());
    }
  }, [nodeData]);

  // デフォルト稼働時間
  const getDefaultWorkingHours = (): WorkingHours[] => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days.map((_, index) => ({
      id: `day_${index}`,
      dayOfWeek: index,
      startTime: '08:00',
      endTime: '17:00',
      breakTimes: [{ 
        id: `break_${index}_0`,
        name: '昼休憩',
        startTime: '12:00', 
        endTime: '13:00' 
      }],
      isWorkingDay: index >= 1 && index <= 5, // 月-金が稼働日
    }));
  };

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

  // 稼働時間更新
  const updateWorkingHours = (dayIndex: number, field: keyof WorkingHours, value: any) => {
    setWorkingHours(workingHours.map((wh: WorkingHours, index: number) => 
      index === dayIndex ? { ...wh, [field]: value } : wh
    ));
  };

  // 休憩時間追加
  const addBreakTime = (dayIndex: number) => {
    const newBreakTimes = [...workingHours[dayIndex].breakTimes, { 
      id: `break_${dayIndex}_${workingHours[dayIndex].breakTimes.length}`,
      name: '休憩',
      startTime: '10:00', 
      endTime: '10:15' 
    }];
    updateWorkingHours(dayIndex, 'breakTimes', newBreakTimes);
  };

  // 休憩時間削除
  const removeBreakTime = (dayIndex: number, breakIndex: number) => {
    const newBreakTimes = workingHours[dayIndex].breakTimes.filter((_: any, index: number) => index !== breakIndex);
    updateWorkingHours(dayIndex, 'breakTimes', newBreakTimes);
  };

  // 生産スケジュール管理
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

  // 在庫管理
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

  // 総稼働時間計算
  const calculateTotalWorkingHours = (): number => {
    return workingHours.reduce((total: number, wh: WorkingHours) => {
      if (!wh.isWorkingDay) return total;
      
      const start = parseTime(wh.startTime);
      const end = parseTime(wh.endTime);
      const workTime = end - start;
      
      const breakTime = wh.breakTimes.reduce((breakTotal: number, breakTime: any) => {
        const breakStart = parseTime(breakTime.startTime);
        const breakEnd = parseTime(breakTime.endTime);
        return breakTotal + (breakEnd - breakStart);
      }, 0);
      
      return total + Math.max(0, workTime - breakTime);
    }, 0);
  };

  // 時間文字列をミリ秒に変換
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60 + minutes) * 60 * 1000;
  };

  const handleSave = () => {
    const savedData = {
      ...formData,
      // スケジュール設定
      capacity,
      safetyStock,
      reorderPoint,
      autoReplenishment,
      workingHours,
      // シミュレーション制御用設定
      cycleBasedOnStore: formData.storeType === 'finished_product', // 完成品ストアがシミュレーション制御
      simulationDuration: calculateTotalWorkingHours() / (1000 * 60 * 60), // 総稼働時間（時間）
      // 機能有効化フラグ
      enableStoreScheduleControl: true,
      enableInventoryManagement: formData.inventoryLevels ? formData.inventoryLevels.length > 0 : false,
    };

    onSave(savedData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Store color="primary" />
          <Typography variant="h6">ストア設定</Typography>
          <Chip label={formData.label || 'ストア'} size="small" />
          <Chip
            label={formData.storeType === 'finished_product' ? '完成品ストア' : '部品ストア'}
            color={formData.storeType === 'finished_product' ? 'success' : 'warning'}
            size="small"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="基本設定" icon={<Settings />} iconPosition="start" />
            <Tab label="生産スケジュール" icon={<Schedule />} iconPosition="start" />
            <Tab label="稼働時間" icon={<AccessTime />} iconPosition="start" />
            <Tab label="在庫管理" icon={<Inventory />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 基本設定タブ */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="ストア名"
                value={formData.label}
                onChange={(e) => handleInputChange('label', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>ストアタイプ</InputLabel>
                <Select
                  value={formData.storeType}
                  onChange={(e) => handleInputChange('storeType', e.target.value)}
                  label="ストアタイプ"
                >
                  <MenuItem value="finished_product">完成品ストア</MenuItem>
                  <MenuItem value="component">部品ストア</MenuItem>
                  <MenuItem value="raw_material">原材料ストア</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="最大容量"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="安全在庫"
                type="number"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="発注点"
                type="number"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(Number(e.target.value))}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoReplenishment}
                    onChange={(e) => setAutoReplenishment(e.target.checked)}
                  />
                }
                label="自動補充"
              />
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>重要:</strong> 完成品ストアのスケジュールはシミュレーション全体の動作サイクルのベースとなります。
              稼働時間と生産計画に基づいて、システム全体の時間が進行します。
            </Typography>
          </Alert>
        </TabPanel>

        {/* 生産スケジュールタブ */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">生産計画</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddSchedule}
            >
              計画追加
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>順序</TableCell>
                  <TableCell>製品名</TableCell>
                  <TableCell>数量</TableCell>
                  <TableCell>単位</TableCell>
                  <TableCell>優先度</TableCell>
                  <TableCell>開始時刻</TableCell>
                  <TableCell>終了時刻</TableCell>
                  <TableCell>状態</TableCell>
                  <TableCell>操作</TableCell>
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
                        label={schedule.isActive ? '有効' : '無効'}
                        color={schedule.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSchedule(schedule)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {formData.productionSchedule?.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              生産計画が設定されていません。「計画追加」ボタンから計画を追加してください。
            </Alert>
          )}

          {/* 前工程の出力製品情報 */}
          {getPrecedingOutputProducts().length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardHeader title="前工程からの出力製品" />
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  以下の製品が前工程から流れてきます。生産計画で使用できます。
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {getPrecedingOutputProducts().map((product, index) => (
                    <Chip
                      key={index}
                      label={`${product.name} (${product.processName})`}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* 稼働時間タブ */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" gutterBottom>週間稼働時間設定</Typography>
          
          {workingHours.map((wh: WorkingHours, dayIndex: number) => (
            <Card key={dayIndex} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ minWidth: 40 }}>
                    {['日', '月', '火', '水', '木', '金', '土'][dayIndex]}曜日
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={wh.isWorkingDay}
                        onChange={(e) => updateWorkingHours(dayIndex, 'isWorkingDay', e.target.checked)}
                      />
                    }
                    label="稼働日"
                  />
                </Box>

                {wh.isWorkingDay && (
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <TextField
                        fullWidth
                        label="開始時刻"
                        type="time"
                        size="small"
                        value={wh.startTime}
                        onChange={(e) => updateWorkingHours(dayIndex, 'startTime', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        fullWidth
                        label="終了時刻"
                        type="time"
                        size="small"
                        value={wh.endTime}
                        onChange={(e) => updateWorkingHours(dayIndex, 'endTime', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">休憩時間:</Typography>
                        {wh.breakTimes.map((breakTime: any, breakIndex: number) => (
                          <Box key={breakIndex} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TextField
                              size="small"
                              type="time"
                              value={breakTime.startTime}
                              onChange={(e) => {
                                const newBreakTimes = [...wh.breakTimes];
                                newBreakTimes[breakIndex].startTime = e.target.value;
                                updateWorkingHours(dayIndex, 'breakTimes', newBreakTimes);
                              }}
                              sx={{ width: 80 }}
                            />
                            <Typography variant="body2">-</Typography>
                            <TextField
                              size="small"
                              type="time"
                              value={breakTime.endTime}
                              onChange={(e) => {
                                const newBreakTimes = [...wh.breakTimes];
                                newBreakTimes[breakIndex].endTime = e.target.value;
                                updateWorkingHours(dayIndex, 'breakTimes', newBreakTimes);
                              }}
                              sx={{ width: 80 }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => removeBreakTime(dayIndex, breakIndex)}
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        ))}
                        <Button
                          size="small"
                          onClick={() => addBreakTime(dayIndex)}
                        >
                          休憩追加
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          ))}

          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              週間総稼働時間: {(calculateTotalWorkingHours() / (1000 * 60 * 60)).toFixed(1)}時間
            </Typography>
          </Alert>
        </TabPanel>

        {/* 在庫管理タブ */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    在庫レベル設定
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">安全在庫</Typography>
                      <Typography variant="h6" color="success.main">{safetyStock}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">発注点</Typography>
                      <Typography variant="h6" color="warning.main">{reorderPoint}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">最大容量</Typography>
                      <Typography variant="h6" color="error.main">{capacity}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    補充設定
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoReplenishment}
                        onChange={(e) => setAutoReplenishment(e.target.checked)}
                      />
                    }
                    label="自動補充機能"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    在庫が発注点を下回った時に自動的に補充指示を出します
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
            <Typography variant="h6">在庫アイテム</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddInventory}
            >
              在庫追加
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>製品名</TableCell>
                  <TableCell>現在在庫</TableCell>
                  <TableCell>最小在庫</TableCell>
                  <TableCell>最大在庫</TableCell>
                  <TableCell>単位</TableCell>
                  <TableCell>発注点</TableCell>
                  <TableCell>操作</TableCell>
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
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteInventory(inventory.productId)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

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
                            <em>前工程からの出力製品</em>
                          </MenuItem>
                          {getPrecedingOutputProducts().map(product => (
                            <MenuItem key={`preceding-${product.id}`} value={product.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography>{product.name}</Typography>
                                <Chip label={product.processName} size="small" color="primary" />
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
                          {product.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
                    label="優先度"
                    type="number"
                    value={editingSchedule.priority}
                    onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, priority: parseInt(e.target.value) } : null)}
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
              <Button onClick={handleSaveSchedule} variant="contained">
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
                      {getPrecedingOutputProducts().map(product => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.name}
                        </MenuItem>
                      ))}
                      {products.map(product => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
                <Grid item xs={6}>
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
              <Button onClick={handleSaveInventory} variant="contained">
                保存
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoreEditDialog;