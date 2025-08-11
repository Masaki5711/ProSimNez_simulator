// 工程ネットワークエディタの型定義

export interface ProcessNodeData {
  // 基本情報
  id?: string;                 // ノードID
  label: string;               // 表示名
  name?: string;               // バックエンド用の名前
  type: 'machining' | 'assembly' | 'inspection' | 'storage' | 'shipping' | 'store';
  
  // IE指標
  cycleTime: number;            // サイクルタイム（秒）
  setupTime: number;            // 段取り時間（秒）- 出力製品が未設定の場合のデフォルト値
  equipmentCount: number;       // 設備台数
  operatorCount: number;        // 作業者数
  
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

  // ストア固有の設定
  storeType?: 'finished_product' | 'component'; // ストアの種類
  productionSchedule?: ProductionScheduleItem[]; // 生産計画
  inventoryLevels?: InventoryLevel[]; // 在庫レベル
}

// ストア用の生産計画アイテム
export interface ProductionScheduleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  priority: number;
  sequence: number; // 製造順序
  startTime?: string; // 開始時刻（HH:MM形式）
  endTime?: string;   // 終了時刻（HH:MM形式）
  isActive: boolean;
}

// ストア用の在庫レベル
export interface InventoryLevel {
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  reorderPoint: number;
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

  // 複数搬送手段の管理
  transportMethods?: TransportMethod[];
}

// 搬送手段の定義
export interface TransportMethod {
  id: string;                    // 一意ID
  name: string;                  // 搬送手段名
  type: 'conveyor' | 'agv' | 'manual' | 'forklift' | 'tugger' | 'crane';
  transportTime: number;         // 搬送時間（秒）
  transportCost: number;         // 搬送コスト（回あたり）
  maxCapacity: number;           // 最大搬送能力（個/時間）
  priority: number;              // 優先度（1が最高）
  isActive: boolean;             // 有効/無効
  
  // 搬送キャパシティ（一度に搬送できる総ロット数）
  transportCapacity: number;
  
  // 搬送指示の設定
  transportInstruction: {
    type: 'process' | 'push' | 'pull' | 'kanban';  // 搬送指示の種類
    frequency?: number;          // 搬送頻度（分間隔、type=processの場合）
    schedule?: string[];         // 搬送時刻（HH:MM形式、type=processの場合）
  };
  
  // 搬送部品の設定
  transportProducts: TransportProduct[];
}

// 搬送部品の定義
export interface TransportProduct {
  id: string;                    // 一意ID
  productId: string;             // 製品ID
  productName: string;           // 製品名
  lotSize: number;               // ロットサイズ（1ロットあたりの個数）
  priority: number;              // 優先度（1が最高）
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
    setupTime: 180,
    equipmentCount: 1,
    operatorCount: 1,
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
    inputBufferCapacity: 200,
    outputBufferCapacity: 0,
    defectRate: 0,
    reworkRate: 0,
    operatingCost: 200,
    frequencyTasks: [],
  },
};