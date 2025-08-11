import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { RootState } from '../../store';
import dayjs from 'dayjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const InventoryChart: React.FC = () => {
  const inventoryData = useSelector((state: RootState) => state.monitoring.inventoryData);
  
  // 在庫データから現在の値を取得
  const bufferIds = Object.keys(inventoryData);
  const quantities = Object.values(inventoryData);
  
  // 簡易的なダミーラベルを生成（実際の履歴機能は後で実装）
  const labels = bufferIds.length > 0 ? 
    Array.from({ length: 10 }, (_, i) => dayjs().subtract(i * 5, 'minute').format('HH:mm')) :
    Array.from({ length: 10 }, (_, i) => dayjs().subtract(i * 5, 'minute').format('HH:mm'));
  
  // Chart.jsのデータセットを作成
  const datasets = bufferIds.map((bufferId, index) => {
    const colors = [
      'rgb(255, 99, 132)',
      'rgb(54, 162, 235)',
      'rgb(255, 205, 86)',
      'rgb(75, 192, 192)',
      'rgb(153, 102, 255)',
    ];
    
    // 現在の在庫値を履歴のように表示するためのダミーデータ
    const currentValue = inventoryData[bufferId] || 0;
    const dummyData = Array.from({ length: 10 }, () => 
      currentValue + Math.random() * 5 - 2.5 // 現在値の±2.5の範囲でゆらぎ
    );
    
    return {
      label: `バッファ ${bufferId}`,
      data: dummyData,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '33',
      tension: 0.1,
    };
  });
  
  // データがない場合のフォールバック
  const finalDatasets = datasets.length > 0 ? datasets : [
    {
      label: 'バッファ1',
      data: [10, 12, 8, 15, 11, 9, 13, 14, 10, 12],
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgb(255, 99, 132)33',
      tension: 0.1,
    },
    {
      label: 'バッファ2',
      data: [8, 9, 12, 7, 10, 11, 8, 9, 13, 10],
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgb(54, 162, 235)33',
      tension: 0.1,
    }
  ];
  
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300, // スムーズなアニメーション
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '時刻',
        },
        ticks: {
          maxTicksLimit: 10, // 表示するラベル数を制限
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: '在庫数量',
        },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    elements: {
      point: {
        radius: 2, // ポイントサイズを小さく
      },
      line: {
        tension: 0.2, // よりスムーズな線
      },
    },
  };
  
  const data = {
    labels,
    datasets: finalDatasets,
  };
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        在庫推移
      </Typography>
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {datasets.length > 0 ? (
          <Line options={options} data={data} />
        ) : (
          <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>
            データがありません
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default InventoryChart;