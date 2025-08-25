import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as PriorityIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';

interface ProductionPlan {
  id: string;
  product_id: string;
  quantity: number;
  due_date: Date;
  priority: number;
  customer_id: string;
  order_type: 'standard' | 'rush' | 'kanban';
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed';
}

interface ProductionPlanDialogProps {
  open: boolean;
  onClose: () => void;
  plan?: ProductionPlan;
  onSave: (plan: ProductionPlan) => void;
}

const ProductionPlanDialog: React.FC<ProductionPlanDialogProps> = ({
  open,
  onClose,
  plan,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<ProductionPlan>>({
    product_id: '',
    quantity: 1,
    due_date: new Date(),
    priority: 1,
    customer_id: '',
    order_type: 'standard'
  });

  const { networkData } = useSelector((state: RootState) => state.project);
  const productList = networkData?.products || [];

  useEffect(() => {
    if (plan) {
      setFormData({
        ...plan,
        due_date: new Date(plan.due_date)
      });
    } else {
      setFormData({
        product_id: '',
        quantity: 1,
        due_date: new Date(),
        priority: 1,
        customer_id: '',
        order_type: 'standard'
      });
    }
  }, [plan]);

  const handleSubmit = () => {
    if (formData.product_id && formData.due_date) {
      const newPlan: ProductionPlan = {
        id: plan?.id || `plan_${Date.now()}`,
        product_id: formData.product_id,
        quantity: formData.quantity || 1,
        due_date: formData.due_date,
        priority: formData.priority || 1,
        customer_id: formData.customer_id || '',
        order_type: formData.order_type || 'standard',
        status: 'pending'
      };
      onSave(newPlan);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {plan ? '生産計画の編集' : '新規生産計画の作成'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>製品</InputLabel>
              <Select
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                label="製品"
              >
                {productList.map((product: any) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="数量"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              InputProps={{
                endAdornment: <InputAdornment position="end">個</InputAdornment>
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
              <DateTimePicker
                label="納期"
                value={formData.due_date}
                onChange={(newValue: Date | null) => setFormData({ ...formData, due_date: newValue || new Date() })}
                slotProps={{
                  textField: { fullWidth: true }
                }}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>優先度</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as number })}
                label="優先度"
              >
                <MenuItem value={1}>最高 (1)</MenuItem>
                <MenuItem value={2}>高 (2)</MenuItem>
                <MenuItem value={3}>中 (3)</MenuItem>
                <MenuItem value={4}>低 (4)</MenuItem>
                <MenuItem value={5}>最低 (5)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="顧客ID"
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>注文タイプ</InputLabel>
              <Select
                value={formData.order_type}
                onChange={(e) => setFormData({ ...formData, order_type: e.target.value as any })}
                label="注文タイプ"
              >
                <MenuItem value="standard">標準</MenuItem>
                <MenuItem value="rush">緊急</MenuItem>
                <MenuItem value="kanban">かんばん</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ProductionPlanManager: React.FC = () => {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | undefined>();
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);

  const { networkData } = useSelector((state: RootState) => state.project);
  const productList = networkData?.products || [];

  // 完成品ストアの検出
  const finishedProductStores = Object.values(networkData?.nodes || {}).filter(
    (node: any) => node.type === 'store' || node.type === 'shipping'
  );

  useEffect(() => {
    // ローカルストレージから生産計画を読み込み
    const savedPlans = localStorage.getItem('productionPlans');
    if (savedPlans) {
      try {
        const parsedPlans = JSON.parse(savedPlans).map((plan: any) => ({
          ...plan,
          due_date: new Date(plan.due_date)
        }));
        setPlans(parsedPlans);
      } catch (error) {
        console.error('生産計画の読み込みエラー:', error);
      }
    }
  }, []);

  const savePlansToStorage = (newPlans: ProductionPlan[]) => {
    localStorage.setItem('productionPlans', JSON.stringify(newPlans));
  };

  const handleSavePlan = (plan: ProductionPlan) => {
    if (editingPlan) {
      // 編集
      const updatedPlans = plans.map(p => p.id === plan.id ? plan : p);
      setPlans(updatedPlans);
      savePlansToStorage(updatedPlans);
    } else {
      // 新規作成
      const newPlans = [...plans, plan];
      setPlans(newPlans);
      savePlansToStorage(newPlans);
    }
    setEditingPlan(undefined);
  };

  const handleEditPlan = (plan: ProductionPlan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleDeletePlan = (planId: string) => {
    const updatedPlans = plans.filter(p => p.id !== planId);
    setPlans(updatedPlans);
    savePlansToStorage(updatedPlans);
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      case 4: return 'default';
      case 5: return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'scheduled': return 'info';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待機中';
      case 'scheduled': return 'スケジュール済み';
      case 'in_progress': return '実行中';
      case 'completed': return '完了';
      default: return status;
    }
  };

    return (
      <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2">
              生産計画管理
        </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                setEditingPlan(undefined);
                setDialogOpen(true);
                }}
              >
              新規計画作成
              </Button>
            </Box>

          {finishedProductStores.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              完成品ストアが設定されていません。ネットワークエディタで完成品ストア（store/shipping）を追加してください。
            </Alert>
          )}

          {plans.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                生産計画がありません。新規計画を作成してください。
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>製品</TableCell>
                    <TableCell align="right">数量</TableCell>
                    <TableCell>納期</TableCell>
                    <TableCell>優先度</TableCell>
                    <TableCell>顧客ID</TableCell>
                    <TableCell>注文タイプ</TableCell>
                    <TableCell>状態</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id} hover>
                      <TableCell>{plan.product_id}</TableCell>
                      <TableCell align="right">{plan.quantity}個</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ScheduleIcon sx={{ mr: 1, fontSize: 'small' }} />
                          {plan.due_date.toLocaleString('ja-JP')}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`優先度 ${plan.priority}`}
                          color={getPriorityColor(plan.priority) as any}
                          size="small"
                          icon={<PriorityIcon />}
                        />
                      </TableCell>
                      <TableCell>{plan.customer_id || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={plan.order_type === 'standard' ? '標準' : 
                                 plan.order_type === 'rush' ? '緊急' : 'かんばん'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(plan.status)}
                          color={getStatusColor(plan.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditPlan(plan)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePlan(plan.id)}
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
          )}
                  </CardContent>
                </Card>

      <ProductionPlanDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingPlan(undefined);
        }}
        plan={editingPlan}
        onSave={handleSavePlan}
      />
    </Box>
  );
};

export default ProductionPlanManager;