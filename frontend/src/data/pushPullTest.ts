/**
 * Push/Pull検証プロジェクト
 *
 * 2ライン並列で同一工程構成、スケジューリングだけ異なる
 *
 * ラインP(Push): [部品倉庫] → [加工P(2台CT20)] → [組立P(1台CT40)] → [完成品倉庫]
 * ラインK(Pull/Kanban): [部品倉庫] → [加工K(2台CT20)] → [組立K(1台CT40)] → [完成品倉庫]
 *
 * 部品: 素材(raw) → 加工品(proc_p/proc_k) → 組立品(assy_p/assy_k)
 * 部品倉庫: 素材 3000個（十分な量）
 * 完成品倉庫: 容量500
 * 稼働時間: 08:00-17:00（昼休憩1h）= 8時間
 *
 * 検証ポイント:
 * - Push vs Pull/Kanbanでスループット差
 * - バッファ在庫の推移差（Pushは溜まる、Pullは少ない）
 * - 搬送頻度差
 */

export function initializePushPullTest() {
  // 旧プロジェクト削除
  const allKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('project') || key === 'projects' || key === 'lastSelectedProjectId')) {
      allKeys.push(key);
    }
  }
  allKeys.forEach(k => localStorage.removeItem(k));

  const project = {
    id: 'test_pushpull',
    name: 'Push/Pull検証（2ライン並列）',
    description: '同一工程構成の2ラインでPush型とPull/Kanban型を比較。バッファ在庫・搬送頻度・スループットの差を検証。',
    category: 'manufacturing',
    tags: ['検証', 'Push', 'Pull', 'Kanban', '比較'],
    status: 'active', version: '1.0.0', createdBy: 'system',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  const networkData = {
    products: [
      { id: 'raw', name: '素材', code: 'RAW', type: 'raw_material', unitCost: 100, processing_time: 0 },
      { id: 'proc_p', name: 'P:加工品', code: 'PRC-P', type: 'component', unitCost: 300, processing_time: 20 },
      { id: 'proc_k', name: 'K:加工品', code: 'PRC-K', type: 'component', unitCost: 300, processing_time: 20 },
      { id: 'assy_p', name: 'P:組立品', code: 'ASY-P', type: 'finished_product', unitCost: 800, processing_time: 40 },
      { id: 'assy_k', name: 'K:組立品', code: 'ASY-K', type: 'finished_product', unitCost: 800, processing_time: 40 },
    ],
    bom_items: [
      { id: 'bp1', parent_product: 'proc_p', child_product: 'raw', quantity: 1 },
      { id: 'bp2', parent_product: 'proc_k', child_product: 'raw', quantity: 1 },
      { id: 'bp3', parent_product: 'assy_p', child_product: 'proc_p', quantity: 2 },
      { id: 'bp4', parent_product: 'assy_k', child_product: 'proc_k', quantity: 2 },
    ],
    nodes: [
      // ── 部品倉庫（共通）──
      { id: 'store_raw', type: 'store', position: { x: 50, y: 250 },
        data: {
          label: '部品倉庫', name: '部品倉庫', type: 'store', storeType: 'component',
          cycleTime: 5, equipmentCount: 1, capacity: 5000,
          safetyStock: 500, reorderPoint: 1000, autoReplenishment: true,
          inputs: [], outputs: ['raw'],
          inventoryLevels: [
            { productId: 'raw', productName: '素材', currentStock: 3000, minStock: 300, maxStock: 5000, unit: '個', reorderPoint: 600 },
          ],
        },
      },

      // ══════ ラインP: Push型 ══════
      { id: 'mach_p', type: 'process', position: { x: 300, y: 100 },
        data: {
          label: 'P:加工(Push)', name: 'P:加工(Push)', type: 'machining',
          cycleTime: 20, setupTime: 0, equipmentCount: 2, operatorCount: 2,
          inputBufferCapacity: 40, outputBufferCapacity: 20, defectRate: 1.0,
          inputs: ['raw'], outputs: ['proc_p'],
          inputMaterials: [{
            materialId: 'raw', materialName: '素材',
            requiredQuantity: 1, unit: '個', timing: 'start',
            qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
            storageLocation: '部品倉庫', supplyMethod: 'automated',
            schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 20, safetyStock: 5, location: 'P加工前', notes: '' },
          }],
          outputProducts: [{
            productId: 'proc_p', productName: 'P:加工品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 4, initialStock: 0, safetyStock: 0, location: 'P加工後', notes: '' },
          }],
          productSettings: [{ id: 'ps_pp', productId: 'proc_p', productName: 'P:加工品', cycleTime: 20, setupTime: 0, qualityRate: 99, isActive: true }],
        },
      },
      { id: 'assy_p_proc', type: 'process', position: { x: 580, y: 100 },
        data: {
          label: 'P:組立(Push)', name: 'P:組立(Push)', type: 'assembly',
          cycleTime: 40, setupTime: 0, equipmentCount: 1, operatorCount: 2,
          inputBufferCapacity: 20, outputBufferCapacity: 10, defectRate: 0.5,
          inputs: ['proc_p'], outputs: ['assy_p'],
          inputMaterials: [{
            materialId: 'proc_p', materialName: 'P:加工品',
            requiredQuantity: 2, unit: '個', timing: 'start',
            qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
            storageLocation: 'P加工出力', supplyMethod: 'automated',
            schedulingMode: 'push', batchSize: 2, minBatchSize: 2, maxBatchSize: 10,
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 5, initialStock: 0, safetyStock: 2, location: 'P組立前', notes: '' },
          }],
          outputProducts: [{
            productId: 'assy_p', productName: 'P:組立品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 40, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: 'P組立後', notes: '' },
          }],
          productSettings: [{ id: 'ps_ap', productId: 'assy_p', productName: 'P:組立品', cycleTime: 40, setupTime: 0, qualityRate: 99.5, isActive: true }],
        },
      },

      // ══════ ラインK: Pull/Kanban型 ══════
      { id: 'mach_k', type: 'process', position: { x: 300, y: 400 },
        data: {
          label: 'K:加工(Pull)', name: 'K:加工(Pull)', type: 'machining',
          cycleTime: 20, setupTime: 0, equipmentCount: 2, operatorCount: 2,
          inputBufferCapacity: 40, outputBufferCapacity: 20, defectRate: 1.0,
          inputs: ['raw'], outputs: ['proc_k'],
          inputMaterials: [{
            materialId: 'raw', materialName: '素材',
            requiredQuantity: 1, unit: '個', timing: 'start',
            qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
            storageLocation: '部品倉庫', supplyMethod: 'kanban',
            schedulingMode: 'pull', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
            kanbanSettings: { enabled: true, cardCount: 3, reorderPoint: 10, maxInventory: 30, supplierLeadTime: 1, kanbanType: 'production' as const },
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 3, initialStock: 15, safetyStock: 10, location: 'K加工前', notes: 'Kanban制御' },
          }],
          outputProducts: [{
            productId: 'proc_k', productName: 'K:加工品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 3, initialStock: 0, safetyStock: 0, location: 'K加工後', notes: '' },
          }],
          productSettings: [{ id: 'ps_pk', productId: 'proc_k', productName: 'K:加工品', cycleTime: 20, setupTime: 0, qualityRate: 99, isActive: true }],
        },
      },
      { id: 'assy_k_proc', type: 'process', position: { x: 580, y: 400 },
        data: {
          label: 'K:組立(Pull)', name: 'K:組立(Pull)', type: 'assembly',
          cycleTime: 40, setupTime: 0, equipmentCount: 1, operatorCount: 2,
          inputBufferCapacity: 10, outputBufferCapacity: 5, defectRate: 0.5,
          inputs: ['proc_k'], outputs: ['assy_k'],
          inputMaterials: [{
            materialId: 'proc_k', materialName: 'K:加工品',
            requiredQuantity: 2, unit: '個', timing: 'start',
            qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
            storageLocation: 'K加工出力', supplyMethod: 'kanban',
            schedulingMode: 'pull', batchSize: 2, minBatchSize: 2, maxBatchSize: 6,
            kanbanSettings: { enabled: true, cardCount: 2, reorderPoint: 4, maxInventory: 10, supplierLeadTime: 1, kanbanType: 'withdrawal' as const },
            bufferSettings: { enabled: true, bufferType: 'input', maxLots: 2, initialStock: 0, safetyStock: 4, location: 'K組立前', notes: 'Kanban制御' },
          }],
          outputProducts: [{
            productId: 'assy_k', productName: 'K:組立品',
            outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 40, setupTime: 0,
            bufferSettings: { enabled: true, bufferType: 'output', maxLots: 1, initialStock: 0, safetyStock: 0, location: 'K組立後', notes: '' },
          }],
          productSettings: [{ id: 'ps_ak', productId: 'assy_k', productName: 'K:組立品', cycleTime: 40, setupTime: 0, qualityRate: 99.5, isActive: true }],
        },
      },

      // ── 完成品倉庫（共通）──
      { id: 'store_fin', type: 'store', position: { x: 860, y: 250 },
        data: {
          label: '完成品倉庫', name: '完成品倉庫', type: 'store', storeType: 'finished_product',
          cycleTime: 5, equipmentCount: 1, capacity: 500,
          safetyStock: 20, reorderPoint: 0, autoReplenishment: false,
          inputs: ['assy_p', 'assy_k'], outputs: [],
          inventoryLevels: [
            { productId: 'assy_p', productName: 'P:組立品', currentStock: 0, minStock: 10, maxStock: 250, unit: '個', reorderPoint: 0 },
            { productId: 'assy_k', productName: 'K:組立品', currentStock: 0, minStock: 10, maxStock: 250, unit: '個', reorderPoint: 0 },
          ],
          productionSchedule: [
            { id: 'sch1', productId: 'assy_p', productName: 'P:組立品', quantity: 200, unit: '個', priority: 1, sequence: 1, isActive: true },
            { id: 'sch2', productId: 'assy_k', productName: 'K:組立品', quantity: 200, unit: '個', priority: 1, sequence: 2, isActive: true },
          ],
          workingHours: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isWorkingDay: true, breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isWorkingDay: true, breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isWorkingDay: true, breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isWorkingDay: true, breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', isWorkingDay: true, breakTimes: [{ name: '昼休憩', startTime: '12:00', endTime: '13:00' }] },
            { dayOfWeek: 6, isWorkingDay: false },
            { dayOfWeek: 0, isWorkingDay: false },
          ],
        },
      },
    ],

    edges: [
      // 部品倉庫 → P:加工 (Push: 大ロット搬送)
      { id: 'ep1', source: 'store_raw', target: 'mach_p', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 10, transportType: 'agv', distance: 15,
          transportMethods: [{ id: 'ep1_m', name: 'AGV(Push大ロット)', type: 'agv', transportTime: 5, transportCost: 30, maxCapacity: 100, priority: 1, isActive: true, transportCapacity: 10,
            transportInstruction: { type: 'push' }, transportProducts: [{ id: 'ep1_t', productId: 'raw', productName: '素材', lotSize: 10, priority: 1 }] }],
          transportSettings: { defaultMethod: 'ep1_m', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
        },
      },
      // P:加工 → P:組立
      { id: 'ep2', source: 'mach_p', target: 'assy_p_proc', type: 'smoothstep', animated: true,
        data: { transportTime: 3, transportLotSize: 2, transportType: 'conveyor', distance: 5,
          transportMethods: [{ id: 'ep2_m', name: 'CNV(Push)', type: 'conveyor', transportTime: 3, transportCost: 10, maxCapacity: 200, priority: 1, isActive: true, transportCapacity: 2,
            transportInstruction: { type: 'push' }, transportProducts: [{ id: 'ep2_t', productId: 'proc_p', productName: 'P:加工品', lotSize: 2, priority: 1 }] }],
          transportSettings: { defaultMethod: 'ep2_m', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
        },
      },
      // P:組立 → 完成品
      { id: 'ep3', source: 'assy_p_proc', target: 'store_fin', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 1, transportType: 'manual', distance: 10,
          transportMethods: [{ id: 'ep3_m', name: '手押し台車(P)', type: 'manual', transportTime: 5, transportCost: 20, maxCapacity: 50, priority: 1, isActive: true, transportCapacity: 1,
            transportInstruction: { type: 'push' }, transportProducts: [{ id: 'ep3_t', productId: 'assy_p', productName: 'P:組立品', lotSize: 1, priority: 1 }] }],
          transportSettings: { defaultMethod: 'ep3_m', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
        },
      },

      // 部品倉庫 → K:加工 (Pull: 小ロット搬送)
      { id: 'ek1', source: 'store_raw', target: 'mach_k', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 5, transportType: 'agv', distance: 15,
          transportMethods: [{ id: 'ek1_m', name: 'AGV(Pull小ロット)', type: 'agv', transportTime: 5, transportCost: 30, maxCapacity: 100, priority: 1, isActive: true, transportCapacity: 5,
            transportInstruction: { type: 'kanban' }, transportProducts: [{ id: 'ek1_t', productId: 'raw', productName: '素材', lotSize: 5, priority: 1 }] }],
          transportSettings: { defaultMethod: 'ek1_m', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
        },
      },
      // K:加工 → K:組立
      { id: 'ek2', source: 'mach_k', target: 'assy_k_proc', type: 'smoothstep', animated: true,
        data: { transportTime: 3, transportLotSize: 2, transportType: 'conveyor', distance: 5,
          transportMethods: [{ id: 'ek2_m', name: 'CNV(Pull)', type: 'conveyor', transportTime: 3, transportCost: 10, maxCapacity: 200, priority: 1, isActive: true, transportCapacity: 2,
            transportInstruction: { type: 'kanban' }, transportProducts: [{ id: 'ek2_t', productId: 'proc_k', productName: 'K:加工品', lotSize: 2, priority: 1 }] }],
          transportSettings: { defaultMethod: 'ek2_m', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
        },
      },
      // K:組立 → 完成品
      { id: 'ek3', source: 'assy_k_proc', target: 'store_fin', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 1, transportType: 'manual', distance: 10,
          transportMethods: [{ id: 'ek3_m', name: '手押し台車(K)', type: 'manual', transportTime: 5, transportCost: 20, maxCapacity: 50, priority: 1, isActive: true, transportCapacity: 1,
            transportInstruction: { type: 'kanban' }, transportProducts: [{ id: 'ek3_t', productId: 'assy_k', productName: 'K:組立品', lotSize: 1, priority: 1 }] }],
          transportSettings: { defaultMethod: 'ek3_m', enableCapacityControl: true, enableRouting: false, congestionHandling: 'queue' },
        },
      },
    ],

    variants: [],
    process_advanced_data: {
      mach_p: {
        id: 'mach_p', label: 'P:加工(Push)', type: 'machining',
        cycleTime: 20, setupTime: 0, equipmentCount: 2, operatorCount: 2, availability: 95,
        inputMaterials: [{
          materialId: 'raw', materialName: '素材', requiredQuantity: 1, unit: '個', timing: 'start',
          qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
          storageLocation: '部品倉庫', supplyMethod: 'automated',
          schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 4, initialStock: 20, safetyStock: 5, location: 'P加工前', notes: '' },
        }],
        outputProducts: [{ productId: 'proc_p', productName: 'P:加工品', outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 4, initialStock: 0, safetyStock: 0, location: 'P加工後', notes: '' } }],
        bomMappings: [], schedulingMode: 'push', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
        defectRate: 1.0, reworkRate: 0, operatingCost: 0, qualityCheckpoints: [], skillRequirements: [], toolRequirements: [], capacityConstraints: [], setupHistory: [],
      },
      assy_p_proc: {
        id: 'assy_p_proc', label: 'P:組立(Push)', type: 'assembly',
        cycleTime: 40, setupTime: 0, equipmentCount: 1, operatorCount: 2, availability: 95,
        inputMaterials: [{ materialId: 'proc_p', materialName: 'P:加工品', requiredQuantity: 2, unit: '個', timing: 'start',
          qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
          storageLocation: 'P加工出力', supplyMethod: 'automated',
          schedulingMode: 'push', batchSize: 2, minBatchSize: 2, maxBatchSize: 10,
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 5, initialStock: 0, safetyStock: 2, location: 'P組立前', notes: '' } }],
        outputProducts: [{ productId: 'assy_p', productName: 'P:組立品', outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 40, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 2, initialStock: 0, safetyStock: 0, location: 'P組立後', notes: '' } }],
        bomMappings: [], schedulingMode: 'push', batchSize: 2, minBatchSize: 2, maxBatchSize: 10,
        defectRate: 0.5, reworkRate: 0, operatingCost: 0, qualityCheckpoints: [], skillRequirements: [], toolRequirements: [], capacityConstraints: [], setupHistory: [],
      },
      mach_k: {
        id: 'mach_k', label: 'K:加工(Pull)', type: 'machining',
        cycleTime: 20, setupTime: 0, equipmentCount: 2, operatorCount: 2, availability: 95,
        inputMaterials: [{ materialId: 'raw', materialName: '素材', requiredQuantity: 1, unit: '個', timing: 'start',
          qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
          storageLocation: '部品倉庫', supplyMethod: 'kanban',
          schedulingMode: 'pull', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
          kanbanSettings: { enabled: true, cardCount: 3, reorderPoint: 10, maxInventory: 30, supplierLeadTime: 1, kanbanType: 'production' as const },
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 3, initialStock: 15, safetyStock: 10, location: 'K加工前', notes: 'Kanban制御' } }],
        outputProducts: [{ productId: 'proc_k', productName: 'K:加工品', outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 20, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 3, initialStock: 0, safetyStock: 0, location: 'K加工後', notes: '' } }],
        bomMappings: [], schedulingMode: 'pull', batchSize: 10, minBatchSize: 1, maxBatchSize: 20,
        defectRate: 1.0, reworkRate: 0, operatingCost: 0, qualityCheckpoints: [], skillRequirements: [], toolRequirements: [], capacityConstraints: [], setupHistory: [],
      },
      assy_k_proc: {
        id: 'assy_k_proc', label: 'K:組立(Pull)', type: 'assembly',
        cycleTime: 40, setupTime: 0, equipmentCount: 1, operatorCount: 2, availability: 95,
        inputMaterials: [{ materialId: 'proc_k', materialName: 'K:加工品', requiredQuantity: 2, unit: '個', timing: 'start',
          qualitySpec: { parameter: '', targetValue: 0, upperLimit: 0, lowerLimit: 0, unit: '', measurementMethod: '' },
          storageLocation: 'K加工出力', supplyMethod: 'kanban',
          schedulingMode: 'pull', batchSize: 2, minBatchSize: 2, maxBatchSize: 6,
          kanbanSettings: { enabled: true, cardCount: 2, reorderPoint: 4, maxInventory: 10, supplierLeadTime: 1, kanbanType: 'withdrawal' as const },
          bufferSettings: { enabled: true, bufferType: 'input', maxLots: 2, initialStock: 0, safetyStock: 4, location: 'K組立前', notes: 'Kanban制御' } }],
        outputProducts: [{ productId: 'assy_k', productName: 'K:組立品', outputQuantity: 1, unit: '個', qualityLevel: 'standard', cycleTime: 40, setupTime: 0,
          bufferSettings: { enabled: true, bufferType: 'output', maxLots: 1, initialStock: 0, safetyStock: 0, location: 'K組立後', notes: '' } }],
        bomMappings: [], schedulingMode: 'pull', batchSize: 2, minBatchSize: 2, maxBatchSize: 6,
        defectRate: 0.5, reworkRate: 0, operatingCost: 0, qualityCheckpoints: [], skillRequirements: [], toolRequirements: [], capacityConstraints: [], setupHistory: [],
      },
    },
  };

  // 保存
  localStorage.setItem('projects', JSON.stringify([project]));
  localStorage.setItem(`project_${project.id}_network`, JSON.stringify(networkData));
  localStorage.setItem('lastSelectedProjectId', project.id);

  // 部品データ
  const now = new Date().toISOString();
  const components = networkData.products.map((p: any) => ({
    id: p.id, name: p.name, code: p.code, type: p.type,
    version: '1.0', description: p.name, unitCost: p.unitCost || 0, leadTime: 0,
    supplier: p.type === 'raw_material' ? '外部調達' : '自社製造',
    storageConditions: '常温', isDefective: false, qualityGrade: 'standard',
    category: p.type === 'raw_material' ? 'cat_1' : p.type === 'finished_product' ? 'cat_4' : 'cat_2',
    unit: '個', specifications: {},
    bomItems: networkData.bom_items.filter((b: any) => b.parent_product === p.id).map((b: any) => ({
      id: b.id, parentProductId: p.id, childProductId: b.child_product,
      quantity: b.quantity, unit: '個', isOptional: false, effectiveDate: now, alternativeProducts: [], notes: '',
    })),
    transportLotSize: 10, createdAt: now, updatedAt: now,
  }));
  localStorage.setItem(`project_${project.id}_components`, JSON.stringify({
    components,
    categories: [
      { id: 'cat_1', name: '原材料', description: '購入素材' },
      { id: 'cat_2', name: '部品', description: '加工部品' },
      { id: 'cat_4', name: '完成品', description: '最終製品' },
    ],
  }));

  return { project, networkData };
}
