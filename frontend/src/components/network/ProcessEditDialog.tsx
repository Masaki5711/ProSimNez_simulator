import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Tabs,
  Tab,
  Box,
  Typography,
  Slider,
  SelectChangeEvent,
} from '@mui/material';
import { 
  Inventory as MaterialIcon,
  Settings as AdvancedIcon,
} from '@mui/icons-material';
import { ProcessNodeData, FrequencyTask } from '../../types/networkEditor';
import { Product, AdvancedProcessData } from '../../types/productionTypes';
import ProcessMaterialDialog from '../production/ProcessMaterialDialog';
import AdvancedProcessDialog from '../production/AdvancedProcessDialog';

interface ProcessEditDialogProps {
  open: boolean;
  nodeData: ProcessNodeData | null;
  onClose: () => void;
  onSave: (data: ProcessNodeData) => void;
  products?: Product[];
}

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

const ProcessEditDialog: React.FC<ProcessEditDialogProps> = ({
  open,
  nodeData,
  onClose,
  onSave,
  products = [],
}) => {
  console.log('ProcessEditDialog: Rendered with open =', open, 'and nodeData =', nodeData);
  const [tabValue, setTabValue] = useState(0);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
  const [processData, setProcessData] = useState<AdvancedProcessData | null>(null);
  const [editData, setEditData] = useState<ProcessNodeData>({
    label: '',
    name: '',
    type: 'machining',
    cycleTime: 60,
    setupTime: 300,
    equipmentCount: 1,
    operatorCount: 1,
    availability: 85,
    inputBufferCapacity: 50,
    outputBufferCapacity: 50,
    defectRate: 2,
    reworkRate: 1,
    operatingCost: 100,
    inputs: [],
    outputs: [],
    frequencyTasks: [],
  });

  useEffect(() => {
    if (nodeData) {
      setEditData(nodeData);
    }
  }, [nodeData]);

  const handleChange = (field: keyof ProcessNodeData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    // 数値フィールドの場合は数値に変換
    const numericFields = [
      'cycleTime', 'setupTime', 'equipmentCount', 'operatorCount', 'availability',
      'inputBufferCapacity', 'outputBufferCapacity', 'defectRate', 'reworkRate', 'operatingCost'
    ];
    
    let processedValue: any = value;
    
    if (numericFields.includes(field)) {
      const numValue = Number(value) || 0;
      // 数値の範囲チェック
      if (field === 'availability' || field === 'defectRate' || field === 'reworkRate') {
        // パーセンテージフィールドは0-100の範囲
        processedValue = Math.max(0, Math.min(100, numValue));
      } else if (field === 'equipmentCount' || field === 'operatorCount') {
        // 台数・人数は0以上の整数
        processedValue = Math.max(0, Math.floor(numValue));
      } else {
        // その他の数値フィールドは0以上
        processedValue = Math.max(0, numValue);
      }
    }
    
    setEditData({
      ...editData,
      [field]: processedValue,
    });
  };

  const handleSelectChange = (field: keyof ProcessNodeData) => (
    event: SelectChangeEvent
  ) => {
    setEditData({
      ...editData,
      [field]: event.target.value,
    });
  };

  const handleSliderChange = (field: keyof ProcessNodeData) => (
    _: Event,
    value: number | number[]
  ) => {
    setEditData({
      ...editData,
      [field]: value as number,
    });
  };

  const handleSave = () => {
    onSave(editData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>工程パラメータ編集</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="基本設定" />
          <Tab label="リソース" />
          <Tab label="品質・コスト" />
          <Tab 
            label="材料設定" 
            icon={<MaterialIcon />}
            iconPosition="start"
          />
          <Tab 
            label="拡張設定" 
            icon={<AdvancedIcon />}
            iconPosition="start"
          />
          <Tab label="頻度作業" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="工程名"
                value={editData.label}
                onChange={handleChange('label')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>工程タイプ</InputLabel>
                <Select
                  value={editData.type}
                  onChange={handleSelectChange('type')}
                  label="工程タイプ"
                >
                  <MenuItem value="machining">機械加工</MenuItem>
                  <MenuItem value="assembly">組立</MenuItem>
                  <MenuItem value="inspection">検査</MenuItem>
                  <MenuItem value="storage">保管</MenuItem>
                  <MenuItem value="shipping">出荷</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="サイクルタイム"
                value={editData.cycleTime}
                onChange={handleChange('cycleTime')}
                InputProps={{
                  endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="段取り時間"
                value={editData.setupTime}
                onChange={handleChange('setupTime')}
                InputProps={{
                  endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="設備台数"
                value={editData.equipmentCount}
                onChange={handleChange('equipmentCount')}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="作業者数"
                value={editData.operatorCount}
                onChange={handleChange('operatorCount')}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>可動率: {editData.availability}%</Typography>
              <Slider
                value={editData.availability}
                onChange={handleSliderChange('availability')}
                min={0}
                max={100}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 50, label: '50%' },
                  { value: 85, label: '85%' },
                  { value: 100, label: '100%' },
                ]}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="入力バッファ容量"
                value={editData.inputBufferCapacity}
                onChange={handleChange('inputBufferCapacity')}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="出力バッファ容量"
                value={editData.outputBufferCapacity}
                onChange={handleChange('outputBufferCapacity')}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography gutterBottom>不良率: {editData.defectRate}%</Typography>
              <Slider
                value={editData.defectRate}
                onChange={handleSliderChange('defectRate')}
                min={0}
                max={10}
                step={0.1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 2, label: '2%' },
                  { value: 5, label: '5%' },
                  { value: 10, label: '10%' },
                ]}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>手直し率: {editData.reworkRate}%</Typography>
              <Slider
                value={editData.reworkRate}
                onChange={handleSliderChange('reworkRate')}
                min={0}
                max={5}
                step={0.1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 1, label: '1%' },
                  { value: 2.5, label: '2.5%' },
                  { value: 5, label: '5%' },
                ]}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="時間あたり運転コスト"
                value={editData.operatingCost}
                onChange={handleChange('operatingCost')}
                InputProps={{
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/時間</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* 材料設定タブ */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <MaterialIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              工程材料設定
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              この工程で使用する材料・部品と出力製品を設定します
            </Typography>
            <Button
              variant="contained"
              startIcon={<MaterialIcon />}
              onClick={() => {
                if (editData) {
                  // editDataからAdvancedProcessDataを作成
                  const advancedData: AdvancedProcessData = {
                    id: editData.label || 'process',
                    label: editData.label,
                    type: editData.type,
                    cycleTime: editData.cycleTime,
                    setupTime: editData.setupTime,
                    equipmentCount: editData.equipmentCount,
                    operatorCount: editData.operatorCount,
                    availability: editData.availability,
                    inputMaterials: [],
                    outputProducts: [],
                    bomMappings: [],
                    schedulingMode: 'push',
                    batchSize: 1,
                    minBatchSize: 1,
                    maxBatchSize: 100,
                    defectRate: editData.defectRate,
                    reworkRate: editData.reworkRate,
                    operatingCost: editData.operatingCost,
                    qualityCheckpoints: [],
                    skillRequirements: [],
                    toolRequirements: [],
                    capacityConstraints: [],
                    setupHistory: [],
                  };
                  setProcessData(advancedData);
                  setMaterialDialogOpen(true);
                }
              }}
            >
              材料設定を開く
            </Button>
          </Box>
        </TabPanel>

        {/* 拡張設定タブ */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AdvancedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              拡張工程設定
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              スケジューリング、品質管理、技能要件などの詳細設定を行います
            </Typography>
            <Button
              variant="contained"
              startIcon={<AdvancedIcon />}
              onClick={() => {
                if (editData) {
                  // editDataからAdvancedProcessDataを作成
                  const advancedData: AdvancedProcessData = {
                    id: editData.label || 'process',
                    label: editData.label,
                    type: editData.type,
                    cycleTime: editData.cycleTime,
                    setupTime: editData.setupTime,
                    equipmentCount: editData.equipmentCount,
                    operatorCount: editData.operatorCount,
                    availability: editData.availability,
                    inputMaterials: [],
                    outputProducts: [],
                    bomMappings: [],
                    schedulingMode: 'push',
                    batchSize: 1,
                    minBatchSize: 1,
                    maxBatchSize: 100,
                    defectRate: editData.defectRate,
                    reworkRate: editData.reworkRate,
                    operatingCost: editData.operatingCost,
                    qualityCheckpoints: [],
                    skillRequirements: [],
                    toolRequirements: [],
                    capacityConstraints: [],
                    setupHistory: [],
                  };
                  setProcessData(advancedData);
                  setAdvancedDialogOpen(true);
                }
              }}
            >
              拡張設定を開く
            </Button>
          </Box>
        </TabPanel>

        {/* 頻度作業タブ */}
        <TabPanel value={tabValue} index={5}>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              頻度作業の設定（定期・確率）
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(editData.frequencyTasks || []).map((task, idx) => (
                <Grid container spacing={2} key={task.id} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="作業名"
                      value={task.name}
                      onChange={(e) => {
                        const copy = [...(editData.frequencyTasks || [])];
                        copy[idx] = { ...task, name: e.target.value };
                        setEditData({ ...editData, frequencyTasks: copy });
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>タイプ</InputLabel>
                      <Select
                        label="タイプ"
                        value={task.taskType}
                        onChange={(e) => {
                          const copy = [...(editData.frequencyTasks || [])];
                          const newType = e.target.value as FrequencyTask['taskType'];
                          copy[idx] = { ...task, taskType: newType };
                          setEditData({ ...editData, frequencyTasks: copy });
                        }}
                      >
                        <MenuItem value="interval">定期（間隔）</MenuItem>
                        <MenuItem value="probabilistic">確率</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {task.taskType === 'interval' && (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        type="number"
                        label="発生間隔（秒）"
                        value={task.intervalSeconds || 0}
                        onChange={(e) => {
                          const copy = [...(editData.frequencyTasks || [])];
                          copy[idx] = { ...task, intervalSeconds: Math.max(0, Number(e.target.value) || 0) };
                          setEditData({ ...editData, frequencyTasks: copy });
                        }}
                      />
                    </Grid>
                  )}
                  {task.taskType === 'probabilistic' && (
                    <>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          type="number"
                          label="チェック周期（秒）"
                          value={task.checkIntervalSeconds || 60}
                          onChange={(e) => {
                            const copy = [...(editData.frequencyTasks || [])];
                            copy[idx] = { ...task, checkIntervalSeconds: Math.max(1, Number(e.target.value) || 1) };
                            setEditData({ ...editData, frequencyTasks: copy });
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          type="number"
                          label="発生確率（0-1）"
                          value={task.probability ?? 0.1}
                          inputProps={{ step: 0.01, min: 0, max: 1 }}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(1, Number(e.target.value)));
                            const copy = [...(editData.frequencyTasks || [])];
                            copy[idx] = { ...task, probability: isNaN(val) ? 0 : val };
                            setEditData({ ...editData, frequencyTasks: copy });
                          }}
                        />
                      </Grid>
                    </>
                  )}
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="所要時間（秒）"
                      value={task.durationSeconds}
                      onChange={(e) => {
                        const copy = [...(editData.frequencyTasks || [])];
                        copy[idx] = { ...task, durationSeconds: Math.max(0, Number(e.target.value) || 0) };
                        setEditData({ ...editData, frequencyTasks: copy });
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>停止要否</InputLabel>
                      <Select
                        label="停止要否"
                        value={task.requiresStop ? 'yes' : 'no'}
                        onChange={(e) => {
                          const copy = [...(editData.frequencyTasks || [])];
                          copy[idx] = { ...task, requiresStop: e.target.value === 'yes' };
                          setEditData({ ...editData, frequencyTasks: copy });
                        }}
                      >
                        <MenuItem value="no">不要</MenuItem>
                        <MenuItem value="yes">必要</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={12}>
                    <Button color="error" onClick={() => {
                      const copy = [...(editData.frequencyTasks || [])];
                      copy.splice(idx, 1);
                      setEditData({ ...editData, frequencyTasks: copy });
                    }}>削除</Button>
                  </Grid>
                </Grid>
              ))}
              <Box>
                <Button variant="outlined" onClick={() => {
                  const newTask: FrequencyTask = {
                    id: Date.now().toString(),
                    name: '頻度作業',
                    taskType: 'interval',
                    intervalSeconds: 3600,
                    durationSeconds: 60,
                    requiresStop: false,
                  };
                  setEditData({ ...editData, frequencyTasks: [...(editData.frequencyTasks || []), newTask] });
                }}>+ 追加</Button>
              </Box>
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>

      {/* 材料設定ダイアログ */}
      <ProcessMaterialDialog
        open={materialDialogOpen}
        processData={processData}
        products={products}
        onClose={() => {
          setMaterialDialogOpen(false);
          setProcessData(null);
        }}
        onSave={(processData) => {
          console.log('Process material data saved:', processData);
          setMaterialDialogOpen(false);
          setProcessData(null);
        }}
      />

      {/* 拡張設定ダイアログ */}
      <AdvancedProcessDialog
        open={advancedDialogOpen}
        processData={processData}
        products={products}
        onClose={() => {
          setAdvancedDialogOpen(false);
          setProcessData(null);
        }}
        onSave={(processData) => {
          console.log('Advanced process data saved:', processData);
          setAdvancedDialogOpen(false);
          setProcessData(null);
        }}
      />
    </Dialog>
  );
};

export default ProcessEditDialog;