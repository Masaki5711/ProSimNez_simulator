import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Badge,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  LocalShipping,
  CheckCircle,
  Warning,
  Error,
  Info,
  Refresh,
  FilterList,
  Sort,
  Timeline,
  Speed,
  DirectionsCar,
  Schedule,
} from '@mui/icons-material';

interface TransportTask {
  id: string;
  source: string;
  target: string;
  productName: string;
  quantity: number;
  status: 'waiting' | 'in_transit' | 'completed' | 'error' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startTime: string;
  estimatedEndTime: string;
  actualEndTime?: string;
  transportTime: number; // 分
  distance: number; // km
  vehicleId: string;
  driverId: string;
  notes?: string;
}

interface TransportMonitorProps {
  edgeId: string | null;
  edgeInfo?: any;
  realtimeData?: any;
}

const TransportMonitor: React.FC<TransportMonitorProps> = ({ 
  edgeId, 
  edgeInfo,
  realtimeData 
}) => {
  const [transportTasks, setTransportTasks] = useState<TransportTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof TransportTask>('startTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // サンプルデータの生成（実際のAPIから取得する場合は削除）
  const generateSampleData = (edgeId: string): TransportTask[] => {
    const now = new Date();
    const tasks: TransportTask[] = [];
    
    const statuses: TransportTask['status'][] = ['waiting', 'in_transit', 'completed', 'error'];
    const priorities: TransportTask['priority'][] = ['low', 'medium', 'high', 'urgent'];
    const products = ['製品A', '製品B', '製品C', '部品X', '部品Y'];
    
    for (let i = 0; i < 25; i++) {
      const startTime = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      const transportTime = Math.round(30 + Math.random() * 120); // 30-150分
      const estimatedEndTime = new Date(startTime.getTime() + transportTime * 60 * 1000);
      
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const actualEndTime = status === 'completed' ? 
        new Date(startTime.getTime() + (transportTime + Math.random() * 30) * 60 * 1000) : 
        undefined;
      
      tasks.push({
        id: `TASK_${edgeId}_${i + 1}`,
        source: `工程${Math.floor(Math.random() * 10) + 1}`,
        target: `工程${Math.floor(Math.random() * 10) + 1}`,
        productName: products[Math.floor(Math.random() * products.length)],
        quantity: Math.round(10 + Math.random() * 90),
        status,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        startTime: startTime.toISOString(),
        estimatedEndTime: estimatedEndTime.toISOString(),
        actualEndTime: actualEndTime?.toISOString(),
        transportTime,
        distance: Math.round(1 + Math.random() * 20),
        vehicleId: `車両${Math.floor(Math.random() * 5) + 1}`,
        driverId: `運転手${Math.floor(Math.random() * 5) + 1}`,
        notes: Math.random() > 0.7 ? '特記事項あり' : undefined,
      });
    }
    
    return tasks;
  };

  // データ取得処理
  useEffect(() => {
    if (!edgeId) {
      setTransportTasks([]);
      return;
    }

    setLoading(true);
    setError(null);

    // 実際のAPIからデータを取得する場合はここで実装
    // 現在はサンプルデータを使用
    try {
      const sampleData = generateSampleData(edgeId);
      setTransportTasks(sampleData);
    } catch (err: any) {
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [edgeId]);

  // リアルタイムデータの更新
  useEffect(() => {
    if (edgeId && realtimeData?.edges?.[edgeId]) {
      const edgeData = realtimeData.edges[edgeId];
      
      // 既存のタスクを更新
      setTransportTasks(prev => prev.map(task => {
        if (task.id === edgeData.taskId) {
          return {
            ...task,
            status: edgeData.transportStatus || task.status,
            quantity: edgeData.lotCount || task.quantity,
          };
        }
        return task;
      }));
    }
  }, [edgeId, realtimeData]);

  // フィルタリングとソート
  const filteredAndSortedTasks = transportTasks
    .filter(task => filterStatus === 'all' || task.status === filterStatus)
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

  // ページネーション
  const paginatedTasks = filteredAndSortedTasks.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 統計情報
  const totalTasks = transportTasks.length;
  const waitingTasks = transportTasks.filter(t => t.status === 'waiting').length;
  const inTransitTasks = transportTasks.filter(t => t.status === 'in_transit').length;
  const completedTasks = transportTasks.filter(t => t.status === 'completed').length;
  const errorTasks = transportTasks.filter(t => t.status === 'error').length;

  const getStatusColor = (status: TransportTask['status']) => {
    switch (status) {
      case 'waiting':
        return 'warning';
      case 'in_transit':
        return 'info';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: TransportTask['status']) => {
    switch (status) {
      case 'waiting':
        return <Schedule />;
      case 'in_transit':
        return <LocalShipping />;
      case 'completed':
        return <CheckCircle />;
      case 'error':
        return <Error />;
      case 'cancelled':
        return <Info />;
      default:
        return <Info />;
    }
  };

  const getPriorityColor = (priority: TransportTask['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  if (!edgeId) {
    return (
      <Box sx={{ 
        height: 300, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #eee',
        borderRadius: 1
      }}>
        <Typography variant="body2" color="text.secondary">
          搬送エッジをクリックして搬送状況を表示してください
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ 
        height: 300, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #eee',
        borderRadius: 1
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        height: 300, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #eee',
        borderRadius: 1
      }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダーとコントロール */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <Box>
            <Typography variant="h6" gutterBottom>
              🚚 搬送モニター
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {edgeInfo ? `搬送エッジ: ${edgeInfo.id}` : `搬送エッジ: ${edgeId}`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="フィルター">
              <IconButton size="small">
                <FilterList />
              </IconButton>
            </Tooltip>
            <Tooltip title="ソート">
              <IconButton size="small">
                <Sort />
              </IconButton>
            </Tooltip>
            <Tooltip title="更新">
              <IconButton size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* 統計サマリー */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={totalTasks} color="primary">
                <LocalShipping color="primary" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" sx={{ mt: 1 }}>
                総タスク数
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={waitingTasks} color="warning">
                <Schedule color="warning" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" sx={{ mt: 1 }}>
                待機中
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={inTransitTasks} color="info">
                <DirectionsCar color="info" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" sx={{ mt: 1 }}>
                搬送中
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={completedTasks} color="success">
                <CheckCircle color="success" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" sx={{ mt: 1 }}>
                完了
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 進捗バー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          全体進捗
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ flexGrow: 1, mr: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={(completedTasks / totalTasks) * 100} 
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {Math.round((completedTasks / totalTasks) * 100)}%
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {completedTasks} / {totalTasks} タスク完了
        </Typography>
      </Paper>

      {/* フィルター */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">ステータスフィルター:</Typography>
          <Chip
            label="すべて"
            color={filterStatus === 'all' ? 'primary' : 'default'}
            onClick={() => setFilterStatus('all')}
            clickable
          />
          <Chip
            label="待機中"
            color={filterStatus === 'waiting' ? 'warning' : 'default'}
            onClick={() => setFilterStatus('waiting')}
            clickable
          />
          <Chip
            label="搬送中"
            color={filterStatus === 'in_transit' ? 'info' : 'default'}
            onClick={() => setFilterStatus('in_transit')}
            clickable
          />
          <Chip
            label="完了"
            color={filterStatus === 'completed' ? 'success' : 'default'}
            onClick={() => setFilterStatus('completed')}
            clickable
          />
          <Chip
            label="エラー"
            color={filterStatus === 'error' ? 'error' : 'default'}
            onClick={() => setFilterStatus('error')}
            clickable
          />
        </Stack>
      </Paper>

      {/* タスクテーブル */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>搬送元</TableCell>
                <TableCell>搬送先</TableCell>
                <TableCell>製品</TableCell>
                <TableCell>数量</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>優先度</TableCell>
                <TableCell>開始時刻</TableCell>
                <TableCell>予定完了</TableCell>
                <TableCell>搬送時間</TableCell>
                <TableCell>距離</TableCell>
                <TableCell>車両</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTasks.map((task) => (
                <TableRow key={task.id} hover>
                  <TableCell>{task.id}</TableCell>
                  <TableCell>{task.source}</TableCell>
                  <TableCell>{task.target}</TableCell>
                  <TableCell>{task.productName}</TableCell>
                  <TableCell>{task.quantity}</TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(task.status)}
                      label={task.status}
                      color={getStatusColor(task.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.priority}
                      color={getPriorityColor(task.priority)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(task.startTime).toLocaleTimeString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    {new Date(task.estimatedEndTime).toLocaleTimeString('ja-JP')}
                  </TableCell>
                  <TableCell>{task.transportTime}分</TableCell>
                  <TableCell>{task.distance}km</TableCell>
                  <TableCell>{task.vehicleId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredAndSortedTasks.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="ページあたりの行数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        />
      </Paper>
    </Box>
  );
};

export default TransportMonitor;
