/**
 * 組立ライン デモデータ
 *
 * 構成:
 * - 部品庫（部品A、部品B、部品Cを保管）
 * - 組立工程1（部品A + 部品B → サブアセンブリ1）
 * - 組立工程2（サブアセンブリ1 + 部品C → 完成品ASSY）
 * - 検査工程（完成品ASSYの品質検査）
 * - 完成品ストア（検査済み完成品を保管）
 */

import { v4 as uuidv4 } from 'uuid';

// 製品・部品定義
export const demoProducts = [
  {
    id: 'part_a',
    name: '部品A（フレーム）',
    code: 'PART-A-001',
    type: 'component',
    version: '1.0',
    unitCost: 500,
    leadTime: 3,
    supplier: '部品サプライヤーA',
  },
  {
    id: 'part_b',
    name: '部品B（カバー）',
    code: 'PART-B-001',
    type: 'component',
    version: '1.0',
    unitCost: 300,
    leadTime: 2,
    supplier: '部品サプライヤーB',
  },
  {
    id: 'part_c',
    name: '部品C（基板）',
    code: 'PART-C-001',
    type: 'component',
    version: '1.0',
    unitCost: 800,
    leadTime: 5,
    supplier: '電子部品商社',
  },
  {
    id: 'sub_assy_1',
    name: 'サブアセンブリ1',
    code: 'SUB-ASSY-001',
    type: 'sub_assembly',
    version: '1.0',
    unitCost: 1000,
    leadTime: 1,
  },
  {
    id: 'finished_assy',
    name: '完成品ASSY',
    code: 'ASSY-FINAL-001',
    type: 'finished_product',
    version: '1.0',
    unitCost: 2500,
    leadTime: 1,
  },
];

// 部品マスタ（BOM構成）
export const demoComponents = [
  {
    id: 'comp_part_a',
    code: 'PART-A-001',
    name: '部品A（フレーム）',
    type: 'component',
    unit: '個',
    bomItems: [],
  },
  {
    id: 'comp_part_b',
    code: 'PART-B-001',
    name: '部品B（カバー）',
    type: 'component',
    unit: '個',
    bomItems: [],
  },
  {
    id: 'comp_part_c',
    code: 'PART-C-001',
    name: '部品C（基板）',
    type: 'component',
    unit: '個',
    bomItems: [],
  },
  {
    id: 'comp_sub_assy_1',
    code: 'SUB-ASSY-001',
    name: 'サブアセンブリ1',
    type: 'sub_assembly',
    unit: '個',
    bomItems: [
      { componentId: 'comp_part_a', quantity: 1 },
      { componentId: 'comp_part_b', quantity: 2 },
    ],
  },
  {
    id: 'comp_finished_assy',
    code: 'ASSY-FINAL-001',
    name: '完成品ASSY',
    type: 'finished_product',
    unit: '個',
    bomItems: [
      { componentId: 'comp_sub_assy_1', quantity: 1 },
      { componentId: 'comp_part_c', quantity: 1 },
    ],
  },
];

// ノードID生成
const nodeIds = {
  partsStore: 'node_parts_store',
  assembly1: 'node_assembly_1',
  assembly2: 'node_assembly_2',
  inspection: 'node_inspection',
  finishedStore: 'node_finished_store',
};

// エッジID生成
const edgeIds = {
  partsToAssy1: 'edge_parts_to_assy1',
  assy1ToAssy2: 'edge_assy1_to_assy2',
  assy2ToInspection: 'edge_assy2_to_inspection',
  inspectionToFinished: 'edge_inspection_to_finished',
};

