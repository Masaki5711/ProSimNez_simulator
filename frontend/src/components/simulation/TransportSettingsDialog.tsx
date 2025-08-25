import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  LocalShipping,
  Delete,
  Add,
  Speed,
  Inventory,
  Settings,
  Timer,
  AccountTree,
  DirectionsCar,
  Train,
  FlightTakeoff,
  Directions,
} from '@mui/icons-material';

interface TransportSettingsDialogProps {
  open: boolean;
  edgeId: string;
  edgeData: any;
  onClose: () => void;
  onSave: (transportData: any) => void;
}

interface TransportMethod {
  id: string;
  name: string;
  type: 'conveyor' | 'agv' | 'forklift' | 'manual' | 'robot' | 'crane';
  capacity: number; // 最大搬送可能数
  speed: number; // 搬送速度 (m/分)
  cost: number; // 搬送コスト (円/個)
  reliability: number; // 信頼性 (%)
  energyConsumption: number; // エネルギー消費 (kWh/km)
}

interface TransportMaterial {
  id: string;
  name: string;
  weight: number; // 重量 (kg)
  volume: number; // 容積 (m³)
  fragility: 'low' | 'medium' | 'high'; // 壊れやすさ
  priority: number; // 搬送優先度
  restrictions: string[]; // 搬送制限
}

interface TransportCapability {
  materialId: string;
  maxQuantity: number;
  handlingTime: number; // 取り扱い時間 (秒)
  specialRequirements: string[];
}

