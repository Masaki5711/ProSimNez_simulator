/**
 * 工場シミュレーション デモデータ（BOM構成付き）
 *
 * 製品構成（BOM）:
 *   完成品 [PROD-001]
 *   ├── サブアセンブリA [SUB-A]  x1
 *   │   ├── 部品A1（プレス部品）  x2
 *   │   └── 部品A2（切削部品）    x1
 *   ├── サブアセンブリB [SUB-B]  x1
 *   │   ├── 部品B1（樹脂部品）   x3
 *   │   └── 部品B2（電子基板）   x1
 *   └── 部品C（外装パネル）      x1
 *
 * 工程フロー:
 *   [部品倉庫] → [プレス工程] → [切削工程] → [サブ組立A]
 *                                              ↓
 *   [部品倉庫] → [射出成形] → [基板実装] → [サブ組立B]
 *                                              ↓
 *                                         [最終組立] → [検査] → [完成品倉庫]
 *   [部品倉庫] ─────────────────────────→ [最終組立]
 */

// ========== 製品・部品マスタ ==========
export const demoProducts = [
  { id: 'part_a1', name: '部品A1（プレス部品）', code: 'PART-A1', type: 'component', unitCost: 200, leadTime: 2 },
  { id: 'part_a2', name: '部品A2（切削部品）', code: 'PART-A2', type: 'component', unitCost: 350, leadTime: 3 },
  { id: 'part_b1', name: '部品B1（樹脂部品）', code: 'PART-B1', type: 'component', unitCost: 80, leadTime: 1 },
  { id: 'part_b2', name: '部品B2（電子基板）', code: 'PART-B2', type: 'component', unitCost: 1200, leadTime: 5 },
  { id: 'part_c', name: '部品C（外装パネル）', code: 'PART-C', type: 'component', unitCost: 400, leadTime: 3 },
  { id: 'sub_a', name: 'サブアセンブリA', code: 'SUB-A', type: 'sub_assembly', unitCost: 900, leadTime: 1 },
  { id: 'sub_b', name: 'サブアセンブリB', code: 'SUB-B', type: 'sub_assembly', unitCost: 1600, leadTime: 1 },
  { id: 'prod_001', name: '完成品 PROD-001', code: 'PROD-001', type: 'finished_product', unitCost: 4500, leadTime: 1 },
];

// ========== BOM構成 ==========
export const demoBOM = [
  // サブアセンブリA = 部品A1 x2 + 部品A2 x1
  { id: 'bom_1', parentId: 'sub_a', childId: 'part_a1', quantity: 2 },
  { id: 'bom_2', parentId: 'sub_a', childId: 'part_a2', quantity: 1 },
  // サブアセンブリB = 部品B1 x3 + 部品B2 x1
  { id: 'bom_3', parentId: 'sub_b', childId: 'part_b1', quantity: 3 },
  { id: 'bom_4', parentId: 'sub_b', childId: 'part_b2', quantity: 1 },
  // 完成品 = サブA x1 + サブB x1 + 部品C x1
  { id: 'bom_5', parentId: 'prod_001', childId: 'sub_a', quantity: 1 },
  { id: 'bom_6', parentId: 'prod_001', childId: 'sub_b', quantity: 1 },
  { id: 'bom_7', parentId: 'prod_001', childId: 'part_c', quantity: 1 },
];

// ========== ネットワークノード ==========
export const demoNodes = [
  // --- 倉庫 ---
  {
    id: 'store_raw',
    type: 'store',
    position: { x: 50, y: 300 },
    data: {
      label: '部品倉庫',
      name: '部品倉庫',
      type: 'store',
      storeType: 'component',
      cycleTime: 5,
      equipmentCount: 1,
      capacity: 5000,
    },
  },
  // --- 加工工程ラインA ---
  {
    id: 'proc_press',
    type: 'machining',
    position: { x: 300, y: 150 },
    data: {
      label: 'プレス工程',
      name: 'プレス工程',
      cycleTime: 15,
      setupTime: 60,
      equipmentCount: 3,
      operatorCount: 2,
      defectRate: 2.0,
      schedulingMode: 'push',
      batchSize: 20,
    },
  },
  {
    id: 'proc_cutting',
    type: 'machining',
    position: { x: 550, y: 100 },
    data: {
      label: '切削工程',
      name: '切削工程',
      cycleTime: 40,
      setupTime: 120,
      equipmentCount: 2,
      operatorCount: 2,
      defectRate: 1.5,
      schedulingMode: 'push',
      batchSize: 10,
    },
  },
  {
    id: 'proc_sub_a',
    type: 'assembly',
    position: { x: 800, y: 150 },
    data: {
      label: 'サブ組立A',
      name: 'サブ組立A',
      cycleTime: 45,
      setupTime: 90,
      equipmentCount: 2,
      operatorCount: 3,
      defectRate: 1.0,
      schedulingMode: 'kanban',
      batchSize: 10,
      kanbanEnabled: true,
      kanbanCardCount: 4,
      reorderPoint: 8,
    },
  },
  // --- 加工工程ラインB ---
  {
    id: 'proc_molding',
    type: 'machining',
    position: { x: 300, y: 450 },
    data: {
      label: '射出成形',
      name: '射出成形',
      cycleTime: 20,
      setupTime: 180,
      equipmentCount: 2,
      operatorCount: 1,
      defectRate: 3.0,
      schedulingMode: 'push',
      batchSize: 50,
    },
  },
  {
    id: 'proc_smt',
    type: 'machining',
    position: { x: 550, y: 500 },
    data: {
      label: '基板実装(SMT)',
      name: '基板実装(SMT)',
      cycleTime: 60,
      setupTime: 300,
      equipmentCount: 1,
      operatorCount: 1,
      defectRate: 0.5,
      schedulingMode: 'pull',
      batchSize: 10,
    },
  },
  {
    id: 'proc_sub_b',
    type: 'assembly',
    position: { x: 800, y: 450 },
    data: {
      label: 'サブ組立B',
      name: 'サブ組立B',
      cycleTime: 55,
      setupTime: 90,
      equipmentCount: 2,
      operatorCount: 2,
      defectRate: 1.0,
      schedulingMode: 'kanban',
      batchSize: 5,
      kanbanEnabled: true,
      kanbanCardCount: 3,
      reorderPoint: 5,
    },
  },
  // --- 最終工程 ---
  {
    id: 'proc_final',
    type: 'assembly',
    position: { x: 1050, y: 300 },
    data: {
      label: '最終組立',
      name: '最終組立',
      cycleTime: 90,
      setupTime: 120,
      equipmentCount: 2,
      operatorCount: 4,
      defectRate: 0.5,
      schedulingMode: 'hybrid',
      batchSize: 5,
    },
  },
  {
    id: 'proc_inspect',
    type: 'inspection',
    position: { x: 1300, y: 300 },
    data: {
      label: '最終検査',
      name: '最終検査',
      cycleTime: 30,
      setupTime: 30,
      equipmentCount: 2,
      operatorCount: 2,
      defectRate: 0,
      schedulingMode: 'push',
      batchSize: 1,
    },
  },
  // --- 完成品倉庫 ---
  {
    id: 'store_finished',
    type: 'store',
    position: { x: 1550, y: 300 },
    data: {
      label: '完成品倉庫',
      name: '完成品倉庫',
      type: 'store',
      storeType: 'finished_product',
      cycleTime: 5,
      equipmentCount: 1,
      capacity: 2000,
    },
  },
];