// ノード定義
export const demoNodes = [
  // 部品庫
  {
    id: nodeIds.partsStore,
    type: 'store',
    position: { x: 100, y: 300 },
    data: {
      label: '部品庫',
      name: '部品庫',
      type: 'store',
      storeType: 'component',
      cycleTime: 10,
      setupTime: 0,
      equipmentCount: 1,
      operatorCount: 1,
      inputs: [],
      outputs: ['part_a', 'part_b', 'part_c'],
      capacity: 1000,
      safetyStock: 100,
      reorderPoint: 200,
      autoReplenishment: true,
      enableSchedulingControl: true,
      inventoryLevels: [
        { productId: 'part_a', productName: '部品A（フレーム）', currentStock: 500, minStock: 50, maxStock: 500, unit: '個', reorderPoint: 100 },
        { productId: 'part_b', productName: '部品B（カバー）', currentStock: 1000, minStock: 100, maxStock: 1000, unit: '個', reorderPoint: 200 },
        { productId: 'part_c', productName: '部品C（基板）', currentStock: 300, minStock: 30, maxStock: 300, unit: '個', reorderPoint: 60 },
      ],
      productionSchedule: [
        { id: 'sched_1', productId: 'finished_assy', productName: '完成品ASSY', quantity: 100, unit: '個', priority: 1, sequence: 1, isActive: true },
      ],
    },
  },
  // 組立工程1
  {
    id: nodeIds.assembly1,
    type: 'assembly',
    position: { x: 400, y: 300 },
    data: {
      label: '組立工程1',
      name: '組立工程1',
      type: 'assembly',
      cycleTime: 60,
      setupTime: 120,
      equipmentCount: 2,
      operatorCount: 2,
      inputs: ['part_a', 'part_b'],
      outputs: ['sub_assy_1'],
      qualitySettings: {
        defectRate: 1.5,
        reworkRate: 0.5,
        scrapRate: 0.2,
        inspectionTime: 15,
        inspectionCapacity: 60,
      },
      schedulingSettings: {
        mode: 'kanban',
        batchSize: 10,
        leadTime: 180,
        kanbanCards: 5,
        pushThreshold: 80,
        pullSignal: 'kanban_card',
      },
      productSettings: [
        {
          id: 'ps_sub_assy_1',
          productId: 'sub_assy_1',
          productName: 'サブアセンブリ1',
          cycleTime: 60,
          setupTime: 120,
          qualityRate: 98.5,
          isActive: true,
        },
      ],
    },
  },
  // 組立工程2
  {
    id: nodeIds.assembly2,
    type: 'assembly',
    position: { x: 700, y: 300 },
    data: {
      label: '組立工程2',
      name: '組立工程2',
      type: 'assembly',
      cycleTime: 90,
      setupTime: 180,
      equipmentCount: 2,
      operatorCount: 3,
      inputs: ['sub_assy_1', 'part_c'],
      outputs: ['finished_assy'],
      qualitySettings: {
        defectRate: 1.0,
        reworkRate: 0.3,
        scrapRate: 0.1,
        inspectionTime: 20,
        inspectionCapacity: 40,
      },
      schedulingSettings: {
        mode: 'kanban',
        batchSize: 5,
        leadTime: 240,
        kanbanCards: 3,
        pushThreshold: 70,
        pullSignal: 'kanban_card',
      },
      productSettings: [
        {
          id: 'ps_finished_assy',
          productId: 'finished_assy',
          productName: '完成品ASSY',
          cycleTime: 90,
          setupTime: 180,
          qualityRate: 99.0,
          isActive: true,
        },
      ],
    },
  },
  // 検査工程
  {
    id: nodeIds.inspection,
    type: 'inspection',
    position: { x: 1000, y: 300 },
    data: {
      label: '検査工程',
      name: '検査工程',
      type: 'inspection',
      cycleTime: 30,
      setupTime: 60,
      equipmentCount: 1,
      operatorCount: 2,
      inputs: ['finished_assy'],
      outputs: ['finished_assy'],
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
        leadTime: 60,
        kanbanCards: 2,
        pushThreshold: 90,
        pullSignal: 'inspection_complete',
      },
      productSettings: [
        {
          id: 'ps_inspect_assy',
          productId: 'finished_assy',
          productName: '完成品ASSY',
          cycleTime: 30,
          setupTime: 60,
          qualityRate: 100,
          isActive: true,
        },
      ],
    },
  },
  // 完成品ストア
  {
    id: nodeIds.finishedStore,
    type: 'store',
    position: { x: 1300, y: 300 },
    data: {
      label: '完成品ストア',
      name: '完成品ストア',
      type: 'store',
      storeType: 'finished_product',
      cycleTime: 10,
      setupTime: 0,
      equipmentCount: 1,
      operatorCount: 1,
      inputs: ['finished_assy'],
      outputs: [],
      capacity: 500,
      safetyStock: 50,
      reorderPoint: 0,
      autoReplenishment: false,
      enableSchedulingControl: false,
      inventoryLevels: [
        { productId: 'finished_assy', productName: '完成品ASSY', currentStock: 0, minStock: 10, maxStock: 500, unit: '個', reorderPoint: 20 },
      ],
    },
  },
];

