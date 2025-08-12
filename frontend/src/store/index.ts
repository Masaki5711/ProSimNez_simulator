import { configureStore } from '@reduxjs/toolkit';
import simulationReducer from './slices/simulationSlice';
import networkReducer from './slices/networkSlice';
import monitoringReducer from './slices/monitoringSlice';
import projectReducer from './projectSlice';
import componentReducer from './slices/componentSlice';

export const store = configureStore({
  reducer: {
    simulation: simulationReducer,
    network: networkReducer,
    monitoring: monitoringReducer,
    project: projectReducer,
    components: componentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;