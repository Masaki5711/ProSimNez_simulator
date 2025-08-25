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
  Typography,
  Box,
  Tabs,
  Tab,
  Grid,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Card,
  CardContent,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Schedule, Inventory, AccessTime, LocalShipping, Add, Delete } from '@mui/icons-material';
import { ProcessNodeData, WorkingHours } from '../../types/networkEditor';
import { StoreScheduleProductionSchedule } from '../../types/productionTypes';

interface StoreScheduleDialogProps {
  open: boolean;
  nodeId: string;
  nodeData: any;
  onClose: () => void;
  onSave: (scheduleData: any) => void;
}

const StoreScheduleDialog: React.FC<StoreScheduleDialogProps> = ({
  open,
  nodeId,
  nodeData,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [schedules, setSchedules] = useState<StoreScheduleProductionSchedule[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState<'finished_product' | 'component' | 'raw_material'>('finished_product');
  const [capacity, setCapacity] = useState(1000);
  const [safetyStock, setSafetyStock] = useState(50);
  const [reorderPoint, setReorderPoint] = useState(100);
  const [autoReplenishment, setAutoReplenishment] = useState(true);

  // 初期化
  useEffect(() => {
    if (nodeData) {
      setStoreName(nodeData.label || '');
      setStoreType(nodeData.storeType || 'finished_product');
      setCapacity(nodeData.capacity || 1000);
      setSafetyStock(nodeData.safetyStock || 50);
      setReorderPoint(nodeData.reorderPoint || 100);
      setAutoReplenishment(nodeData.autoReplenishment !== false);
      
      // 既存のスケジュールデータを読み込み（型変換が必要）
      if (nodeData.productionSchedule) {
        const convertedSchedules: StoreScheduleProductionSchedule[] = nodeData.productionSchedule.map((item: any) => ({
          id: item.id || `schedule_${Date.now()}`,
          productId: item.productId || '',
          productName: item.productName || '',
          targetQuantity: item.quantity || item.targetQuantity || 100,
          startTime: item.startTime || '08:00',
          endTime: item.endTime || '17:00',
          priority: item.priority || 'medium',
          shiftPattern: item.shiftPattern || 'day_shift',
          demandPattern: item.demandPattern || 'constant',
        }));
        setSchedules(convertedSchedules);
      } else {
        setSchedules([]);
      }
      
      // 初期稼働時間設定
      setWorkingHours(nodeData.workingHours || getDefaultWorkingHours());
    }
  }, [nodeData]);

  // デフォルト稼働時間
  const getDefaultWorkingHours = (): WorkingHours[] => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days.map((_, index) => ({
      id: `working-hours-${index}`,
      dayOfWeek: index,
      startTime: '08:00',
      endTime: '17:00',
      breakTimes: [{
        id: `break-${index}-1`,
        name: 'お昼休み',
        startTime: '12:00',
        endTime: '13:00'
      }],
      isWorkingDay: index >= 1 && index <= 5, // 月-金が稼働日
    }));
  };

  // 新しいスケジュール追加
  const addSchedule = () => {
    const newSchedule: StoreScheduleProductionSchedule = {
      id: `schedule_${Date.now()}`,
      productId: '',
      productName: '',
      targetQuantity: 100,
      startTime: '08:00',
      endTime: '17:00',
      priority: 'medium',
      shiftPattern: 'day_shift',
      demandPattern: 'constant',
    };
    setSchedules([...schedules, newSchedule]);
  };

  // スケジュール削除
  const deleteSchedule = (scheduleId: string) => {
    setSchedules(schedules.filter(s => s.id !== scheduleId));
  };

  // スケジュール更新
  const updateSchedule = (scheduleId: string, field: keyof StoreScheduleProductionSchedule, value: any) => {
    setSchedules(schedules.map(s => 
      s.id === scheduleId ? { ...s, [field]: value } : s
    ));
  };

  // 稼働時間更新
  const updateWorkingHours = (dayIndex: number, field: keyof WorkingHours, value: any) => {
    setWorkingHours(workingHours.map((wh, index) => 
      index === dayIndex ? { ...wh, [field]: value } : wh
    ));
  };

  // 休憩時間追加
  const addBreakTime = (dayIndex: number) => {
    const newBreakTimes = [...workingHours[dayIndex].breakTimes, { 
      id: `break-${dayIndex}-${workingHours[dayIndex].breakTimes.length}`,
      name: '休憩',
      startTime: '10:00', 
      endTime: '10:15' 
    }];
    updateWorkingHours(dayIndex, 'breakTimes', newBreakTimes);
  };

  // 休憩時間削除
  const removeBreakTime = (dayIndex: number, breakIndex: number) => {
    const newBreakTimes = workingHours[dayIndex].breakTimes.filter((_, index) => index !== breakIndex);
    updateWorkingHours(dayIndex, 'breakTimes', newBreakTimes);
  };

  // 保存処理
  const handleSave = () => {
    const scheduleData = {
      storeName,
      storeType,
      capacity,
      safetyStock,
      reorderPoint,
      autoReplenishment,
      productionSchedule: schedules.map(schedule => ({
        id: schedule.id,
        productId: schedule.productId,
        productName: schedule.productName,
        quantity: schedule.targetQuantity,
        unit: '個',
        priority: schedule.priority === 'high' ? 1 : schedule.priority === 'medium' ? 2 : 3,
        sequence: 1,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        isActive: true,
      })),
      workingHours,
      // シミュレーションで使用される全体のサイクル設定
      cycleBasedOnStore: true, // ストアのスケジュールをベースにシミュレーション全体を制御
      simulationDuration: calculateTotalWorkingHours(), // 総稼働時間（時間）
    };
    
    onSave(scheduleData);
  };

  // 総稼働時間計算
  const calculateTotalWorkingHours = (): number => {
    return workingHours.reduce((total, wh) => {
      if (!wh.isWorkingDay) return total;
      
      const start = parseTime(wh.startTime);
      const end = parseTime(wh.endTime);
      const workTime = end - start;
      
      const breakTime = wh.breakTimes.reduce((breakTotal, breakTime) => {
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

  // 優先度の色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule color="primary" />
          <Typography variant="h6">ストアスケジュール設定</Typography>
          <Chip label={nodeId} size="small" />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="基本設定" icon={<Inventory />} iconPosition="start" />
            <Tab label="生産スケジュール" icon={<Schedule />} iconPosition="start" />
            <Tab label="稼働時間" icon={<AccessTime />} iconPosition="start" />
            <Tab label="在庫管理" icon={<LocalShipping />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 基本設定タブ */}
        {activeTab === 0 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ストア名"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>ストアタイプ</InputLabel>
                  <Select
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value as any)}
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
                <strong>重要:</strong> このストアのスケジュールがシミュレーション全体の動作サイクルのベースとなります。
                稼働時間と生産計画に基づいて、システム全体の時間が進行します。
              </Typography>
            </Alert>
          </Box>
        )}

        {/* 生産スケジュールタブ */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">生産計画</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={addSchedule}
              >
                計画追加
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>製品名</TableCell>
                    <TableCell>目標数量</TableCell>
                    <TableCell>開始時刻</TableCell>
                    <TableCell>終了時刻</TableCell>
                    <TableCell>優先度</TableCell>
                    <TableCell>需要パターン</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={schedule.productName}
                          onChange={(e) => updateSchedule(schedule.id, 'productName', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={schedule.targetQuantity}
                          onChange={(e) => updateSchedule(schedule.id, 'targetQuantity', Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => updateSchedule(schedule.id, 'startTime', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => updateSchedule(schedule.id, 'endTime', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={schedule.priority}
                          onChange={(e) => updateSchedule(schedule.id, 'priority', e.target.value)}
                        >
                          <MenuItem value="high">高</MenuItem>
                          <MenuItem value="medium">中</MenuItem>
                          <MenuItem value="low">低</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={schedule.demandPattern}
                          onChange={(e) => updateSchedule(schedule.id, 'demandPattern', e.target.value)}
                        >
                          <MenuItem value="constant">一定</MenuItem>
                          <MenuItem value="peak">ピーク</MenuItem>
                          <MenuItem value="seasonal">季節変動</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteSchedule(schedule.id)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {schedules.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                生産計画が設定されていません。「計画追加」ボタンから計画を追加してください。
              </Alert>
            )}
          </Box>
        )}

        {/* 稼働時間タブ */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>週間稼働時間設定</Typography>
            
            {workingHours.map((wh, dayIndex) => (
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
                          {wh.breakTimes.map((breakTime, breakIndex) => (
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
                週間総稼働時間: {calculateTotalWorkingHours().toFixed(1)}時間
              </Typography>
            </Alert>
          </Box>
        )}

        {/* 在庫管理タブ */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>在庫管理設定</Typography>
            
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
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={schedules.length === 0}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoreScheduleDialog;