import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// 既存のネットワークシミュレーション状態
interface NetworkSimulationState {
  isNetworkSimulationRunning: boolean;
  networkSimulationId: string | null;
  networkData: any | null;
  validationResult: any | null;
  productionSummary: any | null;
  schedulingAnalysis: any | null;
  networkPerformance: any | null;
}

// 新しく追加するシミュレーション状態の型定義
export interface SimulationStatus {
  id: string;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  currentTime: string;
  speed: number;
  duration: number;
  startTime: string;
  endTime: string;
  isConnected: boolean;
  lastUpdate: string;
}

// 工程ノードの状態
export interface ProcessNodeStatus {
  id: string;
  type: 'process' | 'buffer' | 'source' | 'sink';
  status: 'running' | 'idle' | 'breakdown' | 'maintenance' | 'unknown';
  wip: number; // 仕掛品数
  processed: number; // 処理済み数
  efficiency: number; // 効率（%）
  throughput: number; // スループット
  utilization: number; // 稼働率（%）
  quality: number; // 品質指標
  lastUpdate: string;
}

// 搬送エッジの状態
export interface TransportEdgeStatus {
  id: string;
  source: string;
  target: string;
  transportStatus: 'waiting' | 'in_transit' | 'completed' | 'error';
  lotCount: number; // 搬送中ロット数
  productInfo: string; // 製品情報
  transportTime: number; // 搬送時間
  distance: number; // 距離
  lastUpdate: string;
}

// リアルタイムデータの型定義
export interface RealtimeData {
  nodes: Record<string, ProcessNodeStatus>;
  edges: Record<string, TransportEdgeStatus>;
  overall: {
    totalWIP: number;
    totalProcessed: number;
    overallEfficiency: number;
    bottleneck: string | null;
    lastUpdate: string;
  };
}

// シミュレーション設定
export interface SimulationConfig {
  projectId: string;
  duration: number; // 時間（時間）
  timeScale: number; // 時間スケール
  enableDetailedProcess: boolean;
  enableMaterialFlow: boolean;
  enableTransport: boolean;
  enableQuality: boolean;
  enableScheduling: boolean;
  realTimeMonitoring: boolean;
}

// シミュレーションイベント
export interface SimulationEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  nodeId?: string;
  edgeId?: string;
  details?: any;
}

// 統合されたシミュレーション状態
interface SimulationState {
  // 既存の基本状態
  isRunning: boolean;
  isPaused: boolean;
  currentTime: number;
  speed: number;
  duration: number;
  network: NetworkSimulationState;
  
  // 新しく追加する詳細状態
  status: SimulationStatus | null;
  config: SimulationConfig | null;
  realtimeData: RealtimeData | null;
  events: SimulationEvent[];
  loading: boolean;
  error: string | null;
  selectedNode: string | null;
  selectedEdge: { id: string; type: string } | null;
  activeTab: number;
  webSocketStatus: boolean;
}

const initialState: SimulationState = {
  // 既存の初期値
  isRunning: false,
  isPaused: false,
  currentTime: 0,
  speed: 1,
  duration: 3600, // 1時間
  network: {
    isNetworkSimulationRunning: false,
    networkSimulationId: null,
    networkData: null,
    validationResult: null,
    productionSummary: null,
    schedulingAnalysis: null,
    networkPerformance: null,
  },
  
  // 新しく追加する初期値
  status: null,
  config: null,
  realtimeData: null,
  events: [],
  loading: false,
  error: null,
  selectedNode: null,
  selectedEdge: null,
  activeTab: 0,
  webSocketStatus: false,
};

// シミュレーション開始
export const startDetailedSimulation = createAsyncThunk(
  'simulation/startDetailedSimulation',
  async (config: SimulationConfig) => {
    try {
      const response = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`シミュレーション開始に失敗しました: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`シミュレーション開始エラー: ${error.message}`);
    }
  }
);

// シミュレーション停止
export const stopDetailedSimulation = createAsyncThunk(
  'simulation/stopDetailedSimulation',
  async () => {
    try {
      const response = await fetch('/api/simulation/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`シミュレーション停止に失敗しました: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`シミュレーション停止エラー: ${error.message}`);
    }
  }
);

