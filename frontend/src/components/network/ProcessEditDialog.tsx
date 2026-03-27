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
  Card,
  CardContent,
  CardHeader,
  Alert,
  SelectChangeEvent,
  Chip,
} from '@mui/material';
import { 
  Build,
  Assessment,
  Settings,
  Inventory as MaterialIcon,
} from '@mui/icons-material';
import { ProcessNodeData } from '../../types/networkEditor';
import { Product } from '../../types/productionTypes';

interface ProcessEditDialogProps {
  open: boolean;
  nodeData: ProcessNodeData | null;
  nodeId?: string;
  nodes?: any[];
  edges?: any[];
  processAdvancedData?: Map<string, any>;
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
  nodeId,
  nodes,
  edges,
  processAdvancedData: processAdvancedDataMap,
  onClose,
  onSave,
  products,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [editData, setEditData] = useState<ProcessNodeData>({
    label: '',
    type: 'machining',
    cycleTime: 60,
    equipmentCount: 1,
    operatorCount: 1,
    defectRate: 2.0,
    reworkRate: 1.0,
    setupTime: 0,
    inputs: [],
    outputs: [],
  });

  // 品質設定
  const [qualitySettings, setQualitySettings] = useState({
    defectRate: 2.0,
    reworkRate: 1.0,
    scrapRate: 0.5,
    inspectionTime: 30,
    inspectionCapacity: 60,
  });


  useEffect(() => {
    if (nodeData) {
      setEditData(nodeData);
      
      // 品質設定の初期化
      setQualitySettings({
        defectRate: nodeData.qualitySettings?.defectRate || 2.0,
        reworkRate: nodeData.qualitySettings?.reworkRate || 1.0,
        scrapRate: nodeData.qualitySettings?.scrapRate || 0.5,
        inspectionTime: nodeData.qualitySettings?.inspectionTime || 30,
        inspectionCapacity: nodeData.qualitySettings?.inspectionCapacity || 60,
      });
    }
  }, [nodeData]);

  const handleChange = (field: keyof ProcessNodeData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    setEditData({ ...editData, [field]: value });
  };

  const handleSelectChange = (field: keyof ProcessNodeData) => (
    event: SelectChangeEvent<string>
  ) => {
    setEditData({ ...editData, [field]: event.target.value });
  };

  const updateQualitySetting = (field: keyof typeof qualitySettings, value: number) => {
    setQualitySettings({ ...qualitySettings, [field]: value });
  };

  const handleSave = () => {
    const savedData: ProcessNodeData = {
      ...editData,
      qualitySettings,
      // 既存のinputs/outputsを保持（ProcessMaterialDialogで設定された情報を維持）
      inputs: nodeData?.inputs || editData.inputs || [],
      outputs: nodeData?.outputs || editData.outputs || [],
    };
    
    console.log('🔍 ProcessEditDialog handleSave - 保存データ:', {
      nodeId: savedData.id,
      savedInputs: savedData.inputs,
      savedOutputs: savedData.outputs,
      originalInputs: nodeData?.inputs,
      originalOutputs: nodeData?.outputs,
      editDataInputs: editData.inputs,
      editDataOutputs: editData.outputs
    });
    
    onSave(savedData);
  };

  const openMaterialDialog = () => {
    // 右クリックメニューの材料設定と同じイベントを発火
    const customEvent = new CustomEvent('openMaterialDialog', {
      detail: { nodeId: nodeId || editData.id, nodeData: editData }
    });
    window.dispatchEvent(customEvent);
    
    // ProcessEditDialogを閉じる
    onClose();
  };


  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Build color="primary" />
          <Typography variant="h6">工程設定</Typography>
          <Chip label={nodeId || editData.label} size="small" />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="基本設定" icon={<Settings />} iconPosition="start" />
            <Tab label="品質管理" icon={<Assessment />} iconPosition="start" />
            <Tab label="材料設定" icon={<MaterialIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 基本設定タブ */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
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
                  <MenuItem value="machining">加工</MenuItem>
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
                label="サイクルタイム（秒）"
                value={editData.cycleTime || 60}
                onChange={handleChange('cycleTime')}
                inputProps={{ min: 1 }}
                helperText="1個あたりの加工時間"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="段取り時間（秒）"
                value={editData.setupTime || 0}
                onChange={handleChange('setupTime')}
                inputProps={{ min: 0 }}
                helperText="品種切替時の段取り替え時間"
              />
            </Grid>
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="入力バッファ容量（個）"
                value={editData.inputBufferCapacity || 100}
                onChange={handleChange('inputBufferCapacity')}
                inputProps={{ min: 1 }}
                helperText="この数を超えると上流からの搬送が停止"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="出力バッファ容量（個）"
                value={editData.outputBufferCapacity || 50}
                onChange={handleChange('outputBufferCapacity')}
                inputProps={{ min: 1 }}
                helperText="この数を超えると工程が停止(ブロック)"
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* 品質管理タブ */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>品質設定</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="不良率"
                value={qualitySettings.defectRate}
                onChange={(e) => updateQualitySetting('defectRate', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="手直し率"
                value={qualitySettings.reworkRate}
                onChange={(e) => updateQualitySetting('reworkRate', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="廃棄率"
                value={qualitySettings.scrapRate}
                onChange={(e) => updateQualitySetting('scrapRate', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="検査時間"
                value={qualitySettings.inspectionTime}
                onChange={(e) => updateQualitySetting('inspectionTime', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="検査能力"
                value={qualitySettings.inspectionCapacity}
                onChange={(e) => updateQualitySetting('inspectionCapacity', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">個/時</InputAdornment>,
                }}
                inputProps={{ min: 1 }}
              />
            </Grid>
          </Grid>

          {/* 品質統計表示 */}
          <Alert severity="info" sx={{ mt: 3 }}>
            良品率: {(100 - qualitySettings.defectRate - qualitySettings.reworkRate - qualitySettings.scrapRate).toFixed(1)}%
          </Alert>
        </TabPanel>

        {/* 材料設定タブ */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <MaterialIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              投入材料・出力製品設定
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              この工程で使用する材料・部品と出力製品を設定します。
            </Typography>
            <Button
              variant="contained"
              startIcon={<MaterialIcon />}
              onClick={openMaterialDialog}
            >
              材料設定を開く
            </Button>
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcessEditDialog;