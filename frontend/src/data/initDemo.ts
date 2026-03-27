/**
 * YAMAHA楽器組立ライン デモプロジェクト
 *
 * 製品構成（BOM）:
 *   電子ピアノ P-001
 *   ├── 筐体アセンブリ HSG-01 x1
 *   │   ├── 加工済木材パネル WD-P x2  ← 木工加工で作る
 *   │   └── プレス済金属フレーム MT-P x1 ← 金属プレスで作る
 *   ├── 検査済基板 PCB-T x1
 *   │   └── 基板アセンブリ PCB-A x1 ← SMT実装で作る
 *   │       ├── プリント基板(生) PCB-R x1
 *   │       └── ICチップ IC-001 x4
 *   └── 鍵盤ユニット KEY-01 x1（購入品・直接投入）
 *
 * 工程フロー:
 *   [部品倉庫] → [木工加工] ──→ [筐体組立] ──→ [最終組立] → [最終検査] → [完成品倉庫]
 *   [部品倉庫] → [金属プレス] ─↗                  ↑
 *   [部品倉庫] → [SMT実装] → [基板検査] ──────────┘
 *   [部品倉庫] → [最終組立]（鍵盤ユニット直送）───↗
 */
import { Project } from '../types/projectTypes';

const DEMO_PROJECT: Project = {
  id: 'demo_1',
  name: 'YAMAHA楽器組立ライン（デモ）',
  description: '電子ピアノの組立ライン。筐体加工、基板実装、最終組立の3系統が合流。',
  category: 'manufacturing',
  tags: ['デモ', '楽器', '組立', 'BOM'],
  status: 'active', version: '1.0.0', createdBy: 'system',
  createdAt: new Date().toISOString() as any,
  updatedAt: new Date().toISOString() as any,
};

// ========================================
// 製品・部品マスタ（8品目）
// ========================================
const PRODUCTS = [
  // 購入部品（部品倉庫に在庫）
  { id: 'wood_raw',   name: '木材パネル(素材)',    code: 'WD-R',  type: 'component',        unitCost: 1200, processing_time: 0 },
  { id: 'metal_raw',  name: '金属フレーム(素材)',  code: 'MT-R',  type: 'component',        unitCost: 800,  processing_time: 0 },
  { id: 'pcb_raw',    name: 'プリント基板(生)',    code: 'PCB-R', type: 'component',        unitCost: 500,  processing_time: 0 },
  { id: 'ic_chip',    name: 'ICチップ',            code: 'IC-01', type: 'component',        unitCost: 2000, processing_time: 0 },
  { id: 'key_unit',   name: '鍵盤ユニット',       code: 'KEY-01',type: 'component',        unitCost: 3000, processing_time: 0 },
  // 中間品（工程で製造）
  { id: 'wood_proc',  name: '加工済木材パネル',    code: 'WD-P',  type: 'component',        unitCost: 1500, processing_time: 25 },
  { id: 'metal_proc', name: 'プレス済金属フレーム',code: 'MT-P',  type: 'component',        unitCost: 1100, processing_time: 18 },
  { id: 'pcb_assy',   name: '基板アセンブリ',      code: 'PCB-A', type: 'sub_assembly',     unitCost: 3500, processing_time: 35 },
  { id: 'pcb_tested', name: '検査済基板',          code: 'PCB-T', type: 'sub_assembly',     unitCost: 3600, processing_time: 20 },
  { id: 'housing',    name: '筐体アセンブリ',      code: 'HSG-01',type: 'sub_assembly',     unitCost: 4000, processing_time: 50 },
  // 完成品
  { id: 'piano',      name: '電子ピアノ P-001',    code: 'P-001', type: 'finished_product', unitCost: 15000,processing_time: 120 },
];