// ========== 接続（エッジ） ==========
export const demoEdges = [
  // ラインA: 部品倉庫 → プレス → 切削 → サブ組立A
  { id: 'e_raw_press', source: 'store_raw', target: 'proc_press', type: 'smoothstep', animated: true,
    data: { transportTime: 10, transportLotSize: 20, transportType: 'agv', distance: 15 } },
  { id: 'e_press_cut', source: 'proc_press', target: 'proc_cutting', type: 'smoothstep', animated: true,
    data: { transportTime: 8, transportLotSize: 10, transportType: 'conveyor', distance: 8 } },
  { id: 'e_cut_suba', source: 'proc_cutting', target: 'proc_sub_a', type: 'smoothstep', animated: true,
    data: { transportTime: 10, transportLotSize: 10, transportType: 'conveyor', distance: 10 } },
  // ラインB: 部品倉庫 → 射出成形 → 基板実装 → サブ組立B
  { id: 'e_raw_mold', source: 'store_raw', target: 'proc_molding', type: 'smoothstep', animated: true,
    data: { transportTime: 12, transportLotSize: 50, transportType: 'agv', distance: 15 } },
  { id: 'e_mold_smt', source: 'proc_molding', target: 'proc_smt', type: 'smoothstep', animated: true,
    data: { transportTime: 15, transportLotSize: 10, transportType: 'agv', distance: 12 } },
  { id: 'e_smt_subb', source: 'proc_smt', target: 'proc_sub_b', type: 'smoothstep', animated: true,
    data: { transportTime: 10, transportLotSize: 5, transportType: 'conveyor', distance: 10 } },
  // 合流: サブ組立A/B + 部品倉庫 → 最終組立
  { id: 'e_suba_final', source: 'proc_sub_a', target: 'proc_final', type: 'smoothstep', animated: true,
    data: { transportTime: 12, transportLotSize: 5, transportType: 'conveyor', distance: 12 } },
  { id: 'e_subb_final', source: 'proc_sub_b', target: 'proc_final', type: 'smoothstep', animated: true,
    data: { transportTime: 12, transportLotSize: 5, transportType: 'conveyor', distance: 12 } },
  { id: 'e_raw_final', source: 'store_raw', target: 'proc_final', type: 'smoothstep', animated: true,
    data: { transportTime: 20, transportLotSize: 5, transportType: 'agv', distance: 30 } },
  // 最終: 最終組立 → 検査 → 完成品倉庫
  { id: 'e_final_insp', source: 'proc_final', target: 'proc_inspect', type: 'smoothstep', animated: true,
    data: { transportTime: 8, transportLotSize: 5, transportType: 'conveyor', distance: 8 } },
  { id: 'e_insp_store', source: 'proc_inspect', target: 'store_finished', type: 'smoothstep', animated: true,
    data: { transportTime: 15, transportLotSize: 10, transportType: 'manual', distance: 12 } },
];

// ========== 完全なデモデータを取得 ==========
export const getFactoryDemoData = () => {
  return {
    nodes: demoNodes,
    edges: demoEdges,
    products: demoProducts,
    bom_items: demoBOM.map(b => ({
      id: b.id,
      parent_product: b.parentId,
      child_product: b.childId,
      quantity: b.quantity,
    })),
    metadata: {
      name: '工場シミュレーション デモ（BOM付き）',
      description: '部品加工→サブ組立→最終組立→検査の多品種混流生産ライン',
      version: '2.0',
      createdAt: new Date().toISOString(),
    },
  };
};

export default getFactoryDemoData;
