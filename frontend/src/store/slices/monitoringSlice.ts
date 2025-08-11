import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MonitoringState {
  kpiData: {
    oee: number;
    throughput: number;
    cycleTime: number;
    quality: number;
  };
  inventoryData: Record<string, number>;
  equipmentStatus: Record<string, string>;
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

const initialState: MonitoringState = {
  kpiData: {
    oee: 0,
    throughput: 0,
    cycleTime: 0,
    quality: 0,
  },
  inventoryData: {},
  equipmentStatus: {},
  alerts: [],
};

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    setKPIData: (state, action: PayloadAction<Partial<MonitoringState['kpiData']>>) => {
      state.kpiData = { ...state.kpiData, ...action.payload };
    },
    setInventoryData: (state, action: PayloadAction<Record<string, number>>) => {
      state.inventoryData = action.payload;
    },
    updateInventory: (state, action: PayloadAction<{ nodeId: string; quantity: number }>) => {
      state.inventoryData[action.payload.nodeId] = action.payload.quantity;
    },
    setEquipmentStatus: (state, action: PayloadAction<Record<string, string>>) => {
      state.equipmentStatus = action.payload;
    },
    updateEquipmentStatus: (state, action: PayloadAction<{ nodeId: string; status: string }>) => {
      state.equipmentStatus[action.payload.nodeId] = action.payload.status;
    },
    addAlert: (state, action: PayloadAction<{
      type: 'info' | 'warning' | 'error';
      message: string;
    }>) => {
      state.alerts.push({
        id: Date.now().toString(),
        ...action.payload,
        timestamp: new Date().toISOString(),
      });
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
    clearAlerts: (state) => {
      state.alerts = [];
    },
  },
});

export const {
  setKPIData,
  setInventoryData,
  updateInventory,
  setEquipmentStatus,
  updateEquipmentStatus,
  addAlert,
  removeAlert,
  clearAlerts,
} = monitoringSlice.actions;

export default monitoringSlice.reducer;