const TransportSettingsDialog: React.FC<TransportSettingsDialogProps> = ({
  open,
  edgeId,
  edgeData,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [transportName, setTransportName] = useState('');
  const [distance, setDistance] = useState(10); // メートル
  
  // 搬送手段設定
  const [selectedMethod, setSelectedMethod] = useState<TransportMethod | null>(null);
  const [availableMethods] = useState<TransportMethod[]>([
    {
      id: 'conveyor_belt',
      name: 'ベルトコンベア',
      type: 'conveyor',
      capacity: 50,
      speed: 30,
      cost: 1,
      reliability: 95,
      energyConsumption: 2.5,
    },
    {
      id: 'agv_vehicle',
      name: 'AGV (無人搬送車)',
      type: 'agv',
      capacity: 20,
      speed: 60,
      cost: 5,
      reliability: 90,
      energyConsumption: 8.0,
    },
    {
      id: 'forklift',
      name: 'フォークリフト',
      type: 'forklift',
      capacity: 100,
      speed: 120,
      cost: 3,
      reliability: 85,
      energyConsumption: 15.0,
    },
    {
      id: 'manual_transport',
      name: '手作業搬送',
      type: 'manual',
      capacity: 5,
      speed: 20,
      cost: 10,
      reliability: 80,
      energyConsumption: 0,
    },
    {
      id: 'robotic_arm',
      name: 'ロボットアーム',
      type: 'robot',
      capacity: 10,
      speed: 40,
      cost: 2,
      reliability: 98,
      energyConsumption: 5.0,
    },
    {
      id: 'overhead_crane',
      name: 'オーバーヘッドクレーン',
      type: 'crane',
      capacity: 200,
      speed: 25,
      cost: 8,
      reliability: 92,
      energyConsumption: 20.0,
    },
  ]);

  // 搬送可能部品設定
  const [transportMaterials, setTransportMaterials] = useState<TransportMaterial[]>([]);
  const [transportCapabilities, setTransportCapabilities] = useState<TransportCapability[]>([]);

  // 搬送制御設定
  const [batchTransport, setBatchTransport] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [transportTrigger, setTransportTrigger] = useState<'immediate' | 'batch_full' | 'time_interval'>('immediate');
  const [transportInterval, setTransportInterval] = useState(300); // 秒
  const [priorityMode, setPriorityMode] = useState<'fifo' | 'priority' | 'deadline'>('fifo');

  // 初期化
  useEffect(() => {
    if (edgeData) {
      setTransportName(edgeData.label || `${edgeData.source} → ${edgeData.target}`);
      setDistance(edgeData.distance || 10);
      
      // 搬送手段の選択
      const methodId = edgeData.transportMethodId || 'conveyor_belt';
      const method = availableMethods.find(m => m.id === methodId);
      setSelectedMethod(method || availableMethods[0]);
      
      // 搬送部品
      setTransportMaterials(edgeData.transportMaterials || []);
      setTransportCapabilities(edgeData.transportCapabilities || []);
      
      // 制御設定
      setBatchTransport(edgeData.batchTransport || false);
      setBatchSize(edgeData.batchSize || 10);
      setTransportTrigger(edgeData.transportTrigger || 'immediate');
      setTransportInterval(edgeData.transportInterval || 300);
      setPriorityMode(edgeData.priorityMode || 'fifo');
    }
  }, [edgeData, availableMethods]);

  // 搬送部品追加
  const addTransportMaterial = () => {
    const newMaterial: TransportMaterial = {
      id: `material_${Date.now()}`,
      name: '',
      weight: 1.0,
      volume: 0.01,
      fragility: 'medium',
      priority: 1,
      restrictions: [],
    };
    setTransportMaterials([...transportMaterials, newMaterial]);
    
    // 搬送能力も追加
    const newCapability: TransportCapability = {
      materialId: newMaterial.id,
      maxQuantity: selectedMethod?.capacity || 10,
      handlingTime: 5,
      specialRequirements: [],
    };
    setTransportCapabilities([...transportCapabilities, newCapability]);
  };

  // 搬送部品削除
  const deleteTransportMaterial = (materialId: string) => {
    setTransportMaterials(transportMaterials.filter(m => m.id !== materialId));
    setTransportCapabilities(transportCapabilities.filter(c => c.materialId !== materialId));
  };

  // 搬送部品更新
  const updateTransportMaterial = (materialId: string, field: keyof TransportMaterial, value: any) => {
    setTransportMaterials(transportMaterials.map(m => 
      m.id === materialId ? { ...m, [field]: value } : m
    ));
  };

  // 搬送能力更新
  const updateTransportCapability = (materialId: string, field: keyof TransportCapability, value: any) => {
    setTransportCapabilities(transportCapabilities.map(c => 
      c.materialId === materialId ? { ...c, [field]: value } : c
    ));
  };

  // 搬送時間計算
  const calculateTransportTime = (): number => {
    if (!selectedMethod) return 0;
    return (distance / selectedMethod.speed) * 60; // 秒単位
  };

  // 搬送コスト計算
  const calculateTransportCost = (): number => {
    if (!selectedMethod) return 0;
    return selectedMethod.cost * (distance / 1000); // km換算
  };

  // 搬送手段アイコン
  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'conveyor': return <Train />;
      case 'agv': return <DirectionsCar />;
      case 'forklift': return <LocalShipping />;
      case 'manual': return <Directions />;
      case 'robot': return <Settings />;
      case 'crane': return <FlightTakeoff />;
      default: return <LocalShipping />;
    }
  };

  // 壊れやすさの色
  const getFragilityColor = (fragility: string) => {
    switch (fragility) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // 保存処理
  const handleSave = () => {
    const transportData = {
      transportName,
      distance,
      
      // 搬送手段
      transportMethodId: selectedMethod?.id,
      transportMethod: selectedMethod,
      
      // 搬送部品と能力
      transportMaterials,
      transportCapabilities,
      
      // 制御設定
      batchTransport,
      batchSize,
      transportTrigger,
      transportInterval,
      priorityMode,
      
      // 計算値
      transportTime: calculateTransportTime(),
      transportCost: calculateTransportCost(),
      
      // 追加設定
      enableCapacityControl: transportMaterials.length > 0,
      enablePriorityControl: priorityMode !== 'fifo',
      maxCapacity: selectedMethod?.capacity || 100,
    };
    
    onSave(transportData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping color="primary" />
          <Typography variant="h6">搬送設定</Typography>
          <Chip label={edgeId} size="small" />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="搬送手段" icon={<LocalShipping />} iconPosition="start" />
            <Tab label="搬送部品" icon={<Inventory />} iconPosition="start" />
            <Tab label="制御設定" icon={<Settings />} iconPosition="start" />
            <Tab label="性能計算" icon={<Speed />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 搬送手段タブ */}
        {activeTab === 0 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="搬送ルート名"
                  value={transportName}
                  onChange={(e) => setTransportName(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="搬送距離 (m)"
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  選択中の搬送手段
                </Typography>
                {selectedMethod && (
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getTransportIcon(selectedMethod.type)}
                        <Typography variant="h6">{selectedMethod.name}</Typography>
                      </Box>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            容量: {selectedMethod.capacity}個
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            速度: {selectedMethod.speed}m/分
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            コスト: {selectedMethod.cost}円/個
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            信頼性: {selectedMethod.reliability}%
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>搬送手段選択</Typography>
            <Grid container spacing={2}>
              {availableMethods.map((method) => (
                <Grid item xs={12} md={6} key={method.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedMethod?.id === method.id ? '2px solid' : '1px solid',
                      borderColor: selectedMethod?.id === method.id ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setSelectedMethod(method)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getTransportIcon(method.type)}
                        <Typography variant="subtitle1">{method.name}</Typography>
                        {selectedMethod?.id === method.id && (
                          <Chip label="選択中" color="primary" size="small" />
                        )}
                      </Box>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            容量: {method.capacity}個
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            速度: {method.speed}m/分
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            コスト: {method.cost}円/個
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            信頼性: {method.reliability}%
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* 搬送部品タブ */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">搬送可能部品設定</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={addTransportMaterial}
              >
                部品追加
              </Button>
            </Box>

            {transportMaterials.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>部品名</TableCell>
                      <TableCell>重量 (kg)</TableCell>
                      <TableCell>容積 (m³)</TableCell>
                      <TableCell>壊れやすさ</TableCell>
                      <TableCell>優先度</TableCell>
                      <TableCell>最大数量</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transportMaterials.map((material) => {
                      const capability = transportCapabilities.find(c => c.materialId === material.id);
                      return (
                        <TableRow key={material.id}>
                          <TableCell>
                            <TextField
                              size="small"
                              value={material.name}
                              onChange={(e) => updateTransportMaterial(material.id, 'name', e.target.value)}
                              placeholder="部品名"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={material.weight}
                              onChange={(e) => updateTransportMaterial(material.id, 'weight', Number(e.target.value))}
                              inputProps={{ step: 0.1 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={material.volume}
                              onChange={(e) => updateTransportMaterial(material.id, 'volume', Number(e.target.value))}
                              inputProps={{ step: 0.001 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={material.fragility}
                              onChange={(e) => updateTransportMaterial(material.id, 'fragility', e.target.value)}
                            >
                              <MenuItem value="low">低</MenuItem>
                              <MenuItem value="medium">中</MenuItem>
                              <MenuItem value="high">高</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={material.priority}
                              onChange={(e) => updateTransportMaterial(material.id, 'priority', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={capability?.maxQuantity || 0}
                              onChange={(e) => updateTransportCapability(material.id, 'maxQuantity', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => deleteTransportMaterial(material.id)}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                搬送可能部品が設定されていません。「部品追加」ボタンから追加してください。
              </Alert>
            )}
          </Box>
        )}

        {/* 制御設定タブ */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>搬送制御設定</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="バッチ搬送" avatar={<AccountTree color="primary" />} />
                  <CardContent>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={batchTransport}
                          onChange={(e) => setBatchTransport(e.target.checked)}
                        />
                      }
                      label="バッチ搬送を有効にする"
                      sx={{ mb: 2 }}
                    />
                    
                    {batchTransport && (
                      <>
                        <TextField
                          fullWidth
                          label="バッチサイズ"
                          type="number"
                          value={batchSize}
                          onChange={(e) => setBatchSize(Number(e.target.value))}
                          sx={{ mb: 2 }}
                        />
                        
                        <FormControl fullWidth>
                          <InputLabel>搬送トリガー</InputLabel>
                          <Select
                            value={transportTrigger}
                            onChange={(e) => setTransportTrigger(e.target.value as any)}
                          >
                            <MenuItem value="immediate">即座</MenuItem>
                            <MenuItem value="batch_full">バッチ満杯時</MenuItem>
                            <MenuItem value="time_interval">時間間隔</MenuItem>
                          </Select>
                        </FormControl>
                        
                        {transportTrigger === 'time_interval' && (
                          <TextField
                            fullWidth
                            label="搬送間隔 (秒)"
                            type="number"
                            value={transportInterval}
                            onChange={(e) => setTransportInterval(Number(e.target.value))}
                            sx={{ mt: 2 }}
                          />
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="優先度制御" avatar={<Timer color="warning" />} />
                  <CardContent>
                    <FormControl fullWidth>
                      <InputLabel>優先度モード</InputLabel>
                      <Select
                        value={priorityMode}
                        onChange={(e) => setPriorityMode(e.target.value as any)}
                      >
                        <MenuItem value="fifo">先入先出 (FIFO)</MenuItem>
                        <MenuItem value="priority">優先度順</MenuItem>
                        <MenuItem value="deadline">納期順</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {priorityMode === 'fifo' && '到着順に搬送します'}
                      {priorityMode === 'priority' && '部品の優先度に基づいて搬送します'}
                      {priorityMode === 'deadline' && '納期が近い順に搬送します'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* 性能計算タブ */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>搬送性能計算</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      搬送時間
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {calculateTransportTime().toFixed(1)}秒
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      搬送コスト
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {calculateTransportCost().toFixed(2)}円
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      時間当たり搬送能力
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {selectedMethod ? Math.floor((3600 / calculateTransportTime()) * selectedMethod.capacity) : 0}個/時
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ mt: 3 }}>
              <CardHeader title="搬送能力詳細" />
              <CardContent>
                {selectedMethod && (
                  <List>
                    <ListItem>
                      <ListItemIcon><Speed /></ListItemIcon>
                      <ListItemText 
                        primary="搬送速度" 
                        secondary={`${selectedMethod.speed}m/分`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Inventory /></ListItemIcon>
                      <ListItemText 
                        primary="最大容量" 
                        secondary={`${selectedMethod.capacity}個`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Timer /></ListItemIcon>
                      <ListItemText 
                        primary="信頼性" 
                        secondary={`${selectedMethod.reliability}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><FlightTakeoff /></ListItemIcon>
                      <ListItemText 
                        primary="エネルギー消費" 
                        secondary={`${selectedMethod.energyConsumption}kWh/km`}
                      />
                    </ListItem>
                  </List>
                )}
              </CardContent>
            </Card>

            <Alert severity="success" sx={{ mt: 2 }}>
              搬送距離{distance}mを{selectedMethod?.name}で搬送する場合、
              {calculateTransportTime().toFixed(1)}秒で完了し、
              コストは{calculateTransportCost().toFixed(2)}円となります。
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!selectedMethod}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransportSettingsDialog;