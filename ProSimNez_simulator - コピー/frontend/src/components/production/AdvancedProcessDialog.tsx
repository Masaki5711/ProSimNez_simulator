import React, { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Inventory as MaterialIcon,
  Build as ToolIcon,
  Schedule as ScheduleIcon,
  Assignment as QualityIcon,
} from '@mui/icons-material';
import {
  AdvancedProcessData,
  MaterialInput,
  ProductOutput,
  QualityCheckpoint,
  KanbanSettings,
  Product,
} from '../../types/productionTypes';

interface AdvancedProcessDialogProps {
  open: boolean;
  processData: AdvancedProcessData | null;
  products: Product[];
  onClose: () => void;
  onSave: (processData: AdvancedProcessData) => void;
}

const AdvancedProcessDialog: React.FC<AdvancedProcessDialogProps> = ({
  open,
  processData,
  products,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [editData, setEditData] = useState<AdvancedProcessData>({
    id: '',
    label: '',
    type: 'machining',
    cycleTime: 60,
    setupTime: 300,
    equipmentCount: 1,
    operatorCount: 1,
    availability: 85,
    inputMaterials: [],
    outputProducts: [],
    bomMappings: [],
    schedulingMode: 'push',
    batchSize: 1,
    minBatchSize: 1,
    maxBatchSize: 100,
    defectRate: 2,
    reworkRate: 1,
    operatingCost: 100,
    qualityCheckpoints: [],
    skillRequirements: [],
    toolRequirements: [],
    capacityConstraints: [],
    setupHistory: [],
  });

  useEffect(() => {
    if (processData) {
      setEditData(processData);
    }
  }, [processData]);

  const handleSave = () => {
    onSave(editData);
    onClose();
  };

  const handleAddMaterial = () => {
    const newMaterial: MaterialInput = {
      materialId: '',
      materialName: '',
      requiredQuantity: 1,
      unit: '個',
      timing: 'start',
      qualitySpec: {
        parameter: '',
        targetValue: 0,
        upperLimit: 0,
        lowerLimit: 0,
        unit: '',
        measurementMethod: '',
      },
      storageLocation: '',
      supplyMethod: 'manual',
    };
    setEditData({
      ...editData,
      inputMaterials: [...editData.inputMaterials, newMaterial],
    });
  };

  const handleAddOutput = () => {
    const newOutput: ProductOutput = {
      productId: '',
      productName: '',
      outputQuantity: 1,
      unit: '個',
      qualityLevel: 'standard',
    };
    setEditData({
      ...editData,
      outputProducts: [...editData.outputProducts, newOutput],
    });
  };

  const handleAddQualityCheckpoint = () => {
    const newCheckpoint: QualityCheckpoint = {
      id: `qc_${Date.now()}`,
      name: '',
      timing: 'post_process',
      checkType: 'dimensional',
      specification: {
        parameter: '',
        targetValue: 0,
        upperLimit: 0,
        lowerLimit: 0,
        unit: '',
        measurementMethod: '',
      },
      samplingRate: 100,
    };
    setEditData({
      ...editData,
      qualityCheckpoints: [...editData.qualityCheckpoints, newCheckpoint],
    });
  };

  const updateMaterial = (index: number, field: keyof MaterialInput, value: any) => {
    const updated = [...editData.inputMaterials];
    updated[index] = { ...updated[index], [field]: value };
    setEditData({ ...editData, inputMaterials: updated });
  };

  const updateOutput = (index: number, field: keyof ProductOutput, value: any) => {
    const updated = [...editData.outputProducts];
    updated[index] = { ...updated[index], [field]: value };
    setEditData({ ...editData, outputProducts: updated });
  };

  const updateQualityCheckpoint = (index: number, field: keyof QualityCheckpoint, value: any) => {
    const updated = [...editData.qualityCheckpoints];
    updated[index] = { ...updated[index], [field]: value };
    setEditData({ ...editData, qualityCheckpoints: updated });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Typography variant="h6">
          拡張工程設定: {editData.label}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="基本設定" />
          <Tab label="材料・部品" />
          <Tab label="出力製品" />
          <Tab label="スケジューリング" />
          <Tab label="品質管理" />
          <Tab label="リソース" />
        </Tabs>

        {/* 基本設定タブ */}
        {activeTab === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="工程名"
              value={editData.label}
              onChange={(e) => setEditData({ ...editData, label: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>工程タイプ</InputLabel>
              <Select
                value={editData.type}
                onChange={(e) => setEditData({ ...editData, type: e.target.value as any })}
              >
                <MenuItem value="machining">機械加工</MenuItem>
                <MenuItem value="assembly">組立</MenuItem>
                <MenuItem value="inspection">検査</MenuItem>
                <MenuItem value="storage">保管</MenuItem>
                <MenuItem value="shipping">出荷</MenuItem>
                <MenuItem value="kitting">キッティング</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="サイクルタイム（秒）"
              type="number"
              value={editData.cycleTime}
              onChange={(e) => setEditData({ ...editData, cycleTime: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="段取り時間（秒）"
              type="number"
              value={editData.setupTime}
              onChange={(e) => setEditData({ ...editData, setupTime: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="設備台数"
              type="number"
              value={editData.equipmentCount}
              onChange={(e) => setEditData({ ...editData, equipmentCount: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="作業者数"
              type="number"
              value={editData.operatorCount}
              onChange={(e) => setEditData({ ...editData, operatorCount: Number(e.target.value) })}
              fullWidth
            />
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography gutterBottom>可動率: {editData.availability}%</Typography>
              <Slider
                value={editData.availability}
                onChange={(e, value) => setEditData({ ...editData, availability: value as number })}
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' }
                ]}
              />
            </Box>
          </Box>
        )}

        {/* 材料・部品タブ */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">投入材料・部品</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddMaterial}>
                材料追加
              </Button>
            </Box>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>材料名</TableCell>
                    <TableCell>数量</TableCell>
                    <TableCell>単位</TableCell>
                    <TableCell>投入タイミング</TableCell>
                    <TableCell>供給方法</TableCell>
                    <TableCell>アクション</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editData.inputMaterials.map((material, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <FormControl fullWidth>
                          <Select
                            value={material.materialId}
                            onChange={(e) => {
                              const product = products.find(p => p.id === e.target.value);
                              updateMaterial(index, 'materialId', e.target.value);
                              updateMaterial(index, 'materialName', product?.name || '');
                            }}
                          >
                            {products.filter(p => p.type === 'raw_material' || p.type === 'component').map(product => (
                              <MenuItem key={product.id} value={product.id}>
                                {product.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={material.requiredQuantity}
                          onChange={(e) => updateMaterial(index, 'requiredQuantity', Number(e.target.value))}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={material.unit}
                          onChange={(e) => updateMaterial(index, 'unit', e.target.value)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={material.timing}
                            onChange={(e) => updateMaterial(index, 'timing', e.target.value)}
                          >
                            <MenuItem value="start">開始時</MenuItem>
                            <MenuItem value="middle">中間</MenuItem>
                            <MenuItem value="end">終了時</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={material.supplyMethod}
                            onChange={(e) => updateMaterial(index, 'supplyMethod', e.target.value)}
                          >
                            <MenuItem value="manual">手動</MenuItem>
                            <MenuItem value="automated">自動</MenuItem>
                            <MenuItem value="kanban">かんばん</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => {
                            const updated = editData.inputMaterials.filter((_, i) => i !== index);
                            setEditData({ ...editData, inputMaterials: updated });
                          }}
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
          </Box>
        )}

        {/* 出力製品タブ */}
        {activeTab === 2 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">出力製品</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddOutput}>
                出力追加
              </Button>
            </Box>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>製品名</TableCell>
                    <TableCell>出力数量</TableCell>
                    <TableCell>単位</TableCell>
                    <TableCell>品質レベル</TableCell>
                    <TableCell>アクション</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editData.outputProducts.map((output, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <FormControl fullWidth>
                          <Select
                            value={output.productId}
                            onChange={(e) => {
                              const product = products.find(p => p.id === e.target.value);
                              updateOutput(index, 'productId', e.target.value);
                              updateOutput(index, 'productName', product?.name || '');
                            }}
                          >
                            {products.map(product => (
                              <MenuItem key={product.id} value={product.id}>
                                {product.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={output.outputQuantity}
                          onChange={(e) => updateOutput(index, 'outputQuantity', Number(e.target.value))}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={output.unit}
                          onChange={(e) => updateOutput(index, 'unit', e.target.value)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={output.qualityLevel}
                          onChange={(e) => updateOutput(index, 'qualityLevel', e.target.value)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => {
                            const updated = editData.outputProducts.filter((_, i) => i !== index);
                            setEditData({ ...editData, outputProducts: updated });
                          }}
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
          </Box>
        )}

        {/* スケジューリングタブ */}
        {activeTab === 3 && (
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      スケジューリング方式
                    </Typography>
                    <FormControl fullWidth>
                      <InputLabel>方式</InputLabel>
                      <Select
                        value={editData.schedulingMode}
                        onChange={(e) => setEditData({ ...editData, schedulingMode: e.target.value as any })}
                      >
                        <MenuItem value="push">プッシュ型</MenuItem>
                        <MenuItem value="pull">プル型</MenuItem>
                        <MenuItem value="hybrid">ハイブリッド</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Box sx={{ mt: 2 }}>
                      <Typography gutterBottom>バッチサイズ</Typography>
                      <TextField
                        label="標準バッチサイズ"
                        type="number"
                        value={editData.batchSize}
                        onChange={(e) => setEditData({ ...editData, batchSize: Number(e.target.value) })}
                        fullWidth
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        label="最小バッチサイズ"
                        type="number"
                        value={editData.minBatchSize}
                        onChange={(e) => setEditData({ ...editData, minBatchSize: Number(e.target.value) })}
                        fullWidth
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        label="最大バッチサイズ"
                        type="number"
                        value={editData.maxBatchSize}
                        onChange={(e) => setEditData({ ...editData, maxBatchSize: Number(e.target.value) })}
                        fullWidth
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      かんばん設定
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editData.kanbanSettings?.enabled || false}
                          onChange={(e) => setEditData({
                            ...editData,
                            kanbanSettings: {
                              ...editData.kanbanSettings,
                              enabled: e.target.checked,
                              cardCount: 5,
                              reorderPoint: 10,
                              maxInventory: 50,
                              supplierLeadTime: 3,
                              kanbanType: 'production'
                            } as KanbanSettings
                          })}
                        />
                      }
                      label="かんばん方式を有効化"
                    />
                    
                    {editData.kanbanSettings?.enabled && (
                      <Box sx={{ mt: 2 }}>
                        <TextField
                          label="かんばん枚数"
                          type="number"
                          value={editData.kanbanSettings.cardCount}
                          onChange={(e) => setEditData({
                            ...editData,
                            kanbanSettings: {
                              ...editData.kanbanSettings!,
                              cardCount: Number(e.target.value)
                            }
                          })}
                          fullWidth
                          sx={{ mb: 1 }}
                        />
                        <TextField
                          label="発注点"
                          type="number"
                          value={editData.kanbanSettings.reorderPoint}
                          onChange={(e) => setEditData({
                            ...editData,
                            kanbanSettings: {
                              ...editData.kanbanSettings!,
                              reorderPoint: Number(e.target.value)
                            }
                          })}
                          fullWidth
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* 品質管理タブ */}
        {activeTab === 4 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">品質チェックポイント</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddQualityCheckpoint}>
                チェックポイント追加
              </Button>
            </Box>
            
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <TextField
                  label="不良率（%）"
                  type="number"
                  value={editData.defectRate}
                  onChange={(e) => setEditData({ ...editData, defectRate: Number(e.target.value) })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="手直し率（%）"
                  type="number"
                  value={editData.reworkRate}
                  onChange={(e) => setEditData({ ...editData, reworkRate: Number(e.target.value) })}
                  fullWidth
                />
              </Grid>
            </Grid>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>チェック名</TableCell>
                    <TableCell>タイミング</TableCell>
                    <TableCell>チェック種別</TableCell>
                    <TableCell>サンプリング率（%）</TableCell>
                    <TableCell>アクション</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editData.qualityCheckpoints.map((checkpoint, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          value={checkpoint.name}
                          onChange={(e) => updateQualityCheckpoint(index, 'name', e.target.value)}
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={checkpoint.timing}
                            onChange={(e) => updateQualityCheckpoint(index, 'timing', e.target.value)}
                          >
                            <MenuItem value="pre_process">工程前</MenuItem>
                            <MenuItem value="in_process">工程中</MenuItem>
                            <MenuItem value="post_process">工程後</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={checkpoint.checkType}
                            onChange={(e) => updateQualityCheckpoint(index, 'checkType', e.target.value)}
                          >
                            <MenuItem value="dimensional">寸法</MenuItem>
                            <MenuItem value="visual">外観</MenuItem>
                            <MenuItem value="functional">機能</MenuItem>
                            <MenuItem value="material">材質</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={checkpoint.samplingRate}
                          onChange={(e) => updateQualityCheckpoint(index, 'samplingRate', Number(e.target.value))}
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => {
                            const updated = editData.qualityCheckpoints.filter((_, i) => i !== index);
                            setEditData({ ...editData, qualityCheckpoints: updated });
                          }}
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
          </Box>
        )}

        {/* リソースタブ */}
        {activeTab === 5 && (
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      スキル要件
                    </Typography>
                    <TextField
                      label="必要スキル（カンマ区切り）"
                      value={editData.skillRequirements.join(', ')}
                      onChange={(e) => setEditData({
                        ...editData,
                        skillRequirements: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      })}
                      fullWidth
                      multiline
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      工具要件
                    </Typography>
                    <TextField
                      label="必要工具（カンマ区切り）"
                      value={editData.toolRequirements.join(', ')}
                      onChange={(e) => setEditData({
                        ...editData,
                        toolRequirements: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      })}
                      fullWidth
                      multiline
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      運転コスト
                    </Typography>
                    <TextField
                      label="時間あたり運転コスト（円）"
                      type="number"
                      value={editData.operatingCost}
                      onChange={(e) => setEditData({ ...editData, operatingCost: Number(e.target.value) })}
                      fullWidth
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedProcessDialog;