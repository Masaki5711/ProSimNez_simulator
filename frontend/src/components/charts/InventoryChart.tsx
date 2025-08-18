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
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface InventoryData {
  timestamp: string;
  wip: number;
  processed: number;
  efficiency: number;
}

interface InventoryChartProps {
  nodeId: string | null;
  nodeName?: string;
  realtimeData?: any;
}

const InventoryChart: React.FC<InventoryChartProps> = ({ 
  nodeId, 
  nodeName,
  realtimeData 
}) => {
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // サンプルデータの生成（実際のAPIから取得する場合は削除）
  const generateSampleData = (nodeId: string): InventoryData[] => {
    const now = new Date();
    const data: InventoryData[] = [];
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000); // 1時間ごと
      const baseWip = 50 + Math.random() * 30; // 50-80の範囲
      const baseProcessed = 20 + Math.random() * 15; // 20-35の範囲
      
      data.push({
        timestamp: time.toISOString(),
        wip: Math.round(baseWip + Math.sin(i * 0.3) * 10),
        processed: Math.round(baseProcessed + Math.cos(i * 0.2) * 8),
        efficiency: Math.round(70 + Math.sin(i * 0.4) * 20),
      });
    }
    
    return data;
  };

  // データ取得処理
  useEffect(() => {
    if (!nodeId) {
      setInventoryData([]);
      return;
    }

    setLoading(true);
    setError(null);

    // 実際のAPIからデータを取得する場合はここで実装
    // 現在はサンプルデータを使用
    try {
      const sampleData = generateSampleData(nodeId);
      setInventoryData(sampleData);
    } catch (err: any) {
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  // リアルタイムデータの更新
  useEffect(() => {
    if (nodeId && realtimeData?.nodes?.[nodeId]) {
      const nodeData = realtimeData.nodes[nodeId];
      const newDataPoint: InventoryData = {
        timestamp: new Date().toISOString(),
        wip: nodeData.wip || 0,
        processed: nodeData.processed || 0,
        efficiency: nodeData.efficiency || 0,
      };

      setInventoryData(prev => {
        const updated = [...prev, newDataPoint];
        // 最新の24時間分のみ保持
        if (updated.length > 24) {
          return updated.slice(-24);
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
          工程ノードをクリックして在庫推移を表示してください
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
    labels: inventoryData.map(d => new Date(d.timestamp).toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })),
    datasets: [
      {
        label: '仕掛品数 (WIP)',
        data: inventoryData.map(d => d.wip),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: '処理済み数',
        data: inventoryData.map(d => d.processed),
      borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: '効率 (%)',
        data: inventoryData.map(d => d.efficiency),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        hidden: true, // デフォルトでは非表示
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
        text: `${nodeName || nodeId} - 在庫推移`,
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
            return new Date(inventoryData[index].timestamp).toLocaleString('ja-JP');
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '時間',
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
          text: '効率 (%)',
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
  const currentWIP = inventoryData[inventoryData.length - 1]?.wip || 0;
  const currentProcessed = inventoryData[inventoryData.length - 1]?.processed || 0;
  const currentEfficiency = inventoryData[inventoryData.length - 1]?.efficiency || 0;
  const avgWIP = Math.round(inventoryData.reduce((sum, d) => sum + d.wip, 0) / inventoryData.length);
  const avgEfficiency = Math.round(inventoryData.reduce((sum, d) => sum + d.efficiency, 0) / inventoryData.length);
  
  return (
    <Box>
      {/* 現在値サマリー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          現在の状況
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Chip
            label={`仕掛品数: ${currentWIP}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`処理済み: ${currentProcessed}`}
            color="secondary"
            variant="outlined"
          />
          <Chip
            label={`効率: ${currentEfficiency}%`}
            color={currentEfficiency > 80 ? 'success' : currentEfficiency > 60 ? 'warning' : 'error'}
            variant="outlined"
          />
          <Chip
            label={`平均WIP: ${avgWIP}`}
            color="info"
            variant="outlined"
          />
          <Chip
            label={`平均効率: ${avgEfficiency}%`}
            color={avgEfficiency > 80 ? 'success' : avgEfficiency > 60 ? 'warning' : 'error'}
            variant="outlined"
          />
        </Stack>
      </Paper>

      {/* チャート */}
      <Paper sx={{ p: 2, height: 400 }}>
        <Line data={chartData} options={chartOptions} />
      </Paper>

      {/* データ統計 */}
      <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
          統計情報
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              最大仕掛品数: {Math.max(...inventoryData.map(d => d.wip))}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              最小仕掛品数: {Math.min(...inventoryData.map(d => d.wip))}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              最大効率: {Math.max(...inventoryData.map(d => d.efficiency))}%
      </Typography>
            <Typography variant="body2" color="text.secondary">
              最小効率: {Math.min(...inventoryData.map(d => d.efficiency))}%
          </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default InventoryChart;