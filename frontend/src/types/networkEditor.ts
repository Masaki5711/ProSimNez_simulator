// 工程ネットワークエディタの型定義

export interface ProcessNodeData {
  // 基本情報
  label: string;               // 表示名
  name?: string;               // バックエンド用の名前
  type: 'machining' | 'assembly' | 'inspection' | 'storage' | 'shipping';
  
  // IE指標
  cycleTime: number;            // サイクルタイム（秒）
  setupTime: number;            // 段取り時間（秒）
  equipmentCount: number;       // 設備台数
  operatorCount: number;        // 作業者数
  availability: number;         // 可動率（%）
  
  // バッファ設定
  inputBufferCapacity: number;  // 入力バッファ容量
  outputBufferCapacity: number; // 出力バッファ容量
  
  // 品質
  defectRate: number;          // 不良率（%）
  reworkRate: number;          // 手直し率（%）
  
  // コスト
  operatingCost: number;       // 時間あたり運転コスト
  
  // 部品・製品の流れ
  inputs: string[];            // 入力部品ID
  outputs: string[];           // 出力製品ID

  // 頻度作業（定期・確率）
  frequencyTasks?: FrequencyTask[]; // 工程で一定間隔/確率で発生する作業
  
  // 状態（シミュレーション時）
  status?: 'idle' | 'running' | 'blocked' | 'breakdown';
  currentWIP?: number;         // 現在の仕掛品数
  utilization?: number;        // 稼働率
}

// 頻度作業の定義
export interface FrequencyTask {
  id: string;                         // 一意ID
  name: string;                       // 作業名
  taskType: 'interval' | 'probabilistic'; // 発生タイプ
  intervalSeconds?: number;           // 発生間隔（秒） taskType=interval の時
  probability?: number;               // 発生確率（0-1） taskType=probabilistic の時
  checkIntervalSeconds?: number;      // 発生判定のチェック周期（秒） taskType=probabilistic の時
  durationSeconds: number;            // 所要時間（秒）
  requiresStop?: boolean;             // ライン停止が必要か
}

export interface ConnectionData {
  // 搬送設定
  transportTime: number;       // 搬送時間（秒）
  transportLotSize: number;    // 搬送ロットサイズ
  transportCost: number;       // 搬送コスト（回あたり）
  distance: number;            // 距離（メートル）
  
  // 搬送方式
  transportType: 'conveyor' | 'agv' | 'manual' | 'forklift';
  
  // 制約
  maxCapacity?: number;        // 最大搬送能力（個/時間）
}

export interface LayoutMetrics {
  totalDistance: number;       // 総移動距離
  crossings: number;          // 交差数
  backflows: number;          // 逆流数
  efficiency: number;         // レイアウト効率
}

export interface IEAnalysisResult {
  bottleneckProcess: string;   // ボトルネック工程
  lineBalanceRate: number;     // ラインバランス率
  totalLeadTime: number;       // 総リードタイム
  valueAddedRatio: number;     // 付加価値比率
  overallEfficiency: number;   // 総合効率
}

// ノードテンプレート
export const nodeTemplates = {
  machining: {
    name: '機械加工',
    type: 'machining' as const,
    cycleTime: 60,
    setupTime: 300,
    equipmentCount: 1,
    operatorCount: 1,
    availability: 85,
    inputBufferCapacity: 50,
    outputBufferCapacity: 50,
    defectRate: 2,
    reworkRate: 1,
    operatingCost: 100,
    frequencyTasks: [],
  },
  assembly: {
    name: '組立',
    type: 'assembly' as const,
    cycleTime: 120,
    setupTime: 600,
    equipmentCount: 1,
    operatorCount: 2,
    availability: 90,
    inputBufferCapacity: 30,
    outputBufferCapacity: 30,
    defectRate: 1,
    reworkRate: 0.5,
    operatingCost: 150,
    frequencyTasks: [],
  },
  inspection: {
    name: '検査',
    type: 'inspection' as const,
    cycleTime: 30,
    setupTime: 60,
    equipmentCount: 1,
    operatorCount: 1,
    availability: 95,
    inputBufferCapacity: 20,
    outputBufferCapacity: 20,
    defectRate: 0,
    reworkRate: 0,
    operatingCost: 80,
    frequencyTasks: [],
  },
  storage: {
    name: '保管',
    type: 'storage' as const,
    cycleTime: 10,
    setupTime: 0,
    equipmentCount: 1,
    operatorCount: 0,
    availability: 100,
    inputBufferCapacity: 1000,
    outputBufferCapacity: 1000,
    defectRate: 0,
    reworkRate: 0,
    operatingCost: 20,
    frequencyTasks: [],
  },
  shipping: {
    name: '出荷',
    type: 'shipping' as const,
    cycleTime: 300,
    setupTime: 1800,
    equipmentCount: 1,
    operatorCount: 3,
    availability: 95,
    inputBufferCapacity: 200,
    outputBufferCapacity: 0,
    defectRate: 0,
    reworkRate: 0,
    operatingCost: 200,
    frequencyTasks: [],
  },
};