// ========================================
// BOM構成
// ========================================
const BOM_ITEMS = [
  // 木工加工: 木材パネル(素材) x1 → 加工済木材パネル x1
  { id: 'b01', parent_product: 'wood_proc',  child_product: 'wood_raw',    quantity: 1 },
  // 金属プレス: 金属フレーム(素材) x1 → プレス済金属フレーム x1
  { id: 'b02', parent_product: 'metal_proc', child_product: 'metal_raw',   quantity: 1 },
  // SMT実装: プリント基板 x1 + ICチップ x4 → 基板アセンブリ x1
  { id: 'b03', parent_product: 'pcb_assy',   child_product: 'pcb_raw',     quantity: 1 },
  { id: 'b04', parent_product: 'pcb_assy',   child_product: 'ic_chip',     quantity: 4 },
  // 基板検査: 基板アセンブリ x1 → 検査済基板 x1（検査のみ）
  { id: 'b05', parent_product: 'pcb_tested', child_product: 'pcb_assy',    quantity: 1 },
  // 筐体組立: 加工済木材 x2 + プレス済金属 x1 → 筐体アセンブリ x1
  { id: 'b06', parent_product: 'housing',    child_product: 'wood_proc',   quantity: 2 },
  { id: 'b07', parent_product: 'housing',    child_product: 'metal_proc',  quantity: 1 },
  // 最終組立: 筐体 x1 + 検査済基板 x1 + 鍵盤 x1 → 電子ピアノ x1
  { id: 'b08', parent_product: 'piano',      child_product: 'housing',     quantity: 1 },
  { id: 'b09', parent_product: 'piano',      child_product: 'pcb_tested',  quantity: 1 },
  { id: 'b10', parent_product: 'piano',      child_product: 'key_unit',    quantity: 1 },
];

