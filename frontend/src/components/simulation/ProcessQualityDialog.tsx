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
  Divider,
  IconButton,
  Slider,
} from '@mui/material';
import {
  Build,
  Delete,
  Add,
  Warning,
  CheckCircle,
  Error,
  LocalShipping,
  CallSplit,
  Speed,
  Assessment,
  Settings,
} from '@mui/icons-material';
import {
  QualitySettings,
  OutputBranch,
  SchedulingSettings,
  ProductSetting,
} from '../../types/networkEditor';

interface ProcessQualityDialogProps {
  open: boolean;
  nodeId: string;
  nodeData: any;
  onClose: () => void;
  onSave: (qualityData: any) => void;
}

const ProcessQualityDialog: React.FC<ProcessQualityDialogProps> = ({
  open,
  nodeId,
  nodeData,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [processName, setProcessName] = useState('');
  const [processType, setProcessType] = useState<'machining' | 'assembly' | 'inspection' | 'transport'>('machining');
  
  // 品質設定
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>({
    defectRate: 2.0,
    reworkRate: 1.0,
    scrapRate: 0.5,
    inspectionTime: 30,
    inspectionCapacity: 60,
  });

  // 出力分岐設定
  const [outputBranches, setOutputBranches] = useState<OutputBranch[]>([]);

  // スケジューリング設定
  const [schedulingSettings, setSchedulingSettings] = useState<SchedulingSettings>({
    mode: 'push',
    batchSize: 10,
    leadTime: 300,
    kanbanCards: 5,
    pushThreshold: 80,
    pullSignal: 'buffer_below_threshold',
  });

  // 基本工程パラメータ
  const [cycleTime, setCycleTime] = useState(60);
  const [setupTime, setSetupTime] = useState(300);
  const [equipmentCount, setEquipmentCount] = useState(1);
  const [operatorCount, setOperatorCount] = useState(1);

  // 初期化
  useEffect(() => {
    if (nodeData) {
      setProcessName(nodeData.label || '');
      setProcessType(nodeData.type || 'machining');
      setCycleTime(nodeData.cycleTime || 60);
      setSetupTime(nodeData.setupTime || 300);
      setEquipmentCount(nodeData.equipmentCount || 1);
      setOperatorCount(nodeData.operatorCount || 1);
      
      // 品質設定
      setQualitySettings({
        defectRate: nodeData.defectRate || 2.0,
        reworkRate: nodeData.reworkRate || 1.0,
        scrapRate: nodeData.scrapRate || 0.5,
        inspectionTime: nodeData.inspectionTime || 30,
        inspectionCapacity: nodeData.inspectionCapacity || 60,
      });

      // 出力分岐設定
      setOutputBranches(nodeData.outputBranches || getDefaultOutputBranches());

      // スケジューリング設定
      setSchedulingSettings({
        mode: nodeData.schedulingMode || 'push',
        batchSize: nodeData.batchSize || 10,
        leadTime: nodeData.leadTime || 300,
        kanbanCards: nodeData.kanbanCards || 5,
        pushThreshold: nodeData.pushThreshold || 80,
        pullSignal: nodeData.pullSignal || 'buffer_below_threshold',
      });
    }
  }, [nodeData]);

  // デフォルト出力分岐
  const getDefaultOutputBranches = (): OutputBranch[] => {
    return [
      {
        id: 'good_output',
        name: '良品出力',
        type: 'good',
        percentage: 96.5,
        targetNodeId: '',
        condition: 'quality_pass',
        priority: 1,
      },
      {
        id: 'defective_output',
        name: '不良品出力',
        type: 'defective',
        percentage: 2.0,
        targetNodeId: '',
        condition: 'quality_fail',
        priority: 2,
      },
      {
        id: 'rework_output',
        name: '手直し出力',
        type: 'rework',
        percentage: 1.0,
        targetNodeId: '',
        condition: 'rework_required',
        priority: 3,
      },
      {
        id: 'scrap_output',
        name: '廃棄出力',
        type: 'scrap',
        percentage: 0.5,
        targetNodeId: '',
        condition: 'scrap_required',
        priority: 4,
      },
    ];
  };

  // 分岐追加
  const addOutputBranch = () => {
    const newBranch: OutputBranch = {
      id: `branch_${Date.now()}`,
      name: '新規分岐',
      type: 'good',
      percentage: 0,
      targetNodeId: '',
      condition: 'custom',
      priority: outputBranches.length + 1,
    };
    setOutputBranches([...outputBranches, newBranch]);
  };

  // 分岐削除
  const deleteOutputBranch = (branchId: string) => {
    setOutputBranches(outputBranches.filter(b => b.id !== branchId));
  };

  // 分岐更新
  const updateOutputBranch = (branchId: string, field: keyof OutputBranch, value: any) => {
    setOutputBranches(outputBranches.map(b => 
      b.id === branchId ? { ...b, [field]: value } : b
    ));
  };

  // 品質設定更新
  const updateQualitySettings = (field: keyof QualitySettings, value: number) => {
    setQualitySettings({ ...qualitySettings, [field]: value });
    
    // 自動で分岐比率を更新
    updateOutputBranch('defective_output', 'percentage', value);
    if (field === 'reworkRate') {
      updateOutputBranch('rework_output', 'percentage', value);
    }
    if (field === 'scrapRate') {
      updateOutputBranch('scrap_output', 'percentage', value);
    }
  };

  // 分岐比率の検証
  const validateBranchPercentages = (): boolean => {
    const total = outputBranches.reduce((sum, branch) => sum + branch.percentage, 0);
    return Math.abs(total - 100) < 0.1;
  };

  // 正規化
  const normalizeBranchPercentages = () => {
    const total = outputBranches.reduce((sum, branch) => sum + branch.percentage, 0);
    if (total > 0) {
      setOutputBranches(outputBranches.map(branch => ({
        ...branch,
        percentage: (branch.percentage / total) * 100,
      })));
    }
  };

  // スケジューリング設定更新
  const updateSchedulingSettings = (field: keyof SchedulingSettings, value: any) => {
    setSchedulingSettings({ ...schedulingSettings, [field]: value });
  };

  // 保存処理
  const handleSave = () => {
    const qualityData = {
      processName,
      processType,
      cycleTime,
      setupTime,
      equipmentCount,
      operatorCount,
      
      // 品質・不良率設定
      ...qualitySettings,
      
      // 出力分岐設定
      outputBranches,
      
      // スケジューリング設定
      schedulingMode: schedulingSettings.mode,
      batchSize: schedulingSettings.batchSize,
      leadTime: schedulingSettings.leadTime,
      kanbanCards: schedulingSettings.kanbanCards,
      pushThreshold: schedulingSettings.pushThreshold,
      pullSignal: schedulingSettings.pullSignal,
      
      // 追加のシミュレーション設定
      enableQualityControl: true,
      enableBranchOutput: outputBranches.length > 1,
      enableSchedulingControl: true,
    };
    
    onSave(qualityData);
  };

  // 分岐タイプの色
  const getBranchTypeColor = (type: string) => {
    switch (type) {
      case 'good': return 'success';
      case 'defective': return 'error';
      case 'rework': return 'warning';
      case 'scrap': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Build color="primary" />
          <Typography variant="h6">工程品質・分岐設定</Typography>
          <Chip label={nodeId} size="small" />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="基本設定" icon={<Settings />} iconPosition="start" />
            <Tab label="品質管理" icon={<Assessment />} iconPosition="start" />
            <Tab label="出力分岐" icon={<CallSplit />} iconPosition="start" />
            <Tab label="生産制御" icon={<Speed />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 基本設定タブ */}
        {activeTab === 0 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="工程名"
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>工程タイプ</InputLabel>
                  <Select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value as any)}
                  >
                    <MenuItem value="machining">加工</MenuItem>
                    <MenuItem value="assembly">組立</MenuItem>
                    <MenuItem value="inspection">検査</MenuItem>
                    <MenuItem value="transport">搬送</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="サイクルタイム (秒)"
                  type="number"
                  value={cycleTime}
                  onChange={(e) => setCycleTime(Number(e.target.value))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="段取り時間 (秒)"
                  type="number"
                  value={setupTime}
                  onChange={(e) => setSetupTime(Number(e.target.value))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="設備台数"
                  type="number"
                  value={equipmentCount}
                  onChange={(e) => setEquipmentCount(Number(e.target.value))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="作業者数"
                  type="number"
                  value={operatorCount}
                  onChange={(e) => setOperatorCount(Number(e.target.value))}
                />
              </Grid>
            </Grid>

            <Card sx={{ mt: 3 }}>
              <CardHeader title="工程能力計算" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      理論生産能力
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {Math.round((3600 / cycleTime) * equipmentCount)} 個/時
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      段取り時間比率
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      {((setupTime / (setupTime + cycleTime)) * 100).toFixed(1)}%
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* 品質管理タブ */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>品質管理設定</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="不良率設定" avatar={<Error color="error" />} />
                  <CardContent>
                    <Box sx={{ mb: 3 }}>
                      <Typography gutterBottom>不良率: {qualitySettings.defectRate}%</Typography>
                      <Slider
                        value={qualitySettings.defectRate}
                        onChange={(e, value) => updateQualitySettings('defectRate', value as number)}
                        min={0}
                        max={10}
                        step={0.1}
                        valueLabelDisplay="auto"
                        marks={[
                          { value: 0, label: '0%' },
                          { value: 2, label: '2%' },
                          { value: 5, label: '5%' },
                          { value: 10, label: '10%' },
                        ]}
                      />
                    </Box>
                    
                    <Box sx={{ mb: 3 }}>
                      <Typography gutterBottom>手直し率: {qualitySettings.reworkRate}%</Typography>
                      <Slider
                        value={qualitySettings.reworkRate}
                        onChange={(e, value) => updateQualitySettings('reworkRate', value as number)}
                        min={0}
                        max={5}
                        step={0.1}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    
                    <Box>
                      <Typography gutterBottom>廃棄率: {qualitySettings.scrapRate}%</Typography>
                      <Slider
                        value={qualitySettings.scrapRate}
                        onChange={(e, value) => updateQualitySettings('scrapRate', value as number)}
                        min={0}
                        max={2}
                        step={0.1}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="検査設定" avatar={<CheckCircle color="success" />} />
                  <CardContent>
                    <TextField
                      fullWidth
                      label="検査時間 (秒)"
                      type="number"
                      value={qualitySettings.inspectionTime}
                      onChange={(e) => updateQualitySettings('inspectionTime', Number(e.target.value))}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="検査能力 (個/時)"
                      type="number"
                      value={qualitySettings.inspectionCapacity}
                      onChange={(e) => updateQualitySettings('inspectionCapacity', Number(e.target.value))}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2 }}>
              品質設定は自動的に出力分岐の比率に反映されます。良品率は{(100 - qualitySettings.defectRate - qualitySettings.reworkRate - qualitySettings.scrapRate).toFixed(1)}%になります。
            </Alert>
          </Box>
        )}

        {/* 出力分岐タブ */}
        {activeTab === 2 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">出力分岐設定</Typography>
              <Box>
                <Button
                  variant="outlined"
                  onClick={normalizeBranchPercentages}
                  sx={{ mr: 1 }}
                >
                  正規化
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={addOutputBranch}
                >
                  分岐追加
                </Button>
              </Box>
            </Box>

            {!validateBranchPercentages() && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                分岐比率の合計が100%になっていません。正規化ボタンで調整してください。
              </Alert>
            )}

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>分岐名</TableCell>
                    <TableCell>タイプ</TableCell>
                    <TableCell>比率 (%)</TableCell>
                    <TableCell>出力先ノード</TableCell>
                    <TableCell>条件</TableCell>
                    <TableCell>優先度</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outputBranches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={branch.name}
                          onChange={(e) => updateOutputBranch(branch.id, 'name', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={branch.type}
                          onChange={(e) => updateOutputBranch(branch.id, 'type', e.target.value)}
                        >
                          <MenuItem value="good">良品</MenuItem>
                          <MenuItem value="defective">不良品</MenuItem>
                          <MenuItem value="rework">手直し</MenuItem>
                          <MenuItem value="scrap">廃棄</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={branch.percentage}
                          onChange={(e) => updateOutputBranch(branch.id, 'percentage', Number(e.target.value))}
                          inputProps={{ min: 0, max: 100, step: 0.1 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={branch.targetNodeId}
                          onChange={(e) => updateOutputBranch(branch.id, 'targetNodeId', e.target.value)}
                          placeholder="ノードID"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={branch.condition}
                          onChange={(e) => updateOutputBranch(branch.id, 'condition', e.target.value)}
                        >
                          <MenuItem value="quality_pass">品質合格</MenuItem>
                          <MenuItem value="quality_fail">品質不合格</MenuItem>
                          <MenuItem value="rework_required">手直し必要</MenuItem>
                          <MenuItem value="scrap_required">廃棄必要</MenuItem>
                          <MenuItem value="custom">カスタム</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={branch.priority}
                          onChange={(e) => updateOutputBranch(branch.id, 'priority', Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteOutputBranch(branch.id)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* 分岐比率の可視化 */}
            <Card sx={{ mt: 2 }}>
              <CardHeader title="分岐比率の可視化" />
              <CardContent>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {outputBranches.map((branch) => (
                    <Chip
                      key={branch.id}
                      label={`${branch.name}: ${branch.percentage.toFixed(1)}%`}
                      color={getBranchTypeColor(branch.type) as any}
                      sx={{ minWidth: 120 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* 生産制御タブ */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>生産制御設定</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="スケジューリング方式" avatar={<Speed color="primary" />} />
                  <CardContent>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>制御方式</InputLabel>
                      <Select
                        value={schedulingSettings.mode}
                        onChange={(e) => updateSchedulingSettings('mode', e.target.value)}
                      >
                        <MenuItem value="push">プッシュ方式</MenuItem>
                        <MenuItem value="pull">プル方式</MenuItem>
                        <MenuItem value="kanban">かんばん方式</MenuItem>
                      </Select>
                    </FormControl>

                    {schedulingSettings.mode === 'push' && (
                      <TextField
                        fullWidth
                        label="プッシュ閾値 (%)"
                        type="number"
                        value={schedulingSettings.pushThreshold}
                        onChange={(e) => updateSchedulingSettings('pushThreshold', Number(e.target.value))}
                        helperText="後工程バッファ容量の%以下で生産開始"
                      />
                    )}

                    {schedulingSettings.mode === 'pull' && (
                      <FormControl fullWidth>
                        <InputLabel>プルシグナル</InputLabel>
                        <Select
                          value={schedulingSettings.pullSignal}
                          onChange={(e) => updateSchedulingSettings('pullSignal', e.target.value)}
                        >
                          <MenuItem value="buffer_below_threshold">バッファ閾値以下</MenuItem>
                          <MenuItem value="customer_order">顧客注文</MenuItem>
                          <MenuItem value="downstream_request">後工程要求</MenuItem>
                        </Select>
                      </FormControl>
                    )}

                    {schedulingSettings.mode === 'kanban' && (
                      <TextField
                        fullWidth
                        label="かんばん枚数"
                        type="number"
                        value={schedulingSettings.kanbanCards}
                        onChange={(e) => updateSchedulingSettings('kanbanCards', Number(e.target.value))}
                        helperText="循環するかんばんの総数"
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="ロット・リードタイム" avatar={<LocalShipping color="info" />} />
                  <CardContent>
                    <TextField
                      fullWidth
                      label="ロットサイズ"
                      type="number"
                      value={schedulingSettings.batchSize}
                      onChange={(e) => updateSchedulingSettings('batchSize', Number(e.target.value))}
                      sx={{ mb: 2 }}
                      helperText="一度に処理する個数"
                    />
                    <TextField
                      fullWidth
                      label="リードタイム (秒)"
                      type="number"
                      value={schedulingSettings.leadTime}
                      onChange={(e) => updateSchedulingSettings('leadTime', Number(e.target.value))}
                      helperText="工程完了から次工程開始までの時間"
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>{schedulingSettings.mode === 'push' ? 'プッシュ方式' : 
                        schedulingSettings.mode === 'pull' ? 'プル方式' : 'かんばん方式'}</strong>が選択されています。
                この設定により、前工程との投入材料のスケジューリングが制御されます。
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!validateBranchPercentages()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcessQualityDialog;