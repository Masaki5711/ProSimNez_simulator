/**
 * シンプルテストプロジェクト
 *
 * 構成:
 *   [部品倉庫] → [加工(2台,CT30)] → [組立(1台,CT60)] → [検査(1台,CT20)] → [完成品倉庫]
 *
 * 部品:
 *   素材A (部品倉庫に300個)
 *   素材B (部品倉庫に300個)
 *   加工品 = 素材A x1 + 素材B x1
 *   組立品 = 加工品 x2
 *   完成品 = 組立品 x1 (検査通過)
 */

export function initializeSimpleTest() {
  // 全プロジェクトを削除
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('project') || key === 'projects' || key === 'lastSelectedProjectId')) {
      allKeys.push(key);
    }
  }
  allKeys.forEach(k => localStorage.removeItem(k));

  const project = {
    id: 'test_simple',
    name: 'シンプルテスト（4工程直列）',
    description: '部品倉庫→加工→組立→検査→完成品倉庫。BOM・バッファ容量・初期在庫を完全設定。',
    category: 'manufacturing',
    tags: ['テスト', 'シンプル', '4工程'],
    status: 'active',
    version: '1.0.0',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const networkData = {
    // ── 製品マスタ(5品目) ──
    products: [
      { id: 'mat_a', name: '素材A', code: 'MAT-A', type: 'raw_material', unitCost: 100, processing_time: 0 },
      { id: 'mat_b', name: '素材B', code: 'MAT-B', type: 'raw_material', unitCost: 150, processing_time: 0 },
      { id: 'processed', name: '加工品', code: 'PROC-01', type: 'component', unitCost: 400, processing_time: 30 },
      { id: 'assembled', name: '組立品', code: 'ASSY-01', type: 'sub_assembly', unitCost: 1000, processing_time: 60 },
      { id: 'finished', name: '完成品', code: 'FIN-01', type: 'finished_product', unitCost: 1200, processing_time: 20 },
    ],

    // ── BOM(3関係) ──
    bom_items: [
      { id: 'bom1', parent_product: 'processed', child_product: 'mat_a', quantity: 1 },
      { id: 'bom2', parent_product: 'processed', child_product: 'mat_b', quantity: 1 },
      { id: 'bom3', parent_product: 'assembled', child_product: 'processed', quantity: 2 },
      { id: 'bom4', parent_product: 'finished', child_product: 'assembled', quantity: 1 },
    ],

    // ── ノード(6個) ──
    nodes: [
      // 部品倉庫
      {
        id: 'store_parts', type: 'store', position: { x: 50, y: 200 },
        data: {
          label: '部品倉庫', name: '部品倉庫', type: 'store',
          storeType: 'component', cycleTime: 5, equipmentCount: 1,
          capacity: 5000, safetyStock: 200, reorderPoint: 500, autoReplenishment: true,
          inputs: [], outputs: ['mat_a', 'mat_b'],
          inventoryLevels: [
            { productId: 'mat_a', productName: '素材A', currentStock: 1000, minStock: 100, maxStock: 2000, unit: '個', reorderPoint: 200 },
            { productId: 'mat_b', productName: '素材B', currentStock: 1000, minStock: 100, maxStock: 2000, unit: '個', reorderPoint: 200 },
          ],
        },
      },

      // 加工工程: 素材A x1 + 素材B x1 → 加工品 x1
      {
        id: 'proc_machine', type: 'process', position: { x: 280, y: 200 },
        data: {
          label: '加工', name: '加工', type: 'machining',
          cycleTime: 30, setupTime: 0, equipmentCount: 2, operatorCount: 2,
          inputBufferCapacity: 40, outputBufferCapacity: 20,
          defectRate: 2.0,
          inputs: ['mat_a', 'mat_b'], outputs: ['processed'],
          productSettings: [
            { id: 'ps1', productId: 'processed', productName: '加工品', cycleTime: 30, setupTime: 0, qualityRate: 98, isActive: true },
          ],
          inputMaterials: [
            {
              materialId: 'mat_a', materialName: '素材A',
              requiredQuantity: 1, unit: '個', timing: 'start',
              storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
              schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
              bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 20, safetyStock: 5, location: '加工前', notes: '' },
            },
            {
              materialId: 'mat_b', materialName: '素材B',
              requiredQuantity: 1, unit: '個', timing: 'start',
              storageLocation: '部品倉庫', isDefective: false, qualityGrade: 'A',
              schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
              bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 20, safetyStock: 5, location: '加工前', notes: '' },
            },
          ],
          outputProducts: [{
            productId: 'processed', productName: '加工品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 30, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 4, initialStock: 0, safetyStock: 0, location: '加工後', notes: '' },
          }],
        },
      },

      // 組立工程: 加工品 x2 → 組立品 x1
      {
        id: 'proc_assembly', type: 'process', position: { x: 530, y: 200 },
        data: {
          label: '組立', name: '組立', type: 'assembly',
          cycleTime: 60, setupTime: 0, equipmentCount: 1, operatorCount: 2,
          inputBufferCapacity: 20, outputBufferCapacity: 10,
          defectRate: 1.0,
          inputs: ['processed'], outputs: ['assembled'],
          productSettings: [
            { id: 'ps2', productId: 'assembled', productName: '組立品', cycleTime: 60, setupTime: 0, qualityRate: 99, isActive: true },
          ],
          inputMaterials: [{
            materialId: 'processed', materialName: '加工品',
            requiredQuantity: 2, unit: '個', timing: 'start',
            storageLocation: '加工出力', isDefective: false, qualityGrade: 'A',
            schedulingMode: 'pull', batchSize: 2, minBatchSize: 2, maxBatchSize: 10,
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 5, initialStock: 0, safetyStock: 2, location: '組立前', notes: '加工品2個で1組立' },
          }],
          outputProducts: [{
            productId: 'assembled', productName: '組立品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 60, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '組立後', notes: '' },
          }],
        },
      },

      // 検査工程: 組立品 x1 → 完成品 x1
      {
        id: 'proc_inspect', type: 'process', position: { x: 780, y: 200 },
        data: {
          label: '検査', name: '検査', type: 'inspection',
          cycleTime: 20, setupTime: 0, equipmentCount: 1, operatorCount: 1,
          inputBufferCapacity: 10, outputBufferCapacity: 5,
          defectRate: 0,
          inputs: ['assembled'], outputs: ['finished'],
          productSettings: [
            { id: 'ps3', productId: 'finished', productName: '完成品', cycleTime: 20, setupTime: 0, qualityRate: 100, isActive: true },
          ],
          inputMaterials: [{
            materialId: 'assembled', materialName: '組立品',
            requiredQuantity: 1, unit: '個', timing: 'start',
            storageLocation: '組立出力', isDefective: false, qualityGrade: 'A',
            schedulingMode: 'push', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 2, initialStock: 0, safetyStock: 0, location: '検査前', notes: '' },
          }],
          outputProducts: [{
            productId: 'finished', productName: '完成品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '検査後', notes: '' },
          }],
        },
      },

      // 完成品倉庫
      {
        id: 'store_finished', type: 'store', position: { x: 1030, y: 200 },
        data: {
          label: '完成品倉庫', name: '完成品倉庫', type: 'store',
          storeType: 'finished_product', cycleTime: 5, equipmentCount: 1,
          capacity: 300, safetyStock: 10, reorderPoint: 0, autoReplenishment: false,
          inputs: ['finished'], outputs: [],
          inventoryLevels: [
            { productId: 'finished', productName: '完成品', currentStock: 0, minStock: 10, maxStock: 200, unit: '個', reorderPoint: 0 },
          ],
          productionSchedule: [
            { id: 'sch1', productId: 'finished', productName: '完成品', quantity: 50, unit: '個', priority: 1, sequence: 1, isActive: true },
          ],
          workingHours: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isWorkingDay: true,
              breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isWorkingDay: true,
              breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isWorkingDay: true,
              breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isWorkingDay: true,
              breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', isWorkingDay: true,
              breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 6, isWorkingDay: false },
            { dayOfWeek: 0, isWorkingDay: false },
          ],
        },
      },
    ],

    // ── エッジ(4本) ──
    edges: [
      { id: 'e1', source: 'store_parts', target: 'proc_machine', type: 'smoothstep', animated: true,
        data: {
          transportTime: 5, transportLotSize: 10, distance: 10, transportType: 'agv',
          transportSettings: { defaultMethod: 'e1_m1', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
          transportMethods: [{
            id: 'e1_m1', name: 'AGV搬送(素材)', type: 'agv', transportTime: 5, transportCost: 30, maxCapacity: 100,
            priority: 1, isActive: true, transportCapacity: 10,
            transportInstruction: { type: 'push' },
            transportProducts: [
              { id: 'e1_tp1', productId: 'mat_a', productName: '素材A', lotSize: 10, priority: 1 },
              { id: 'e1_tp2', productId: 'mat_b', productName: '素材B', lotSize: 10, priority: 2 },
            ],
          }],
        },
      },
      { id: 'e2', source: 'proc_machine', target: 'proc_assembly', type: 'smoothstep', animated: true,
        data: {
          transportTime: 3, transportLotSize: 2, distance: 5, transportType: 'conveyor',
          transportSettings: { defaultMethod: 'e2_m1', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
          transportMethods: [{
            id: 'e2_m1', name: 'コンベア搬送(加工品)', type: 'conveyor', transportTime: 3, transportCost: 10, maxCapacity: 200,
            priority: 1, isActive: true, transportCapacity: 2,
            transportInstruction: { type: 'push' },
            transportProducts: [{ id: 'e2_tp1', productId: 'processed', productName: '加工品', lotSize: 2, priority: 1 }],
          }],
        },
      },
      { id: 'e3', source: 'proc_assembly', target: 'proc_inspect', type: 'smoothstep', animated: true,
        data: {
          transportTime: 3, transportLotSize: 1, distance: 5, transportType: 'conveyor',
          transportSettings: { defaultMethod: 'e3_m1', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
          transportMethods: [{
            id: 'e3_m1', name: 'コンベア搬送(組立品)', type: 'conveyor', transportTime: 3, transportCost: 10, maxCapacity: 200,
            priority: 1, isActive: true, transportCapacity: 1,
            transportInstruction: { type: 'push' },
            transportProducts: [{ id: 'e3_tp1', productId: 'assembled', productName: '組立品', lotSize: 1, priority: 1 }],
          }],
        },
      },
      { id: 'e4', source: 'proc_inspect', target: 'store_finished', type: 'smoothstep', animated: true,
        data: {
          transportTime: 5, transportLotSize: 1, distance: 8, transportType: 'manual',
          transportSettings: { defaultMethod: 'e4_m1', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
          transportMethods: [{
            id: 'e4_m1', name: '手押し台車(完成品)', type: 'manual', transportTime: 5, transportCost: 20, maxCapacity: 50,
            priority: 1, isActive: true, transportCapacity: 1,
            transportInstruction: { type: 'push' },
            transportProducts: [{ id: 'e4_tp1', productId: 'finished', productName: '完成品', lotSize: 1, priority: 1 }],
          }],
        },
      },
    ],

    variants: [],
    // ProcessMaterialDialogが読むAdvancedProcessData形式
    process_advanced_data: {
      // 加工工程
      proc_machine: {
        id: 'proc_machine', label: '加工', type: 'machining',
        cycleTime: 30, setupTime: 0, equipmentCount: 2, operatorCount: 2, availability: 95,
        inputMaterials: [
          {
            materialId: 'mat_a', materialName: '素材A',
            requiredQuantity: 1, unit: '個', timing: 'start',
            qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' }, storageLocation: '部品倉庫',
            supplyMethod: 'automated',
            schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 20, safetyStock: 5, location: '加工前', notes: '' },
          },
          {
            materialId: 'mat_b', materialName: '素材B',
            requiredQuantity: 1, unit: '個', timing: 'start',
            qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' }, storageLocation: '部品倉庫',
            supplyMethod: 'automated',
            schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 20, safetyStock: 5, location: '加工前', notes: '' },
          },
        ],
        outputProducts: [{
          productId: 'processed', productName: '加工品',
          outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 30, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 4, initialStock: 0, safetyStock: 0, location: '加工後', notes: '' },
        }],
        bomMappings: [],
        schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
        defectRate: 2.0, reworkRate: 0, operatingCost: 0,
        qualityCheckpoints: [], skillRequirements: [], toolRequirements: [],
        capacityConstraints: [], setupHistory: [],
      },
      // 組立工程
      proc_assembly: {
        id: 'proc_assembly', label: '組立', type: 'assembly',
        cycleTime: 60, setupTime: 0, equipmentCount: 1, operatorCount: 2, availability: 95,
        inputMaterials: [{
          materialId: 'processed', materialName: '加工品',
          requiredQuantity: 2, unit: '個', timing: 'start',
          qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' }, storageLocation: '加工出力',
          supplyMethod: 'automated',
          schedulingMode: 'pull', batchSize: 2, minBatchSize: 2, maxBatchSize: 10,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 5, initialStock: 0, safetyStock: 2, location: '組立前', notes: '加工品2個で1組立' },
        }],
        outputProducts: [{
          productId: 'assembled', productName: '組立品',
          outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 60, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '組立後', notes: '' },
        }],
        bomMappings: [],
        schedulingMode: 'pull', batchSize: 2, minBatchSize: 2, maxBatchSize: 10,
        defectRate: 1.0, reworkRate: 0, operatingCost: 0,
        qualityCheckpoints: [], skillRequirements: [], toolRequirements: [],
        capacityConstraints: [], setupHistory: [],
      },
      // 検査工程
      proc_inspect: {
        id: 'proc_inspect', label: '検査', type: 'inspection',
        cycleTime: 20, setupTime: 0, equipmentCount: 1, operatorCount: 1, availability: 99,
        inputMaterials: [{
          materialId: 'assembled', materialName: '組立品',
          requiredQuantity: 1, unit: '個', timing: 'start',
          qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' }, storageLocation: '組立出力',
          supplyMethod: 'automated',
          schedulingMode: 'push', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 2, initialStock: 0, safetyStock: 0, location: '検査前', notes: '' },
        }],
        outputProducts: [{
          productId: 'finished', productName: '完成品',
          outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: '検査後', notes: '' },
        }],
        bomMappings: [],
        schedulingMode: 'push', batchSize: 1, minBatchSize: 1, maxBatchSize: 5,
        defectRate: 0, reworkRate: 0, operatingCost: 0,
        qualityCheckpoints: [], skillRequirements: [], toolRequirements: [],
        capacityConstraints: [], setupHistory: [],
      },
    },
  };

  // 保存
  localStorage.setItem('projects', JSON.stringify([project]));
  localStorage.setItem(`project_${project.id}_network`, JSON.stringify(networkData));
  localStorage.setItem('lastSelectedProjectId', project.id);

  // 部品データをBOM付きで事前保存
  const now = new Date().toISOString();
  const bomMap: Record<string, any[]> = {};
  for (const b of networkData.bom_items) {
    if (!bomMap[b.parent_product]) bomMap[b.parent_product] = [];
    bomMap[b.parent_product].push(b);
  }
  const typeToCategory: Record<string, string> = {
    'component': 'cat_2', 'sub_assembly': 'cat_3', 'finished_product': 'cat_4',
  };
  const components = networkData.products.map((p: any) => ({
    id: p.id, name: p.name, code: p.code, type: p.type,
    version: '1.0', description: p.name,
    unitCost: p.unitCost || 0, leadTime: 0,
    supplier: p.type === 'component' ? '外部調達' : '自社製造',
    storageConditions: '常温', isDefective: false, qualityGrade: 'standard',
    category: typeToCategory[p.type] || 'cat_2', unit: '個', specifications: {},
    bomItems: (bomMap[p.id] || []).map((b: any) => ({
      id: b.id, parentProductId: p.id, childProductId: b.child_product,
      quantity: b.quantity, unit: '個', isOptional: false,
      effectiveDate: now, alternativeProducts: [], notes: '',
    })),
    transportLotSize: 10, createdAt: now, updatedAt: now,
  }));
  const categories = [
    { id: 'cat_1', name: '原材料', description: '購入素材' },
    { id: 'cat_2', name: '部品', description: '加工部品' },
    { id: 'cat_3', name: 'サブアセンブリ', description: '中間組立品' },
    { id: 'cat_4', name: '完成品', description: '最終製品' },
  ];
  localStorage.setItem(`project_${project.id}_components`, JSON.stringify({ components, categories }));

  return { project, networkData };
}