// シミュレーション一時停止
export const pauseDetailedSimulation = createAsyncThunk(
  'simulation/pauseDetailedSimulation',
  async () => {
    try {
      const response = await fetch('/api/simulation/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`シミュレーション一時停止に失敗しました: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`シミュレーション一時停止エラー: ${error.message}`);
    }
  }
);

// シミュレーション状況取得
export const fetchSimulationStatus = createAsyncThunk(
  'simulation/fetchSimulationStatus',
  async () => {
    try {
      const response = await fetch('/api/simulation/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`状況取得に失敗しました: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(`状況取得エラー: ${error.message}`);
    }
  }
);

export const fetchRealtimeData = createAsyncThunk(
  'simulation/fetchRealtimeData',
  async (simulationId: string) => {
    const response = await fetch(`/api/simulation/${simulationId}/realtime`);
    
    if (!response.ok) {
      throw new Error('リアルタイムデータの取得に失敗しました');
    }
    
    return await response.json();
  }
);

const simulationSlice = createSlice({
  name: 'simulation',
  initialState,
  reducers: {
    // 既存のアクション
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
    
    // 既存のネットワークシミュレーション用のアクション
    startNetworkSimulation: (state, action: PayloadAction<{ id: string; data: any }>) => {
      state.network.isNetworkSimulationRunning = true;
      state.network.networkSimulationId = action.payload.id;
      state.network.networkData = action.payload.data;
    },
    stopNetworkSimulation: (state) => {
      state.network.isNetworkSimulationRunning = false;
      state.network.networkSimulationId = null;
    },
    setNetworkValidationResult: (state, action: PayloadAction<any>) => {
      state.network.validationResult = action.payload;
    },
    setNetworkProductionSummary: (state, action: PayloadAction<any>) => {
      state.network.productionSummary = action.payload;
    },
    setNetworkSchedulingAnalysis: (state, action: PayloadAction<any>) => {
      state.network.schedulingAnalysis = action.payload;
    },
    setNetworkPerformance: (state, action: PayloadAction<any>) => {
      state.network.networkPerformance = action.payload;
    },
    setNetworkData: (state, action: PayloadAction<any>) => {
      state.network.networkData = action.payload;
    },
    
    // 新しく追加するアクション
    // リアルタイムデータの更新（WebSocketから受信）
    updateRealtimeData: (state, action: PayloadAction<Partial<RealtimeData>>) => {
      if (state.realtimeData) {
        state.realtimeData = { ...state.realtimeData, ...action.payload };
      }
    },
    
    // 特定ノードの状態更新
    updateNodeStatus: (state, action: PayloadAction<ProcessNodeStatus>) => {
      if (state.realtimeData) {
        state.realtimeData.nodes[action.payload.id] = action.payload;
        state.realtimeData.overall.lastUpdate = new Date().toISOString();
      }
    },
    
    // 特定エッジの状態更新
    updateEdgeStatus: (state, action: PayloadAction<TransportEdgeStatus>) => {
      if (state.realtimeData) {
        state.realtimeData.edges[action.payload.id] = action.payload;
        state.realtimeData.overall.lastUpdate = new Date().toISOString();
      }
    },
    
    // イベントの追加
    addEvent: (state, action: PayloadAction<SimulationEvent>) => {
      state.events.unshift(action.payload);
      // イベント数が1000を超えた場合は古いものを削除
      if (state.events.length > 1000) {
        state.events = state.events.slice(0, 1000);
      }
    },
    
    // 選択されたノードの設定
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNode = action.payload;
      if (action.payload) {
        state.selectedEdge = null;
      }
    },
    
    // 選択されたエッジの設定
    setSelectedEdge: (state, action: PayloadAction<{ id: string; type: string } | null>) => {
      state.selectedEdge = action.payload;
      if (action.payload) {
        state.selectedNode = null;
      }
    },
    
    // アクティブタブの設定
    setActiveTab: (state, action: PayloadAction<number>) => {
      state.activeTab = action.payload;
    },
    
    // エラーのクリア
    clearError: (state) => {
      state.error = null;
    },
    
    // イベントのクリア
    clearEvents: (state) => {
      state.events = [];
    },
    
    // WebSocket接続状態の更新
    setWebSocketStatus: (state, action: PayloadAction<boolean>) => {
      state.webSocketStatus = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // startDetailedSimulation
      .addCase(startDetailedSimulation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startDetailedSimulation.fulfilled, (state, action) => {
        state.loading = false;
        state.config = action.payload.config;
        // イベントを追加
        state.events.unshift({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `シミュレーション開始: ${action.payload.simulation_id}`,
        });
      })
      .addCase(startDetailedSimulation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'シミュレーションの開始に失敗しました';
        // エラーイベントを追加
        state.events.unshift({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'error',
          message: action.error.message || 'シミュレーションの開始に失敗しました',
        });
      })
      
      // stopDetailedSimulation
      .addCase(stopDetailedSimulation.pending, (state) => {
        state.loading = true;
      })
      .addCase(stopDetailedSimulation.fulfilled, (state) => {
        state.loading = false;
        // イベントを追加
        state.events.unshift({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'info',
          message: 'シミュレーションが停止されました',
        });
      })
      .addCase(stopDetailedSimulation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'シミュレーションの停止に失敗しました';
      })
      
      // pauseDetailedSimulation
      .addCase(pauseDetailedSimulation.fulfilled, (state) => {
        // イベントを追加
        state.events.unshift({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'warning',
          message: 'シミュレーションが一時停止されました',
        });
      })
      
      // fetchSimulationStatus
      .addCase(fetchSimulationStatus.fulfilled, (state, action) => {
        state.status = action.payload;
      })
      
      // fetchRealtimeData
      .addCase(fetchRealtimeData.fulfilled, (state, action) => {
        state.realtimeData = action.payload;
      });
  },
});

export const {
  // 既存のアクション
  startSimulation,
  pauseSimulation,
  stopSimulation,
  setCurrentTime,
  setSpeed,
  setDuration,
  startNetworkSimulation,
  stopNetworkSimulation,
  setNetworkValidationResult,
  setNetworkProductionSummary,
  setNetworkSchedulingAnalysis,
  setNetworkPerformance,
  setNetworkData,
  
  // 新しく追加するアクション
  updateRealtimeData,
  updateNodeStatus,
  updateEdgeStatus,
  addEvent,
  setSelectedNode,
  setSelectedEdge,
  setActiveTab,
  clearError,
  clearEvents,
  setWebSocketStatus,
} = simulationSlice.actions;

export default simulationSlice.reducer;