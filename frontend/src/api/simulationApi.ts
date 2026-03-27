import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

export interface SimulationConfig {
  start_time: string;
  duration?: number; // 秒単位
  duration_minutes?: number; // 分単位
  speed: number;
  network_data?: any; // ネットワークエディターからのデータ
}

export interface SimulationStatus {
  status: string;
  current_time: string;
  speed: number;
  is_running: boolean;
}

export interface SimulationData {
  inventories: Record<string, any>;
  equipment_states: Record<string, any>;
  kpis: {
    totalProduction: number;
    averageLeadTime: number;
    equipmentUtilization: number;
    inventoryTurnover: number;
  };
  timestamp: string;
}

export interface Phase2TestReport {
  filename: string;
  filepath: string;
  size: number;
  created_at: string;
  modified_at: string;
}

export const simulationApi = {
  // シミュレーション開始
  async start(config: SimulationConfig) {
    const response = await api.post('/simulation/start', config);
    return response.data;
  },

  // シミュレーション一時停止
  async pause() {
    const response = await api.post('/simulation/pause');
    return response.data;
  },

  // シミュレーション再開
  async resume() {
    const response = await api.post('/simulation/resume');
    return response.data;
  },

  // シミュレーション停止
  async stop(): Promise<{ message: string; status: string; report_path?: string; html_report_path?: string }> {
    const response = await api.post('/simulation/stop');
    return response.data;
  },

  // シミュレーション状態取得
  async getStatus(): Promise<SimulationStatus> {
    const response = await api.get('/simulation/status');
    return response.data;
  },

  // シミュレーション速度設定
  async setSpeed(speed: number) {
    const response = await api.post('/simulation/speed', null, {
      params: { speed }
    });
    return response.data;
  },

  // シミュレーションデータ取得
  async getData(): Promise<SimulationData> {
    const response = await api.get('/simulation/data');
    return response.data;
  },

  // フェーズ２テストレポート一覧取得
  async getPhase2Reports(): Promise<{ reports: Phase2TestReport[] }> {
    const response = await api.get('/simulation/reports');
    return response.data;
  },

  // フェーズ２テストレポートダウンロード
  async downloadPhase2Report(filename: string): Promise<void> {
    const response = await api.get(`/simulation/reports/download/${filename}`, {
      responseType: 'blob'
    });
    
    // ブラウザでファイルダウンロードを実行
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // フェーズ２テストレポート削除
  async deletePhase2Report(filename: string) {
    const response = await api.delete(`/simulation/reports/${filename}`);
    return response.data;
  },
};

export const networkApi = {
  // サンプルネットワーク取得
  async getSample() {
    const response = await api.get('/network/sample');
    return response.data;
  },

  // ネットワーク保存
  async save(networkData: any) {
    const response = await api.post('/network/save', { factory: networkData });
    return response.data;
  },

  // ネットワーク読み込み
  async load() {
    const response = await api.get('/network/load');
    return response.data;
  },

  // ネットワーク検証
  async validate(networkData: any) {
    const response = await api.get('/network/validate', { 
      data: { factory: networkData }
    });
    return response.data;
  },

  // テンプレート一覧取得
  async getTemplates() {
    const response = await api.get('/network/templates');
    return response.data;
  },
};

// ネットワークシミュレーション用のAPI関数
export const networkSimulationApi = {
  // サンプルネットワークデータの取得
  getSampleData: async () => {
    const response = await api.get('/simulation/network-simulation/sample-data');
    return response.data;
  },

  // ネットワークデータの検証
  validateNetworkData: async (networkData: any) => {
    const response = await api.post('/simulation/network-simulation/validate', networkData);
    return response.data;
  },

  // ネットワークシミュレーションの開始（REST API経由）
  startNetworkSimulation: async (config: {
    start_time: string;
    duration: number;
    network_data: any;
    enable_scheduling_control: boolean;
    enable_real_time_update: boolean;
  }) => {
    const response = await api.post('/simulation/start-network-simulation', config);
    return response.data;
  },

  // EnhancedSimulatorを使用したシミュレーション開始（ネットワークデータ付き）
  startWithNetworkData: async (config: {
    start_time: string;
    duration: number;
    speed: number;
    network_data: any;
  }) => {
    const response = await api.post('/simulation/start', config);
    return response.data;
  },

  // ネットワークシミュレーションの状態取得
  getNetworkSimulationStatus: async () => {
    const response = await api.get('/simulation/network-simulation/status');
    return response.data;
  },

  // ネットワークシミュレーションの停止
  stopNetworkSimulation: async () => {
    const response = await api.post('/simulation/network-simulation/stop');
    return response.data;
  },

  // ネットワークシミュレーション結果の取得
  getNetworkSimulationResults: async () => {
    const response = await api.get('/simulation/network-simulation/results');
    return response.data;
  },
};