// ========================================
// ノード
// ========================================
const NODES = [
  // ── 部品倉庫（部品ストア）──
  {
    id: 'store_parts', type: 'store', position: { x: 50, y: 280 },
    data: {
      label: '部品倉庫', name: '部品倉庫', type: 'store',
      storeType: 'component', cycleTime: 5, equipmentCount: 1, operatorCount: 2,
      capacity: 5000, safetyStock: 200, reorderPoint: 500, autoReplenishment: true,
      inputs: [],
      outputs: ['wood_raw', 'metal_raw', 'pcb_raw', 'ic_chip', 'key_unit'],
      inventoryLevels: [
        { productId: 'wood_raw',  productName: '木材パネル(素材)',   currentStock: 500, minStock: 50, maxStock: 1000, unit: '個', reorderPoint: 100 },
        { productId: 'metal_raw', productName: '金属フレーム(素材)', currentStock: 500, minStock: 50, maxStock: 1000, unit: '個', reorderPoint: 100 },
        { productId: 'pcb_raw',   productName: 'プリント基板(生)',   currentStock: 300, minStock: 30, maxStock: 500,  unit: '個', reorderPoint: 60 },
        { productId: 'ic_chip',   productName: 'ICチップ',           currentStock: 1200,minStock: 100,maxStock: 2000, unit: '個', reorderPoint: 200 },
        { productId: 'key_unit',  productName: '鍵盤ユニット',      currentStock: 200, minStock: 20, maxStock: 400,  unit: '個', reorderPoint: 40 },
      ],
    },
  },

  // ── 木工加工 ──
  // IN: wood_raw x1 → OUT: wood_proc x1
  {
    id: 'proc_wood', type: 'process', position: { x: 280, y: 120 },
    data: {
      label: '木工加工', name: '木工加工', type: 'machining',
      cycleTime: 25, setupTime: 60, equipmentCount: 2, operatorCount: 2,
      inputBufferCapacity: 50, outputBufferCapacity: 20,
      defectRate: 1.5,
      inputs: ['wood_raw'], outputs: ['wood_proc'],
      productSettings: [
        { id: 'ps_wp', productId: 'wood_proc', productName: '加工済木材パネル', cycleTime: 25, setupTime: 60, qualityRate: 98.5, isActive: true },
      ],
      // ProcessMaterialDialog形式の詳細材料設定
      inputMaterials: [{
        materialId: 'wood_raw', materialName: '木材パネル(素材)',
        requiredQuantity: 1, unit: '個', timing: 'start',
        storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
        schedulingMode: 'push', batchSize: 10, minBatchSize: 5, maxBatchSize: 20,
        bufferSettings: { enabled: true, bufferType: 'input', maxLots: 5, initialStock: 25, safetyStock: 10, location: '木工加工前', notes: '' },
      }],
      outputProducts: [{
        productId: 'wood_proc', productName: '加工済木材パネル',
        outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 25, setupTime: 1,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 4, initialStock: 0, safetyStock: 0, location: '木工加工後', notes: '' },
      }],
    },
  },

  // ── 金属プレス ──
  // IN: metal_raw x1 → OUT: metal_proc x1
  {
    id: 'proc_metal', type: 'process', position: { x: 280, y: 280 },
    data: {
      label: '金属プレス', name: '金属プレス', type: 'machining',
      cycleTime: 18, setupTime: 90, equipmentCount: 2, operatorCount: 1,
      inputBufferCapacity: 50, outputBufferCapacity: 20,
      defectRate: 2.0,
      inputs: ['metal_raw'], outputs: ['metal_proc'],
      productSettings: [
        { id: 'ps_mp', productId: 'metal_proc', productName: 'プレス済金属フレーム', cycleTime: 18, setupTime: 90, qualityRate: 98.0, isActive: true },
      ],
      inputMaterials: [{
        materialId: 'metal_raw', materialName: '金属フレーム(素材)',
        requiredQuantity: 1, unit: '個', timing: 'start',
        storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
        schedulingMode: 'push', batchSize: 20, minBatchSize: 10, maxBatchSize: 50,
        bufferSettings: { enabled: true, bufferType: 'input', maxLots: 5, initialStock: 25, safetyStock: 10, location: '金属プレス前', notes: '' },
      }],
      outputProducts: [{
        productId: 'metal_proc', productName: 'プレス済金属フレーム',
        outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 18, setupTime: 1.5,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 4, initialStock: 0, safetyStock: 0, location: '金属プレス後', notes: '' },
      }],
    },
  },

  // ── 筐体組立 ──
  // IN: wood_proc x2 + metal_proc x1 → OUT: housing x1
  {
    id: 'proc_housing', type: 'process', position: { x: 530, y: 200 },
    data: {
      label: '筐体組立', name: '筐体組立', type: 'assembly',
      cycleTime: 50, setupTime: 30, equipmentCount: 2, operatorCount: 3,
      inputBufferCapacity: 30, outputBufferCapacity: 15,
      defectRate: 1.0,
      inputs: ['wood_proc', 'metal_proc'], outputs: ['housing'],
      productSettings: [
        { id: 'ps_hsg', productId: 'housing', productName: '筐体アセンブリ', cycleTime: 50, setupTime: 30, qualityRate: 99.0, isActive: true },
      ],
      inputMaterials: [
        { materialId: 'wood_proc', materialName: '加工済木材パネル',
          requiredQuantity: 2, unit: '個', timing: 'start',
          storageLocation: '木工加工出力', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'kanban', batchSize: 5, minBatchSize: 2, maxBatchSize: 10,
          kanbanSettings: { enabled: true, cardCount: 3, reorderPoint: 4, maxInventory: 15, supplierLeadTime: 1, kanbanType: 'production' as const },
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 3, initialStock: 6, safetyStock: 4, location: '筐体組立前', notes: '' },
        },
        { materialId: 'metal_proc', materialName: 'プレス済金属フレーム',
          requiredQuantity: 1, unit: '個', timing: 'start',
          storageLocation: '金属プレス出力', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'kanban', batchSize: 5, minBatchSize: 1, maxBatchSize: 10,
          kanbanSettings: { enabled: true, cardCount: 3, reorderPoint: 3, maxInventory: 10, supplierLeadTime: 1, kanbanType: 'production' as const },
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 2, initialStock: 3, safetyStock: 2, location: '筐体組立前', notes: '' },
        },
      ],
      outputProducts: [{
        productId: 'housing', productName: '筐体アセンブリ',
        outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 50, setupTime: 0.5,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 3, initialStock: 0, safetyStock: 0, location: '筐体組立後', notes: '' },
      }],
    },
  },

  // ── SMT実装 ──
  // IN: pcb_raw x1 + ic_chip x4 → OUT: pcb_assy x1
  {
    id: 'proc_smt', type: 'process', position: { x: 280, y: 440 },
    data: {
      label: '基板実装(SMT)', name: '基板実装(SMT)', type: 'machining',
      cycleTime: 35, setupTime: 180, equipmentCount: 1, operatorCount: 1,
      inputBufferCapacity: 30, outputBufferCapacity: 10,
      defectRate: 0.5,
      inputs: ['pcb_raw', 'ic_chip'], outputs: ['pcb_assy'],
      productSettings: [
        { id: 'ps_pcb', productId: 'pcb_assy', productName: '基板アセンブリ', cycleTime: 35, setupTime: 180, qualityRate: 99.5, isActive: true },
      ],
      inputMaterials: [
        { materialId: 'pcb_raw', materialName: 'プリント基板(生)',
          requiredQuantity: 1, unit: '個', timing: 'start',
          storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'push', batchSize: 5, minBatchSize: 1, maxBatchSize: 20,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 6, initialStock: 15, safetyStock: 5, location: 'SMT前', notes: '' },
        },
        { materialId: 'ic_chip', materialName: 'ICチップ',
          requiredQuantity: 4, unit: '個', timing: 'start',
          storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'push', batchSize: 20, minBatchSize: 4, maxBatchSize: 80,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 6, initialStock: 60, safetyStock: 20, location: 'SMT前', notes: 'ICは4個/基板使用' },
        },
      ],
      outputProducts: [{
        productId: 'pcb_assy', productName: '基板アセンブリ',
        outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 35, setupTime: 3,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: 'SMT後', notes: '' },
      }],
    },
  },

  // ── 基板検査 ──
  // IN: pcb_assy x1 → OUT: pcb_tested x1
  {
    id: 'proc_pcb_test', type: 'process', position: { x: 530, y: 440 },
    data: {
      label: '基板検査', name: '基板検査', type: 'inspection',
      cycleTime: 20, setupTime: 10, equipmentCount: 1, operatorCount: 1,
      inputBufferCapacity: 20, outputBufferCapacity: 10,
      defectRate: 0,
      inputs: ['pcb_assy'], outputs: ['pcb_tested'],
      productSettings: [
        { id: 'ps_pcbt', productId: 'pcb_tested', productName: '検査済基板', cycleTime: 20, setupTime: 10, qualityRate: 100, isActive: true },
      ],
      inputMaterials: [{
        materialId: 'pcb_assy', materialName: '基板アセンブリ',
        requiredQuantity: 1, unit: '個', timing: 'start',
        storageLocation: 'SMT出力', isDefective: false, qualityGrade: 'A',
        schedulingMode: 'push', batchSize: 1, minBatchSize: 1, maxBatchSize: 10,
        bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 0, safetyStock: 0, location: '基板検査前', notes: '' },
      }],
      outputProducts: [{
        productId: 'pcb_tested', productName: '検査済基板',
        outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0.2,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '基板検査後', notes: '' },
      }],
    },
  },

  // ── 最終組立 ──
  // IN: housing x1 + pcb_tested x1 + key_unit x1 → OUT: piano x1
  {
    id: 'proc_final', type: 'process', position: { x: 780, y: 280 },
    data: {
      label: '最終組立', name: '最終組立', type: 'assembly',
      cycleTime: 120, setupTime: 60, equipmentCount: 3, operatorCount: 5,
      inputBufferCapacity: 20, outputBufferCapacity: 10,
      defectRate: 0.3,
      inputs: ['housing', 'pcb_tested', 'key_unit'], outputs: ['piano'],
      productSettings: [
        { id: 'ps_piano', productId: 'piano', productName: '電子ピアノ P-001', cycleTime: 120, setupTime: 60, qualityRate: 99.7, isActive: true },
      ],
      inputMaterials: [
        { materialId: 'housing', materialName: '筐体アセンブリ',
          requiredQuantity: 1, unit: '個', timing: 'start',
          storageLocation: '筐体組立出力', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'pull', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 0, safetyStock: 1, location: '最終組立前', notes: '' },
        },
        { materialId: 'pcb_tested', materialName: '検査済基板',
          requiredQuantity: 1, unit: '個', timing: 'start',
          storageLocation: '基板検査出力', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'pull', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 0, safetyStock: 1, location: '最終組立前', notes: '' },
        },
        { materialId: 'key_unit', materialName: '鍵盤ユニット',
          requiredQuantity: 1, unit: '個', timing: 'start',
          storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
          schedulingMode: 'pull', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 2, safetyStock: 1, location: '最終組立前', notes: '' },
        },
      ],
      outputProducts: [{
        productId: 'piano', productName: '電子ピアノ P-001',
        outputQuantity: 1, unit: '台', qualityLevel: 'standard', cycleTime: 120, setupTime: 1,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '最終組立後', notes: '' },
      }],
    },
  },

  // ── 最終検査・音響テスト ──
  // IN: piano x1 → OUT: piano x1（検査通過品）
  {
    id: 'proc_final_test', type: 'process', position: { x: 1030, y: 280 },
    data: {
      label: '最終検査・音響テスト', name: '最終検査・音響テスト', type: 'inspection',
      cycleTime: 60, setupTime: 15, equipmentCount: 2, operatorCount: 2,
      inputBufferCapacity: 15, outputBufferCapacity: 10,
      defectRate: 0,
      inputs: ['piano'], outputs: ['piano'],
      productSettings: [
        { id: 'ps_test', productId: 'piano', productName: '電子ピアノ(検査済)', cycleTime: 60, setupTime: 15, qualityRate: 100, isActive: true },
      ],
      inputMaterials: [{
        materialId: 'piano', materialName: '電子ピアノ P-001',
        requiredQuantity: 1, unit: '台', timing: 'start',
        storageLocation: '最終組立出力', isDefective: false, qualityGrade: 'A',
        schedulingMode: 'push', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
        bufferSettings: { enabled: true, bufferType: 'input', maxLots: 3, initialStock: 0, safetyStock: 0, location: '最終検査前', notes: '' },
      }],
      outputProducts: [{
        productId: 'piano', productName: '電子ピアノ(検査済)',
        outputQuantity: 1, unit: '台', qualityLevel: 'standard', cycleTime: 60, setupTime: 0.25,
        bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '最終検査後', notes: '' },
      }],
    },
  },

  // ── 完成品倉庫（完成品ストア）──
  {
    id: 'store_finished', type: 'store', position: { x: 1280, y: 280 },
    data: {
      label: '完成品倉庫', name: '完成品倉庫', type: 'store',
      storeType: 'finished_product', cycleTime: 5, equipmentCount: 1, operatorCount: 1,
      capacity: 500,       // 最大容量500台（初期在庫は0）
      safetyStock: 50,     // 安全在庫50台
      reorderPoint: 0,     // 完成品は発注しない
      autoReplenishment: false,
      inputs: ['piano'], outputs: [],
      productionSchedule: [
        { id: 'sched_1', productId: 'piano', productName: '電子ピアノ P-001', quantity: 100, unit: '台', priority: 1, sequence: 1, isActive: true },
      ],
      inventoryLevels: [
        { productId: 'piano', productName: '電子ピアノ P-001', currentStock: 0, minStock: 50, maxStock: 500, unit: '台', reorderPoint: 0 },
      ],
    },
  },
];

