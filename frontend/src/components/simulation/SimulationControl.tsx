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
  Tabs,
  Tab,
  Divider,
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
import NetworkSimulationControl from './NetworkSimulationControl';
import dayjs from 'dayjs';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simulation-tabpanel-${index}`}
      aria-labelledby={`simulation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const SimulationControl: React.FC = () => {
  const dispatch = useDispatch();
  const { isRunning, isPaused, currentTime, speed } = useSelector(
    (state: RootState) => state.simulation
  );
  const { sendMessage } = useWebSocket();
  const [tabValue, setTabValue] = React.useState(0);

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const speedMarks = [
    { value: 0.5, label: '×0.5' },
    { value: 1, label: '×1' },
    { value: 2, label: '×2' },
    { value: 10, label: '×10' },
  ];

  return (
    <Box>
      {/* タブナビゲーション */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="シミュレーション制御タブ">
          <Tab label="🏭 基本シミュレーション" />
          <Tab label="🌐 ネットワークシミュレーション" />
        </Tabs>
      </Box>

      {/* 基本シミュレーションタブ */}
      <TabPanel value={tabValue} index={0}>
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
      </TabPanel>

      {/* ネットワークシミュレーションタブ */}
      <TabPanel value={tabValue} index={1}>
        <NetworkSimulationControl />
      </TabPanel>
    </Box>
  );
};

export default SimulationControl;