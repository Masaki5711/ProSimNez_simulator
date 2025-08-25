// 混流生産ライン用の型定義

/**
 * 製品・部品の基本情報
 */
export interface Product {
  id: string;
  name: string;
  code: string;
  type: 'raw_material' | 'component' | 'sub_assembly' | 'finished_product' | 'defective_product';
  version: string;
  description?: string;
  unitCost: number;
  leadTime: number; // 調達・製造リードタイム
  supplier?: string;
  storageConditions?: string;
  isDefective?: boolean; // 不良品かどうか
  originalProductId?: string; // 元製品ID（不良品の場合）
  qualityGrade?: string; // 品質グレード
}

/**
 * 部品の基本情報
 */
export interface Component {
  id: string;
  name: string;
  code: string;
  type: 'raw_material' | 'component' | 'sub_assembly' | 'finished_product' | 'defective_product';
  version: string;
  description: string;
  unitCost: number;
  leadTime: number;
  supplier: string;
  storageConditions: string;
  isDefective: boolean;
  originalProductId?: string;
  qualityGrade: string;
  category: string;
  unit: string;
  specifications: Record<string, any>;
  bomItems: ComponentBOMItem[];
  transportLotSize: number; // 搬送ロットサイズ
  createdAt: string;
  updatedAt: string;
}

/**
 * 部品BOMアイテム
 */
export interface ComponentBOMItem {
  id: string;
  parentProductId: string;
  childProductId: string;
  quantity: number;
  unit: string;
  position?: string;
  isOptional: boolean;
  effectiveDate: string; // ISO文字列として保存
  expiryDate?: string; // ISO文字列として保存
  alternativeProducts: string[];
  notes: string;
}

/**
 * 部品カテゴリ
 */
export interface ComponentCategory {
  id: string;
  name: string;
  description: string;
  parentId?: string;
}

/**
 * BOM（部品構成表）のアイテム
 */
export interface BOMItem {
  id: string;
  parentProductId: string;  // 親製品ID
  childProductId: string;   // 子部品ID
  quantity: number;         // 使用数量
  unit: string;            // 単位（個、kg、m等）
  position?: string;       // 取り付け位置
  isOptional: boolean;     // オプション部品かどうか
  effectiveDate: string;   // 有効開始日（ISO文字列）
  expiryDate?: string;     // 有効終了日（ISO文字列）
  alternativeProducts?: string[]; // 代替部品ID
  notes?: string;
}

/**
 * 製品バリエーション
 */
export interface ProductVariant {
  id: string;
  baseProductId: string;
  variantName: string;
  variantCode: string;
  bom: BOMItem[];
  routingId: string;       // 生産工程ルートID
  setupRequirements: SetupRequirement[];
  demand: DemandInfo;
}

/**
 * 段取り要件
 */
export interface SetupRequirement {
  id: string;
  processId: string;
  fromVariant?: string;    // 前製品（初回はnull）
  toVariant: string;       // 後製品
  setupTime: number;       // 段取り時間（分）
  setupCost: number;       // 段取りコスト
  requiredTools: string[]; // 必要工具
  requiredSkills: string[]; // 必要スキル
  setupSteps: SetupStep[];
}

/**
 * 段取り手順
 */
export interface SetupStep {
  stepNumber: number;
  description: string;
  estimatedTime: number;   // 予想時間（分）
  requiredPersonnel: number; // 必要人数
  safetyNotes?: string;
}

/**
 * 需要情報
 */
export interface DemandInfo {
  dailyDemand: number;
  weeklyPattern: number[]; // 曜日別需要パターン（月曜=0）
  seasonality: number;     // 季節係数
  priority: 'high' | 'medium' | 'low';
  customerOrders: CustomerOrder[];
}

/**
 * 顧客注文
 */
export interface CustomerOrder {
  orderId: string;
  customerId: string;
  productVariantId: string;
  quantity: number;
  dueDate: Date;
  priority: number;
  specialRequirements?: string;
}

/**
 * 拡張された工程データ
 */
export interface AdvancedProcessData {
  // 基本情報（既存）
  id: string;
  label: string;
  type: 'machining' | 'assembly' | 'inspection' | 'storage' | 'shipping' | 'kitting' | 'store';
  
  // 処理能力
  cycleTime: number;
  setupTime: number;
  equipmentCount: number;
  operatorCount: number;
  availability: number;
  
  // BOM関連
  inputMaterials: MaterialInput[];    // 投入部品・材料
  outputProducts: ProductOutput[];    // 出力製品
  bomMappings: BOMMapping[];          // BOM変換ルール
  
  // スケジューリング（工程全体の設定）
  schedulingMode: 'push' | 'pull' | 'hybrid';
  batchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  kanbanSettings?: KanbanSettings;
  
  // 品質・コスト
  defectRate: number;
  reworkRate: number;
  operatingCost: number;
  qualityCheckpoints: QualityCheckpoint[];
  