// エッジ（接続）定義
export const demoEdges = [
  // 部品庫 → 組立工程1
  {
    id: edgeIds.partsToAssy1,
    source: nodeIds.partsStore,
    target: nodeIds.assembly1,
    type: 'smoothstep',
    animated: true,
    data: {
      transportTime: 30,
      transportLotSize: 20,
      distance: 15,
      transportType: 'agv',
      transportSettings: {
        defaultMethod: 'method_agv_1',
        enableCapacityControl: true,
        enableRouting: true,
        congestionHandling: 'queue',
      },
      transportMethods: [
        {
          id: 'method_agv_1',
          name: 'AGV搬送（部品）',
          type: 'agv',
          transportTime: 30,
          transportCost: 50,
          maxCapacity: 100,
          priority: 1,
          isActive: true,
          transportCapacity: 2,
          transportInstruction: {
            type: 'kanban',
          },
          transportProducts: [
            { id: 'tp_part_a', productId: 'part_a', productName: '部品A（フレーム）', lotSize: 10, priority: 1 },
            { id: 'tp_part_b', productId: 'part_b', productName: '部品B（カバー）', lotSize: 20, priority: 2 },
          ],
        },
      ],
    },
  },
  // 部品庫 → 組立工程2（部品Cの供給）
  {
    id: 'edge_parts_to_assy2',
    source: nodeIds.partsStore,
    target: nodeIds.assembly2,
    type: 'smoothstep',
    animated: true,
    data: {
      transportTime: 45,
      transportLotSize: 10,
      distance: 25,
      transportType: 'agv',
      transportSettings: {
        defaultMethod: 'method_agv_2',
        enableCapacityControl: true,
        enableRouting: true,
        congestionHandling: 'queue',
      },
      transportMethods: [
        {
          id: 'method_agv_2',
          name: 'AGV搬送（基板）',
          type: 'agv',
          transportTime: 45,
          transportCost: 80,
          maxCapacity: 50,
          priority: 1,
          isActive: true,
          transportCapacity: 1,
          transportInstruction: {
            type: 'kanban',
          },
          transportProducts: [
            { id: 'tp_part_c', productId: 'part_c', productName: '部品C（基板）', lotSize: 10, priority: 1 },
          ],
        },
      ],
    },
  },
  // 組立工程1 → 組立工程2
  {
    id: edgeIds.assy1ToAssy2,
    source: nodeIds.assembly1,
    target: nodeIds.assembly2,
    type: 'smoothstep',
    animated: true,
    data: {
      transportTime: 20,
      transportLotSize: 10,
      distance: 10,
      transportType: 'conveyor',
      transportSettings: {
        defaultMethod: 'method_conveyor_1',
        enableCapacityControl: true,
        enableRouting: false,
        congestionHandling: 'queue',
      },
      transportMethods: [
        {
          id: 'method_conveyor_1',
          name: 'コンベア搬送',
          type: 'conveyor',
          transportTime: 20,
          transportCost: 10,
          maxCapacity: 200,
          priority: 1,
          isActive: true,
          transportCapacity: 5,
          transportInstruction: {
            type: 'push',
          },
          transportProducts: [
            { id: 'tp_sub_assy', productId: 'sub_assy_1', productName: 'サブアセンブリ1', lotSize: 10, priority: 1 },
          ],
        },
      ],
    },
  },
  // 組立工程2 → 検査工程
  {
    id: edgeIds.assy2ToInspection,
    source: nodeIds.assembly2,
    target: nodeIds.inspection,
    type: 'smoothstep',
    animated: true,
    data: {
      transportTime: 15,
      transportLotSize: 5,
      distance: 8,
      transportType: 'conveyor',
      transportSettings: {
        defaultMethod: 'method_conveyor_2',
        enableCapacityControl: true,
        enableRouting: false,
        congestionHandling: 'queue',
      },
      transportMethods: [
        {
          id: 'method_conveyor_2',
          name: 'コンベア搬送（検査向け）',
          type: 'conveyor',
          transportTime: 15,
          transportCost: 10,
          maxCapacity: 150,
          priority: 1,
          isActive: true,
          transportCapacity: 3,
          transportInstruction: {
            type: 'push',
          },
          transportProducts: [
            { id: 'tp_finished_inspect', productId: 'finished_assy', productName: '完成品ASSY', lotSize: 5, priority: 1 },
          ],
        },
      ],
    },
  },
  // 検査工程 → 完成品ストア
  {
    id: edgeIds.inspectionToFinished,
    source: nodeIds.inspection,
    target: nodeIds.finishedStore,
    type: 'smoothstep',
    animated: true,
    data: {
      transportTime: 20,
      transportLotSize: 10,
      distance: 12,
      transportType: 'manual',
      transportSettings: {
        defaultMethod: 'method_manual_1',
        enableCapacityControl: false,
        enableRouting: false,
        congestionHandling: 'queue',
      },
      transportMethods: [
        {
          id: 'method_manual_1',
          name: '手押し台車搬送',
          type: 'manual',
          transportTime: 20,
          transportCost: 30,
          maxCapacity: 50,
          priority: 1,
          isActive: true,
          transportCapacity: 2,
          transportInstruction: {
            type: 'push',
          },
          transportProducts: [
            { id: 'tp_finished_store', productId: 'finished_assy', productName: '完成品ASSY', lotSize: 10, priority: 1 },
          ],
        },
      ],
    },
  },
];

// 完全なデモネットワークデータ
export const getAssemblyLineDemoData = () => {
  return {
    products: demoProducts,
    components: demoComponents,
    nodes: demoNodes,
    edges: demoEdges,
    metadata: {
      name: '組立ライン デモ',
      description: '部品庫→組立1→組立2→検査→完成品ストアの基本的な組立ラインです',
      createdAt: new Date().toISOString(),
      version: '1.0',
    },
  };
};

export default getAssemblyLineDemoData;
