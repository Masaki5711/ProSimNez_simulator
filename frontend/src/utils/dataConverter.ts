/**
 * ネットワーク編集とシミュレーター間のデータ変換ユーティリティ
 */
import {
  ProcessNodeData,
  ConnectionData,
  QualitySettings,
  OutputBranch,
  SchedulingSettings,
  ProductSetting,
  WorkingHours,
  BreakTime,
  ProductionScheduleItem,
  InventoryLevel,
  StoreScheduleConfig,
  TransportMethod,
  TransportSettings,
} from '../types/networkEditor';

/**
 * ネットワーク編集のデータをシミュレーション用データに変換
 */
export const convertNetworkToSimulation = (networkData: any) => {
  const nodes = networkData.nodes?.map((node: any) => convertNodeToSimulation(node)) || [];
  const edges = networkData.edges?.map((edge: any) => convertEdgeToSimulation(edge)) || [];

  return {
    nodes,
    edges,
    metadata: {
      convertedAt: new Date().toISOString(),
      version: '1.0',
    },
  };
};

/**
 * ノードデータをシミュレーション用に変換
 */
export const convertNodeToSimulation = (node: any): any => {
  const nodeData = node.data as ProcessNodeData;
  
  const baseData = {
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      ...nodeData,
      // シミュレーション固有の設定
      simulationSettings: {
        enableQualityControl: !!nodeData.qualitySettings,
        enableOutputBranching: !!nodeData.outputBranches?.length,
        enableSchedulingControl: !!nodeData.schedulingSettings,
        enableProductSettings: !!nodeData.productSettings?.length,
      },
    },
  };

  // ストアノードの場合、追加設定を含める
  if (nodeData.type === 'store') {
    (baseData.data as any).storeSimulationSettings = {
      enableStoreSchedule: !!nodeData.storeScheduleConfig,
      enableWorkingHours: !!nodeData.workingHours?.length,
      enableProductionSchedule: !!nodeData.productionSchedule?.length,
      enableInventoryControl: !!nodeData.inventoryLevels?.length,
    };
  }

  return baseData;
};

/**
 * エッジデータをシミュレーション用に変換
 */
export const convertEdgeToSimulation = (edge: any): any => {
  const edgeData = edge.data as ConnectionData;
  
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: {
      ...edgeData,
      // シミュレーション固有の設定
      simulationSettings: {
        enableTransportControl: !!edgeData.transportMethods?.length,
        enableCapacityControl: !!edgeData.transportSettings?.enableCapacityControl,
        enableRouting: !!edgeData.transportSettings?.enableRouting,
      },
    },
  };
};

/**
 * シミュレーションデータをネットワーク編集用に変換
 */
export const convertSimulationToNetwork = (simulationData: any) => {
  const nodes = simulationData.nodes?.map((node: any) => convertSimulationToNode(node)) || [];
  const edges = simulationData.edges?.map((edge: any) => convertSimulationToEdge(edge)) || [];

  return {
    nodes,
    edges,
    metadata: {
      convertedAt: new Date().toISOString(),
      source: 'simulation',
    },
  };
};

/**
 * シミュレーションノードをネットワーク編集用に変換
 */
export const convertSimulationToNode = (node: any): any => {
  const { simulationSettings, storeSimulationSettings, ...nodeData } = node.data;
  
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: nodeData,
  };
};

/**
 * シミュレーションエッジをネットワーク編集用に変換
 */
export const convertSimulationToEdge = (edge: any): any => {
  const { simulationSettings, ...edgeData } = edge.data;
  
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: edgeData,
  };
};

/**
 * データ整合性チェック
 */
export const validateDataConsistency = (networkData: any, simulationData: any): string[] => {
  const errors: string[] = [];
  
  // ノード数の一致確認
  if (networkData.nodes?.length !== simulationData.nodes?.length) {
    errors.push(`ノード数が一致しません（Network: ${networkData.nodes?.length}, Simulation: ${simulationData.nodes?.length}）`);
  }
  
  // エッジ数の一致確認
  if (networkData.edges?.length !== simulationData.edges?.length) {
    errors.push(`エッジ数が一致しません（Network: ${networkData.edges?.length}, Simulation: ${simulationData.edges?.length}）`);
  }
  
  // ノードIDの一致確認
  const networkNodeIds = new Set(networkData.nodes?.map((n: any) => n.id) || []);
  const simulationNodeIds = new Set(simulationData.nodes?.map((n: any) => n.id) || []);
  
  for (const id of networkNodeIds) {
    if (!simulationNodeIds.has(id)) {
      errors.push(`ノードID ${id} がシミュレーションデータに存在しません`);
    }
  }
  
  for (const id of simulationNodeIds) {
    if (!networkNodeIds.has(id)) {
      errors.push(`ノードID ${id} がネットワークデータに存在しません`);
    }
  }
  
  return errors;
};

/**
 * デフォルト品質設定を生成
 */
export const createDefaultQualitySettings = (nodeType: string): QualitySettings => {
  const defaults: Record<string, QualitySettings> = {
    machining: {
      defectRate: 2.0,
      reworkRate: 1.0,
      scrapRate: 0.5,
      inspectionTime: 30,
      inspectionCapacity: 60,
    },
    assembly: {
      defectRate: 1.0,
      reworkRate: 0.5,
      scrapRate: 0.2,
      inspectionTime: 60,
      inspectionCapacity: 30,
    },
    inspection: {
      defectRate: 0,
      reworkRate: 0,
      scrapRate: 0,
      inspectionTime: 30,
      inspectionCapacity: 120,
    },
    storage: {
      defectRate: 0,
      reworkRate: 0,
      scrapRate: 0,
      inspectionTime: 0,
      inspectionCapacity: 9999,
    },
    shipping: {
      defectRate: 0,
      reworkRate: 0,
      scrapRate: 0,
      inspectionTime: 0,
      inspectionCapacity: 20,
    },
  };
  
  return defaults[nodeType] || defaults.machining;
};

/**
 * デフォルトスケジューリング設定を生成
 */
export const createDefaultSchedulingSettings = (nodeType: string): SchedulingSettings => {
  const defaults: Record<string, SchedulingSettings> = {
    machining: {
      mode: 'push',
      batchSize: 10,
      leadTime: 120,
      kanbanCards: 5,
      pushThreshold: 80,
      pullSignal: 'inventory_level',
    },
    assembly: {
      mode: 'pull',
      batchSize: 5,
      leadTime: 240,
      kanbanCards: 3,
      pushThreshold: 70,
      pullSignal: 'kanban_card',
    },
    inspection: {
      mode: 'push',
      batchSize: 1,
      leadTime: 30,
      kanbanCards: 2,
      pushThreshold: 90,
      pullSignal: 'defect_detection',
    },
    storage: {
      mode: 'pull',
      batchSize: 50,
      leadTime: 60,
      kanbanCards: 10,
      pushThreshold: 50,
      pullSignal: 'inventory_request',
    },
    shipping: {
      mode: 'pull',
      batchSize: 100,
      leadTime: 600,
      kanbanCards: 2,
      pushThreshold: 60,
      pullSignal: 'shipping_order',
    },
  };
  
  return defaults[nodeType] || defaults.machining;
};

/**
 * データマイグレーション関数
 */
export const migrateNodeData = (oldNodeData: any): ProcessNodeData => {
  // 古い形式の不良率・手直し率を新しい品質設定に変換
  const qualitySettings: QualitySettings = {
    defectRate: oldNodeData.defectRate || 0,
    reworkRate: oldNodeData.reworkRate || 0,
    scrapRate: 0.5, // デフォルト値
    inspectionTime: 30, // デフォルト値
    inspectionCapacity: 60, // デフォルト値
  };
  
  // 新しいデータ構造に変換
  const newNodeData: ProcessNodeData = {
    ...oldNodeData,
    qualitySettings,
    schedulingSettings: createDefaultSchedulingSettings(oldNodeData.type),
    // 古いフィールドを除去
    defectRate: undefined,
    reworkRate: undefined,
    operatingCost: undefined,
    frequencyTasks: undefined,
  };
  
  // undefined値を削除
  Object.keys(newNodeData).forEach(key => {
    if ((newNodeData as any)[key] === undefined) {
      delete (newNodeData as any)[key];
    }
  });
  
  return newNodeData;
};