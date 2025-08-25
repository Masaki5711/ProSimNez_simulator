import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
  Chip,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

interface TimelineViewerProps {
  realtimeData: any;
  simulationStatus: any;
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  nodeId: string;
  eventType: 'process_start' | 'process_complete' | 'material_move' | 'inventory_change' | 'quality_check';
  description: string;
  data: any;
}

const TimelineViewer: React.FC<TimelineViewerProps> = ({
  realtimeData,
  simulationStatus,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  
  // シミュレーション制御からの時間を受け取る
  useEffect(() => {
    if (simulationStatus?.currentTime !== undefined) {
      setCurrentTime(simulationStatus.currentTime);
    }
  }, [simulationStatus?.currentTime]);
  const [timeRange, setTimeRange] = useState([0, 24 * 3600]); // 24時間分 (秒)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(new Set([
    'process_start', 'process_complete', 'material_move', 'inventory_change'
  ]));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // シミュレーション時間からイベントデータを生成
  useEffect(() => {
    if (realtimeData && simulationStatus?.status === 'running') {
      // 模擬イベントデータの生成（実際の実装では、バックエンドからイベントログを取得）
      const mockEvents = generateMockEvents(currentTime);
      setEvents(prev => [...prev, ...mockEvents]);
    }
  }, [realtimeData, currentTime]);

  // タイムライン描画
  useEffect(() => {
    drawTimeline();
  }, [events, currentTime, timeRange, zoomLevel, selectedEventTypes]);

  // 模擬イベントデータ生成
  const generateMockEvents = (time: number): TimelineEvent[] => {
    const newEvents: TimelineEvent[] = [];
    const eventTypes = ['process_start', 'process_complete', 'material_move', 'inventory_change'];
    
    // ランダムにイベントを生成
    for (let i = 0; i < Math.random() * 3; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)] as any;
      newEvents.push({
        id: `event_${time}_${i}`,
        timestamp: time,
        nodeId: `node_${Math.floor(Math.random() * 5)}`,
        eventType,
        description: getEventDescription(eventType),
        data: { value: Math.floor(Math.random() * 100) },
      });
    }
    
    return newEvents;
  };

  // イベント説明文生成
  const getEventDescription = (eventType: string): string => {
    switch (eventType) {
      case 'process_start': return '工程開始';
      case 'process_complete': return '工程完了';
      case 'material_move': return '材料移動';
      case 'inventory_change': return '在庫変更';
      case 'quality_check': return '品質検査';
      default: return '不明なイベント';
    }
  };

  // タイムライン描画
  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // 背景描画
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    // タイムライン軸描画
    drawTimeAxis(ctx, width, height);

    // イベント描画
    drawEvents(ctx, width, height);

    // 現在時刻マーカー描画
    drawCurrentTimeMarker(ctx, width, height);
  };

  // 時間軸描画
  const drawTimeAxis = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const timelineHeight = 30;
    const [startTime, endTime] = timeRange;
    const pixelsPerSecond = (width - 60) / (endTime - startTime) * zoomLevel;

    // 軸線
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, height - timelineHeight);
    ctx.lineTo(width - 30, height - timelineHeight);
    ctx.stroke();

    // 時間目盛り
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    
    const interval = Math.max(1, Math.floor((endTime - startTime) / 10));
    for (let time = startTime; time <= endTime; time += interval) {
      const x = 30 + (time - startTime) * pixelsPerSecond;
      if (x >= 30 && x <= width - 30) {
        // 目盛り線
        ctx.beginPath();
        ctx.moveTo(x, height - timelineHeight);
        ctx.lineTo(x, height - timelineHeight + 5);
        ctx.stroke();

        // 時間ラベル
        const timeLabel = formatTime(time);
        ctx.fillText(timeLabel, x - 20, height - 5);
      }
    }
  };

  // イベント描画
  const drawEvents = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const timelineHeight = 30;
    const eventHeight = height - timelineHeight - 40;
    const [startTime, endTime] = timeRange;
    const pixelsPerSecond = (width - 60) / (endTime - startTime) * zoomLevel;

    // イベント種別ごとのレーン
    const eventLanes = {
      'process_start': { y: 20, color: '#4caf50' },
      'process_complete': { y: 40, color: '#2196f3' },
      'material_move': { y: 60, color: '#ff9800' },
      'inventory_change': { y: 80, color: '#9c27b0' },
      'quality_check': { y: 100, color: '#f44336' },
    };

    events
      .filter(event => selectedEventTypes.has(event.eventType))
      .filter(event => event.timestamp >= startTime && event.timestamp <= endTime)
      .forEach(event => {
        const x = 30 + (event.timestamp - startTime) * pixelsPerSecond;
        const lane = eventLanes[event.eventType as keyof typeof eventLanes];
        
        if (lane && x >= 30 && x <= width - 30) {
          // イベントマーカー
          ctx.fillStyle = lane.color;
          ctx.beginPath();
          ctx.arc(x, lane.y, 4, 0, 2 * Math.PI);
          ctx.fill();

          // イベント詳細（ホバー時に表示予定）
          if (Math.abs(x - (currentTime * pixelsPerSecond + 30)) < 10) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x + 5, lane.y - 10, 100, 20);
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText(event.description, x + 8, lane.y);
          }
        }
      });

    // レーン名
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    Object.entries(eventLanes).forEach(([eventType, lane]) => {
      if (selectedEventTypes.has(eventType)) {
        ctx.fillText(getEventDescription(eventType), 35, lane.y + 4);
      }
    });
  };

  // 現在時刻マーカー描画
  const drawCurrentTimeMarker = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const [startTime, endTime] = timeRange;
    const pixelsPerSecond = (width - 60) / (endTime - startTime) * zoomLevel;
    const x = 30 + (currentTime - startTime) * pixelsPerSecond;

    if (x >= 30 && x <= width - 30) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - 30);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  // 時間フォーマット
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 時間制御
  const handleTimeChange = (event: Event, newValue: number | number[]) => {
    setCurrentTime(newValue as number);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1));
  };

  const handleFitToScreen = () => {
    setZoomLevel(1);
    setTimeRange([0, 24 * 3600]);
  };

  // イベント種別フィルター
  const toggleEventType = (eventType: string) => {
    const newSelected = new Set(selectedEventTypes);
    if (newSelected.has(eventType)) {
      newSelected.delete(eventType);
    } else {
      newSelected.add(eventType);
    }
    setSelectedEventTypes(newSelected);
  };

  // タイムライン自動更新
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && simulationStatus?.status === 'running') {
      interval = setInterval(() => {
        setCurrentTime(prev => prev + playbackSpeed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, simulationStatus]);

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TimelineIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6" fontWeight="bold">
          シミュレーションタイムライン
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            現在時刻: {formatTime(currentTime)}
          </Typography>
        </Box>
      </Box>

      {/* 制御パネル */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {/* タイムラインナビゲーション（再生制御は無効化） */}
            <ButtonGroup size="small">
              <IconButton onClick={() => setCurrentTime(Math.max(0, currentTime - 60))}>
                <SkipPrevious />
              </IconButton>
              <IconButton disabled>
                <PlayArrow />
              </IconButton>
              <IconButton onClick={() => setCurrentTime(currentTime + 60)}>
                <SkipNext />
              </IconButton>
            </ButtonGroup>
            
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              シミュレーション制御はメイン制御パネルをご利用ください
            </Typography>

            {/* ズーム制御 */}
            <ButtonGroup size="small">
              <IconButton onClick={handleZoomOut}>
                <ZoomOut />
              </IconButton>
              <IconButton onClick={handleFitToScreen}>
                <FitScreen />
              </IconButton>
              <IconButton onClick={handleZoomIn}>
                <ZoomIn />
              </IconButton>
            </ButtonGroup>

            {/* 再生速度 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">速度:</Typography>
              <ButtonGroup size="small">
                {[0.5, 1, 2, 5].map(speed => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? 'contained' : 'outlined'}
                    onClick={() => setPlaybackSpeed(speed)}
                  >
                    ×{speed}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>
          </Box>

          {/* 時間スライダー */}
          <Box sx={{ px: 2 }}>
            <Slider
              value={currentTime}
              onChange={handleTimeChange}
              min={timeRange[0]}
              max={timeRange[1]}
              step={1}
              valueLabelDisplay="auto"
              valueLabelFormat={formatTime}
            />
          </Box>

          {/* イベントフィルター */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              表示イベント:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { type: 'process_start', label: '工程開始', color: '#4caf50' },
                { type: 'process_complete', label: '工程完了', color: '#2196f3' },
                { type: 'material_move', label: '材料移動', color: '#ff9800' },
                { type: 'inventory_change', label: '在庫変更', color: '#9c27b0' },
                { type: 'quality_check', label: '品質検査', color: '#f44336' },
              ].map(({ type, label, color }) => (
                <Chip
                  key={type}
                  label={label}
                  onClick={() => toggleEventType(type)}
                  variant={selectedEventTypes.has(type) ? 'filled' : 'outlined'}
                  sx={{
                    backgroundColor: selectedEventTypes.has(type) ? color : 'transparent',
                    color: selectedEventTypes.has(type) ? 'white' : color,
                    borderColor: color,
                  }}
                  size="small"
                />
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* タイムライン表示 */}
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, p: 1 }}>
          <Box ref={timelineRef} sx={{ width: '100%', height: '100%' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              style={{ width: '100%', height: '100%' }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TimelineViewer;