// ========================================
// エッジ（搬送接続）
// ========================================
const mkEdge = (id: string, src: string, tgt: string, ttype: string, time: number, lotSize: number, dist: number, products: {pid: string, pname: string}[]) => ({
  id, source: src, target: tgt, type: 'smoothstep', animated: true,
  data: {
    transportTime: time, transportLotSize: lotSize, distance: dist, transportType: ttype,
    transportSettings: { defaultMethod: `${id}_m1`, enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' as const },
    transportMethods: [{
      id: `${id}_m1`,
      name: `${ttype === 'agv' ? 'AGV' : ttype === 'conveyor' ? 'コンベア' : '手押し台車'}搬送`,
      type: ttype, transportTime: time,
      transportCost: ttype === 'agv' ? 80 : ttype === 'conveyor' ? 20 : 50,
      maxCapacity: ttype === 'conveyor' ? 200 : ttype === 'agv' ? 100 : 30,
      priority: 1, isActive: true, transportCapacity: lotSize,
      transportInstruction: { type: 'push' as const },
      transportProducts: products.map((p, i) => ({ id: `${id}_tp${i}`, productId: p.pid, productName: p.pname, lotSize, priority: 1 })),
    }],
  },
});

const EDGES = [
  // 部品倉庫 → 木工加工（木材パネル供給）
  mkEdge('e1', 'store_parts', 'proc_wood', 'agv', 10, 10, 20,
    [{ pid: 'wood_raw', pname: '木材パネル(素材)' }]),
  // 部品倉庫 → 金属プレス（金属フレーム供給）
  mkEdge('e2', 'store_parts', 'proc_metal', 'agv', 10, 10, 20,
    [{ pid: 'metal_raw', pname: '金属フレーム(素材)' }]),
  // 木工加工 → 筐体組立（加工済木材）
  mkEdge('e3', 'proc_wood', 'proc_housing', 'conveyor', 8, 2, 10,
    [{ pid: 'wood_proc', pname: '加工済木材パネル' }]),
  // 金属プレス → 筐体組立（プレス済金属）
  mkEdge('e4', 'proc_metal', 'proc_housing', 'conveyor', 8, 1, 10,
    [{ pid: 'metal_proc', pname: 'プレス済金属フレーム' }]),
  // 部品倉庫 → SMT実装（基板+ICチップ供給）
  mkEdge('e5', 'store_parts', 'proc_smt', 'agv', 15, 5, 25,
    [{ pid: 'pcb_raw', pname: 'プリント基板(生)' }, { pid: 'ic_chip', pname: 'ICチップ' }]),
  // SMT実装 → 基板検査
  mkEdge('e6', 'proc_smt', 'proc_pcb_test', 'conveyor', 5, 1, 5,
    [{ pid: 'pcb_assy', pname: '基板アセンブリ' }]),
  // 筐体組立 → 最終組立
  mkEdge('e7', 'proc_housing', 'proc_final', 'agv', 12, 1, 15,
    [{ pid: 'housing', pname: '筐体アセンブリ' }]),
  // 基板検査 → 最終組立
  mkEdge('e8', 'proc_pcb_test', 'proc_final', 'agv', 12, 1, 15,
    [{ pid: 'pcb_tested', pname: '検査済基板' }]),
  // 部品倉庫 → 最終組立（鍵盤ユニット直送）
  mkEdge('e9', 'store_parts', 'proc_final', 'agv', 20, 1, 40,
    [{ pid: 'key_unit', pname: '鍵盤ユニット' }]),
  // 最終組立 → 最終検査
  mkEdge('e10', 'proc_final', 'proc_final_test', 'conveyor', 5, 1, 5,
    [{ pid: 'piano', pname: '電子ピアノ' }]),
  // 最終検査 → 完成品倉庫
  mkEdge('e11', 'proc_final_test', 'store_finished', 'manual', 10, 1, 10,
    [{ pid: 'piano', pname: '電子ピアノ(検査済)' }]),
];

// ========================================
// 初期化関数
// ========================================
export function initializeDemoProject() {
  const networkData = {
    nodes: NODES,
    edges: EDGES,
    products: PRODUCTS,
    bom_items: BOM_ITEMS,
    variants: [],
    process_advanced_data: {},
  };

  const existing = JSON.parse(localStorage.getItem('projects') || '[]');
  const idx = existing.findIndex((p: any) => p.id === DEMO_PROJECT.id);
  if (idx >= 0) { existing[idx] = DEMO_PROJECT; } else { existing.push(DEMO_PROJECT); }
  localStorage.setItem('projects', JSON.stringify(existing));
  localStorage.setItem(`project_${DEMO_PROJECT.id}_network`, JSON.stringify(networkData));

  return { project: DEMO_PROJECT, networkData };
}