  // 制約条件
  skillRequirements: string[];
  toolRequirements: string[];
  capacityConstraints: CapacityConstraint[];
  
  // 状態管理
  currentSetup?: string;              // 現在の段取り（製品ID）
  nextScheduledProduct?: string;      // 次回予定製品
  setupHistory: SetupHistory[];
}

/**
 * 材料投入定義
 */
export interface MaterialInput {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  unit: string;
  timing: 'start' | 'middle' | 'end'; // 投入タイミング
  qualitySpec: QualitySpecification;
  storageLocation: string;
  supplyMethod: 'manual' | 'automated' | 'kanban';
  sourceProcessId?: string; // 材料の供給元工程ID（自動継承の追跡用）
  isAutoInherited?: boolean; // 自動継承された材料かどうか
  isDefective?: boolean; // 不良品かどうか
  qualityGrade?: string; // 品質グレード
  originalProductId?: string; // 元製品ID（不良品の場合）
  _isPlaceholder?: boolean; // プレースホルダーフラグ（データ読み込み中）
  
  // 部品ごとのスケジューリング設定
  schedulingMode: 'push' | 'pull' | 'hybrid';
  batchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  
  // 部品ごとのかんばん設定
  kanbanSettings?: {
    enabled: boolean;
    cardCount: number;
    reorderPoint: number;
    maxInventory: number;
    supplierLeadTime: number;
    kanbanType: 'production' | 'withdrawal' | 'supplier';
  };
  
  // 部品ごとのバッファー設定（ロットサイズベース）
  bufferSettings: {
    enabled: true;             // 常に有効
    inputBufferId?: string;    // 入力バッファーID
    outputBufferId?: string;   // 出力バッファーID
    initialStock: number;      // 初期在庫数（ロットサイズの倍数または0）
    safetyStock: number;       // 安全在庫数（ロットサイズの倍数）
    maxLots: number;           // 最大ロット数（容量はlotSize * maxLots）
    bufferType: 'input' | 'output' | 'both'; // バッファータイプ
    location?: string;         // バッファー位置
    notes?: string;            // 備考
  };
}

/**
 * 製品出力定義
 */
export interface ProductOutput {
  productId: string;
  productName: string;
  outputQuantity: number;
  unit: string;
  qualityLevel: string;
  setupTime: number; // 段取り時間（分）
  cycleTime: number; // サイクルタイム（秒）
  packagingSpec?: PackagingSpecification;
  _isPlaceholder?: boolean; // プレースホルダーフラグ（データ読み込み中）
  
  // 出力製品ごとのバッファー設定（ロットサイズベース）
  bufferSettings: {
    enabled: true;                 // 常に有効
    outputBufferId?: string;       // 出力バッファーID
    initialStock: number;          // 初期在庫数（ロットサイズの倍数または0）
    safetyStock: number;           // 安全在庫数（ロットサイズの倍数）
    maxLots: number;               // 最大ロット数（容量はlotSize * maxLots）
    bufferType: 'output' | 'both'; // バッファータイプ（出力は'output'または'both'のみ）
    location?: string;             // バッファー位置
    notes?: string;                // 備考
  };
}

/**
 * BOM変換ルール
 */
export interface BOMMapping {
  id: string;
  inputVariantId: string;
  outputVariantId: string;
  transformationRules: TransformationRule[];
  yieldRate: number; // 歩留まり率
}

/**
 * 変換ルール
 */
export interface TransformationRule {
  operation: 'assemble' | 'disassemble' | 'modify' | 'inspect';
  inputComponents: ComponentUsage[];
  outputComponents: ComponentUsage[];
  operationTime: number;
  skillRequired: string;
}

/**
 * コンポーネント使用量
 */
export interface ComponentUsage {
  componentId: string;
  quantity: number;
  unit: string;
  qualityGrade?: string;
}

/**
 * かんばん設定
 */
export interface KanbanSettings {
  enabled: boolean;
  cardCount: number;
  reorderPoint: number;
  maxInventory: number;
  supplierLeadTime: number;
  kanbanType: 'production' | 'withdrawal' | 'supplier';
}

/**
 * 品質チェックポイント
 */
export interface QualityCheckpoint {
  id: string;
  name: string;
  timing: 'pre_process' | 'in_process' | 'post_process';
  checkType: 'dimensional' | 'visual' | 'functional' | 'material';
  specification: QualitySpecification;
  samplingRate: number; // サンプリング率（%）
}

/**
 * 品質仕様
 */
export interface QualitySpecification {
  parameter: string;
  targetValue: number;
  upperLimit: number;
  lowerLimit: number;
  unit: string;
  measurementMethod: string;
}

/**
 * 梱包仕様
 */
export interface PackagingSpecification {
  packageType: string;
  unitsPerPackage: number;
  packageWeight: number;
  packageDimensions: {
    length: number;
    width: number;
    height: number;
  };
  specialHandling?: string;
}

/**
 * 能力制約
 */
