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
  
  // バッファ容量
  inputBufferCapacity?: number;   // 入力バッファ容量（個）
  outputBufferCapacity?: number;  // 出力バッファ容量（個）

  // 材料設定（ProcessMaterialDialog形式）
  inputMaterials?: any[];         // 投入材料リスト
  outputProducts?: any[];         // 出力製品リスト
  schedulingMode?: 'push' | 'pull' | 'hybrid';  // スケジューリング方式
  batchSize?: number;             // バッチサイズ
  
  // 品質管理設定
  qualitySettings?: QualitySettings;
  
  // 出力分岐設定
  outputBranches?: OutputBranch[];
  
  // 生産制御設定
  schedulingSettings?: SchedulingSettings;
  
  // 部品・製品の流れ
  inputs: string[];            // 入力部品ID
  outputs: string[];           // 出力製品ID

  // 製品固有設定
  productSettings?: ProductSetting[];
  
  // 状態（シミュレーション時）
  status?: 'idle' | 'running' | 'blocked' | 'breakdown';
  currentWIP?: number;         // 現在の仕掛品数
  utilization?: number;        // 稼働率

  // ストア固有の設定
  storeType?: 'finished_product' | 'component'; // ストアの種類
  storeScheduleConfig?: StoreScheduleConfig; // ストアスケジュール設定
  productionSchedule?: ProductionScheduleItem[]; // 生産計画
  inventoryLevels?: InventoryLevel[]; // 在庫レベル
  workingHours?: WorkingHours[]; // 稼働時間
  
  // 品質指標（直接プロパティとしても定義）
  defectRate?: number;         // 不良率（%）
  reworkRate?: number;         // 手直し率（%）
  scrapRate?: number;          // 廃棄率（%）
  
  // コスト・効率指標
  operatingCost?: number;      // 運転コスト
  
  // ストア固有の在庫管理設定
  capacity?: number;           // 最大容量
  safetyStock?: number;        // 安全在庫
  reorderPoint?: number;       // 発注点
  autoReplenishment?: boolean; // 自動補充
  
  // スケジューリング制御フラグ
  enableSchedulingControl?: boolean; // スケジューリング制御有効化
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

// 品質管理設定
export interface QualitySettings {
  defectRate: number;          // 不良率（%）
  reworkRate: number;          // 手直し率（%）
  scrapRate: number;           // 廃棄率（%）
  inspectionTime: number;      // 検査時間（秒）
  inspectionCapacity: number;  // 検査能力（個/時）
}

// 出力分岐設定
export interface OutputBranch {
  id: string;
  name: string;
  type: 'good' | 'defective' | 'rework' | 'scrap';
  percentage: number;
  targetNodeId: string;
  condition: string;
  priority: number;
}

// 生産制御設定
export interface SchedulingSettings {
  mode: 'push' | 'pull' | 'kanban';
  batchSize: number;
  leadTime: number;
  kanbanCards: number;
  pushThreshold: number;
  pullSignal: string;
}

// 製品固有設定
export interface ProductSetting {
  id: string;
  productId: string;
  productName: string;
  cycleTime: number;           // 製品固有サイクルタイム
  setupTime: number;           // 製品固有段取り時間
  qualityRate: number;         // 良品率（%）
  isActive: boolean;
}

// 稼働時間設定
export interface WorkingHours {
  id: string;
  dayOfWeek: number;           // 0=日曜, 1=月曜, ...
  startTime: string;           // "08:00"
  endTime: string;             // "17:00"
  breakTimes: BreakTime[];     // 休憩時間
  isWorkingDay: boolean;
}

// 休憩時間
export interface BreakTime {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

// ストアスケジュール設定
export interface StoreScheduleConfig {
  storeId: string;
  storeName: string;
  storeType: string;
  capacity: number;
  safetyStock: number;
  reorderPoint: number;
  autoReplenishment: boolean;
  cycleBasedOnStore: boolean;
}

export interface ConnectionData {
  // 搬送設定
  transportTime: number;       // 搬送時間（秒）
  transportLotSize: number;    // 搬送ロットサイズ
  distance: number;            // 距離（メートル）
  
  // 搬送方式
  transportType: 'conveyor' | 'agv' | 'manual' | 'forklift' | 'tugger' | 'crane';
  
  // 搬送方式（統合設定）
  transportSettings?: TransportSettings;
  
  // 複数搬送手段の管理
  transportMethods?: TransportMethod[];
}

// 搬送設定（統合）
export interface TransportSettings {
  defaultMethod: string;           // デフォルト搬送手段ID
  enableCapacityControl: boolean;  // 容量制御有効
  enableRouting: boolean;          // ルーティング有効
  congestionHandling: 'queue' | 'reroute' | 'priority';
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
    qualitySettings: {
      defectRate: 2,
      reworkRate: 1,
      scrapRate: 0.5,
      inspectionTime: 30,
      inspectionCapacity: 60,
    },
    schedulingSettings: {
      mode: 'push',
      batchSize: 10,
      leadTime: 120,
      kanbanCards: 5,
      pushThreshold: 80,
      pullSignal: 'inventory_level',
    },
  },
  assembly: {
    name: '組立',
    type: 'assembly' as const,
    cycleTime: 120,
    setupTime: 600,
    equipmentCount: 1,
    operatorCount: 2,
    qualitySettings: {
      defectRate: 1,
      reworkRate: 0.5,
      scrapRate: 0.2,
      inspectionTime: 60,
      inspectionCapacity: 30,
    },
    schedulingSettings: {
      mode: 'pull',
      batchSize: 5,
      leadTime: 240,
      kanbanCards: 3,
      pushThreshold: 70,
      pullSignal: 'kanban_card',
    },
  },
  inspection: {
    name: '検査',
    type: 'inspection' as const,
    cycleTime: 30,
    setupTime: 180,
    equipmentCount: 1,
    operatorCount: 1,
    qualitySettings: {
      defectRate: 0,
      reworkRate: 0,
      scrapRate: 0,
      inspectionTime: 30,
      inspectionCapacity: 120,
    },
    schedulingSettings: {
      mode: 'push',
      batchSize: 1,
      leadTime: 30,
      kanbanCards: 2,
      pushThreshold: 90,
      pullSignal: 'defect_detection',
    },
  },
  storage: {
    name: '保管',
    type: 'storage' as const,
    cycleTime: 10,
    setupTime: 0,
    equipmentCount: 1,
    operatorCount: 0,
    qualitySettings: {
      defectRate: 0,
      reworkRate: 0,
      scrapRate: 0,
      inspectionTime: 0,
      inspectionCapacity: 9999,
    },
    schedulingSettings: {
      mode: 'pull',
      batchSize: 50,
      leadTime: 60,
      kanbanCards: 10,
      pushThreshold: 50,
      pullSignal: 'inventory_request',
    },
  },
  shipping: {
    name: '出荷',
    type: 'shipping' as const,
    cycleTime: 300,
    setupTime: 1800,
    equipmentCount: 1,
    operatorCount: 3,
    qualitySettings: {
      defectRate: 0,
      reworkRate: 0,
      scrapRate: 0,
      inspectionTime: 0,
      inspectionCapacity: 20,
    },
    schedulingSettings: {
      mode: 'pull',
      batchSize: 100,
      leadTime: 600,
      kanbanCards: 2,
      pushThreshold: 60,
      pullSignal: 'shipping_order',
    },
  },
};