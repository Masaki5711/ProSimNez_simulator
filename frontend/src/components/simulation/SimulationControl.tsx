import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Typography,
  Chip,
  Slider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  SkipNext as StepIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { startSimulation, pauseSimulation, stopSimulation, setSpeed } from '../../store/slices/simulationSlice';
import { useWebSocket } from '../../hooks/useWebSocket';
import { simulationApi } from '../../api/simulationApi';
import dayjs from 'dayjs';

const SimulationControl: React.FC = () => {
  const dispatch = useDispatch();
  const { isRunning, isPaused, currentTime, speed } = useSelector(
    (state: RootState) => state.simulation
  );
  const { sendMessage } = useWebSocket();

  const handleStart = async () => {
    try {
      await simulationApi.start({
        start_time: new Date().toISOString(),
        speed: speed,
      });
      dispatch(startSimulation());
    } catch (error) {
      console.error('シミュレーション開始エラー:', error);
    }
  };

  const handlePause = async () => {
    try {
      await simulationApi.pause();
      dispatch(pauseSimulation());
    } catch (error) {
      console.error('一時停止エラー:', error);
    }
  };

  const handleStop = async () => {
    try {
      await simulationApi.stop();
      dispatch(stopSimulation());
    } catch (error) {
      console.error('停止エラー:', error);
    }
  };

  const handleStep = () => {
    sendMessage({
      type: 'control',
      action: 'step',
    });
  };

  const handleSpeedChange = async (_: Event, value: number | number[]) => {
    const newSpeed = value as number;
    try {
      await simulationApi.setSpeed(newSpeed);
      dispatch(setSpeed(newSpeed));
    } catch (error) {
      console.error('速度変更エラー:', error);
    }
  };

  const speedMarks = [
    { value: 0.5, label: '×0.5' },
    { value: 1, label: '×1' },
    { value: 2, label: '×2' },
    { value: 10, label: '×10' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <ButtonGroup variant="contained" size="large">
          <Button
            onClick={handleStart}
            disabled={isRunning}
            startIcon={<PlayIcon />}
          >
            開始
          </Button>
          <Button
            onClick={handlePause}
            disabled={!isRunning || isPaused}
            startIcon={<PauseIcon />}
          >
            一時停止
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isRunning}
            startIcon={<StopIcon />}
            color="error"
          >
            停止
          </Button>
        </ButtonGroup>

        <IconButton
          onClick={handleStep}
          disabled={isRunning}
          size="large"
        >
          <StepIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={isRunning ? (isPaused ? '一時停止' : '実行中') : '停止'}
            color={isRunning && !isPaused ? 'primary' : 'default'}
            size="small"
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body1">
          現在時刻: {dayjs(currentTime).format('YYYY/MM/DD HH:mm:ss')}
        </Typography>
      </Box>

      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <SpeedIcon />
        <Typography variant="body2" sx={{ minWidth: 80 }}>
          速度: ×{speed}
        </Typography>
        <Box sx={{ flexGrow: 1, maxWidth: 300 }}>
          <Slider
            value={speed}
            onChange={handleSpeedChange}
            min={0.5}
            max={10}
            step={0.5}
            marks={speedMarks}
            valueLabelDisplay="auto"
            disabled={false}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default SimulationControl;