export interface CapacityConstraint {
  type: 'time' | 'resource' | 'space' | 'energy';
  parameter: string;
  maxCapacity: number;
  unit: string;
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

/**
 * 段取り履歴
 */
export interface SetupHistory {
  timestamp: Date;
  fromProduct?: string;
  toProduct: string;
  actualSetupTime: number;
  plannedSetupTime: number;
  operator: string;
  issues?: string[];
  efficiency: number; // 段取り効率
}

/**
 * 生産スケジュール
 */
export interface ProductionSchedule {
  id: string;
  processId: string;
  productVariantId: string;
  plannedStartTime: Date;
  plannedEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  quantity: number;
  priority: number;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  dependencies: string[]; // 依存する他のスケジュールID
  resources: ResourceAllocation[];
}

/**
 * ストア用の生産スケジュール（簡易版）
 */
export interface StoreProductionSchedule {
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
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
}

/**
 * ストアスケジュール用の生産スケジュール（StoreScheduleDialog用）
 */
export interface StoreScheduleProductionSchedule {
  id: string;
  productId: string;
  productName: string;
  targetQuantity: number;
  startTime: string;
  endTime: string;
  priority: 'low' | 'medium' | 'high';
  shiftPattern: 'day_shift' | 'night_shift' | 'flexible';
  demandPattern: 'constant' | 'variable' | 'seasonal';
}

/**
 * リソース割り当て
 */
export interface ResourceAllocation {
  resourceType: 'equipment' | 'operator' | 'material' | 'tool';
  resourceId: string;
  allocatedQuantity: number;
  allocationStart: Date;
  allocationEnd: Date;
  utilizationRate: number;
}

/**
 * 在庫管理
 */
export interface Inventory {
  productId: string;
  locationId: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unit: string;
  lastUpdated: Date;
  reorderPoint: number;
  maxStock: number;
  lotTracking: LotInfo[];
}

/**
 * ロット情報
 */
export interface LotInfo {
  lotNumber: string;
  quantity: number;
  manufactureDate: Date;
  expiryDate?: Date;
  qualityStatus: 'ok' | 'quarantine' | 'rejected';
  location: string;
  supplier?: string;
}

/**
 * 混流生産ライン設定
 */
export interface MixedModelLineConfig {
  lineId: string;
  lineName: string;
  processes: AdvancedProcessData[];
  supportedVariants: string[];
  cycleTimeTarget: number; // タクトタイム
  changoverMatrix: ChangeoverMatrix;
  levelingRules: LevelingRule[];
  bufferSizes: Record<string, number>;
}

/**
 * 段取り時間マトリクス
 */
export interface ChangeoverMatrix {
  [fromVariant: string]: {
    [toVariant: string]: number; // 段取り時間
  };
}

/**
 * 平準化ルール
 */
export interface LevelingRule {
  ruleType: 'sequence' | 'ratio' | 'time_window';
  variantIds: string[];
  ratio?: number[];
  timeWindow?: number; // 分
  constraint: string;
}

/**
 * 生産実績
 */
export interface ProductionResult {
  scheduleId: string;
  processId: string;
  productVariantId: string;
  actualQuantity: number;
  goodQuantity: number;
  defectQuantity: number;
  reworkQuantity: number;
  actualCycleTime: number;
  actualSetupTime: number;
  startTime: Date;
  endTime: Date;
  operatorIds: string[];
  qualityResults: QualityResult[];
  issues: ProductionIssue[];
}

/**
 * 品質結果
 */
export interface QualityResult {
  checkpointId: string;
  measured: number;
  specification: QualitySpecification;
  result: 'pass' | 'fail' | 'warning';
  inspector: string;
  timestamp: Date;
}

/**
 * 生産問題
 */
export interface ProductionIssue {
  issueType: 'quality' | 'equipment' | 'material' | 'operator';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  downtime: number; // 停止時間（分）
  resolution?: string;
  timestamp: Date;
}

/**
 * KPI定義
 */
export interface ProductionKPI {
  oee: number;           // 総合効率
  availability: number;   // 可動率
  performance: number;    // 性能稼働率
  quality: number;        // 品質稼働率
  throughput: number;     // スループット
  cycleTimeVariance: number; // サイクルタイム分散
  setupEfficiency: number;   // 段取り効率
  materialUtilization: number; // 材料利用率
  energyConsumption: number;  // エネルギー消費
}

/**
 * 混流分析結果
 */
export interface MixedModelAnalysis {
  lineBalance: number;
  bottleneckProcess: string;
  changoverFrequency: number;
  averageSetupTime: number;
  variantMix: Record<string, number>;
  kpis: ProductionKPI;
  recommendations: Recommendation[];
}

/**
 * 改善提案
 */
export interface Recommendation {
  type: 'equipment' | 'layout' | 'scheduling' | 'inventory' | 'quality';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedBenefit: string;
  implementationCost: number;
  implementationTime: number; // 実装時間（日）
  kpiImpact: Partial<ProductionKPI>;
}