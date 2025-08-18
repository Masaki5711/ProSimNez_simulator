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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ProductionData {
  timestamp: string;
  completed: number;
  target: number;
  efficiency: number;
  quality: number;
  defects: number;
}

interface ProductionChartProps {
  nodeId: string | null;
  nodeName?: string;
  realtimeData?: any;
}

const ProductionChart: React.FC<ProductionChartProps> = ({ 
  nodeId, 
  nodeName,
  realtimeData 
}) => {
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // サンプルデータの生成（実際のAPIから取得する場合は削除）
  const generateSampleData = (nodeId: string, range: '24h' | '7d' | '30d'): ProductionData[] => {
    const now = new Date();
    const data: ProductionData[] = [];
    
    let interval: number;
    let count: number;
    
    switch (range) {
      case '24h':
        interval = 60 * 60 * 1000; // 1時間
        count = 24;
        break;
      case '7d':
        interval = 24 * 60 * 60 * 1000; // 1日
        count = 7;
        break;
      case '30d':
        interval = 24 * 60 * 60 * 1000; // 1日
        count = 30;
        break;
      default:
        interval = 60 * 60 * 1000;
        count = 24;
    }
    
    for (let i = count - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * interval);
      const baseCompleted = 80 + Math.random() * 40; // 80-120の範囲
      const baseTarget = 100;
      const baseEfficiency = 75 + Math.random() * 20; // 75-95の範囲
      const baseQuality = 90 + Math.random() * 8; // 90-98の範囲
      
      data.push({
        timestamp: time.toISOString(),
        completed: Math.round(baseCompleted + Math.sin(i * 0.3) * 15),
        target: baseTarget,
        efficiency: Math.round(baseEfficiency + Math.cos(i * 0.2) * 10),
        quality: Math.round(baseQuality + Math.sin(i * 0.4) * 5),
        defects: Math.round((100 - baseQuality) * 0.1 + Math.random() * 2),
      });
    }
    
    return data;
  };

  // データ取得処理
  useEffect(() => {
    if (!nodeId) {
      setProductionData([]);
      return;
    }

    setLoading(true);
    setError(null);

    // 実際のAPIからデータを取得する場合はここで実装
    // 現在はサンプルデータを使用
    try {
      const sampleData = generateSampleData(nodeId, timeRange);
      setProductionData(sampleData);
    } catch (err: any) {
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [nodeId, timeRange]);

  // リアルタイムデータの更新
  useEffect(() => {
    if (nodeId && realtimeData?.nodes?.[nodeId]) {
      const nodeData = realtimeData.nodes[nodeId];
      const newDataPoint: ProductionData = {
        timestamp: new Date().toISOString(),
        completed: nodeData.processed || 0,
        target: 100, // 目標値は固定
        efficiency: nodeData.efficiency || 0,
        quality: nodeData.quality || 95,
        defects: Math.round((100 - (nodeData.quality || 95)) * 0.1),
      };

      setProductionData(prev => {
        const updated = [...prev, newDataPoint];
        // 最新のデータのみ保持
        if (updated.length > 50) {
          return updated.slice(-50);
        }
        return updated;
      });
    }
  }, [nodeId, realtimeData]);

  if (!nodeId) {
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
          工程ノードをクリックして出来高分析を表示してください
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

  // チャートデータの準備
  const chartData = {
    labels: productionData.map(d => {
      if (timeRange === '24h') {
        return new Date(d.timestamp).toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      } else {
        return new Date(d.timestamp).toLocaleDateString('ja-JP', { 
          month: '2-digit', 
          day: '2-digit' 
        });
      }
    }),
    datasets: [
      {
        label: '完了数',
        data: productionData.map(d => d.completed),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: chartType === 'bar' ? 'rgba(53, 162, 235, 0.8)' : 'rgba(53, 162, 235, 0.1)',
        fill: chartType === 'line',
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: '目標値',
        data: productionData.map(d => d.target),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: chartType === 'bar' ? 'rgba(255, 99, 132, 0.8)' : 'rgba(255, 99, 132, 0.1)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y',
        borderDash: [5, 5],
      },
      {
        label: '効率 (%)',
        data: productionData.map(d => d.efficiency),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: chartType === 'bar' ? 'rgba(75, 192, 192, 0.8)' : 'rgba(75, 192, 192, 0.1)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        hidden: true,
      },
      {
        label: '品質 (%)',
        data: productionData.map(d => d.quality),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: chartType === 'bar' ? 'rgba(255, 159, 64, 0.8)' : 'rgba(255, 159, 64, 0.1)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        hidden: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: `${nodeName || nodeId} - 出来高分析`,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            return new Date(productionData[index].timestamp).toLocaleString('ja-JP');
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: timeRange === '24h' ? '時間' : '日付',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: '数量',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        min: 0,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'パーセンテージ',
        },
        grid: {
          drawOnChartArea: false,
        },
        min: 0,
        max: 100,
      },
    },
  };

  // 現在の値を計算
  const currentCompleted = productionData[productionData.length - 1]?.completed || 0;
  const currentTarget = productionData[productionData.length - 1]?.target || 0;
  const currentEfficiency = productionData[productionData.length - 1]?.efficiency || 0;
  const currentQuality = productionData[productionData.length - 1]?.quality || 0;
  const currentDefects = productionData[productionData.length - 1]?.defects || 0;
  
  const totalCompleted = productionData.reduce((sum, d) => sum + d.completed, 0);
  const avgEfficiency = Math.round(productionData.reduce((sum, d) => sum + d.efficiency, 0) / productionData.length);
  const avgQuality = Math.round(productionData.reduce((sum, d) => sum + d.quality, 0) / productionData.length);
  const totalDefects = productionData.reduce((sum, d) => sum + d.defects, 0);

  const achievementRate = currentTarget > 0 ? Math.round((currentCompleted / currentTarget) * 100) : 0;

  return (
    <Box>
      {/* コントロール */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">
            表示設定
          </Typography>
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(e, newType) => newType && setChartType(newType)}
            size="small"
          >
            <ToggleButton value="line">折れ線グラフ</ToggleButton>
            <ToggleButton value="bar">棒グラフ</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(e, newRange) => newRange && setTimeRange(newRange)}
            size="small"
          >
            <ToggleButton value="24h">24時間</ToggleButton>
            <ToggleButton value="7d">7日間</ToggleButton>
            <ToggleButton value="30d">30日間</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* 現在値サマリー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          現在の状況
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Chip
            label={`完了数: ${currentCompleted}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`目標値: ${currentTarget}`}
            color="secondary"
            variant="outlined"
          />
          <Chip
            label={`達成率: ${achievementRate}%`}
            color={achievementRate >= 100 ? 'success' : achievementRate >= 80 ? 'warning' : 'error'}
            variant="outlined"
          />
          <Chip
            label={`効率: ${currentEfficiency}%`}
            color={currentEfficiency > 80 ? 'success' : currentEfficiency > 60 ? 'warning' : 'error'}
            variant="outlined"
          />
          <Chip
            label={`品質: ${currentQuality}%`}
            color={currentQuality > 95 ? 'success' : currentQuality > 90 ? 'warning' : 'error'}
            variant="outlined"
          />
          <Chip
            label={`不良数: ${currentDefects}`}
            color={currentDefects < 2 ? 'success' : currentDefects < 5 ? 'warning' : 'error'}
            variant="outlined"
          />
        </Stack>
      </Paper>

      {/* チャート */}
      <Paper sx={{ p: 2, height: 400 }}>
        {chartType === 'line' ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <Bar data={chartData} options={chartOptions} />
        )}
      </Paper>

      {/* データ統計 */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          統計情報
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              総完了数: {totalCompleted}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              最大完了数: {Math.max(...productionData.map(d => d.completed))}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              最小完了数: {Math.min(...productionData.map(d => d.completed))}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              平均効率: {avgEfficiency}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              平均品質: {avgQuality}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              総不良数: {totalDefects}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ProductionChart;
