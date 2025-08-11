import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  currentTime: number;
  speed: number;
  duration: number;
}

const initialState: SimulationState = {
  isRunning: false,
  isPaused: false,
  currentTime: 0,
  speed: 1,
  duration: 3600, // 1時間
};

const simulationSlice = createSlice({
  name: 'simulation',
  initialState,
  reducers: {
    startSimulation: (state) => {
      state.isRunning = true;
      state.isPaused = false;
    },
    pauseSimulation: (state) => {
      state.isPaused = true;
    },
    stopSimulation: (state) => {
      state.isRunning = false;
      state.isPaused = false;
      state.currentTime = 0;
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },
    setSpeed: (state, action: PayloadAction<number>) => {
      state.speed = action.payload;
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },
  },
});

export const {
  startSimulation,
  pauseSimulation,
  stopSimulation,
  setCurrentTime,
  setSpeed,
  setDuration,
} = simulationSlice.actions;

export default simulationSlice.reducer;