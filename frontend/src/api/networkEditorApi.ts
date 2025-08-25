import { networkApi } from './simulationApi';
import { ProcessNodeData, ConnectionData } from '../types/networkEditor';

export interface NetworkData {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: ProcessNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    data: ConnectionData;
  }>;
}

// バックエンドの形式に変換
export const convertToBackendFormat = (networkData: NetworkData) => {
  const processes: Record<string, any> = {};
  const connections: Record<string, any> = {};
  
  // ノードを工程に変換
  networkData.nodes.forEach(node => {
    processes[node.id] = {
      id: node.id,
      name: node.data.label,
      type: node.data.type,
      position: node.position,
      equipmentCount: node.data.equipmentCount,
      inputs: [], // エッジから計算
      outputs: [], // エッジから計算
      cycleTime: node.data.cycleTime,
      setupTime: node.data.setupTime,
      // バッファ容量は材料設定で部品・製品ごとに管理
      qualitySettings: node.data.qualitySettings,
      schedulingSettings: node.data.schedulingSettings,
    };
  });
  
  // エッジを接続に変換
  networkData.edges.forEach(edge => {
    connections[edge.id] = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      transportTime: edge.data.transportTime,
      transportLotSize: edge.data.transportLotSize,
      distance: edge.data.distance,
      transportSettings: edge.data.transportSettings,
      transportMethods: edge.data.transportMethods,
    };
    
    // 入出力情報を更新
    if (processes[edge.source]) {
      processes[edge.source].outputs.push(edge.target);
    }
    if (processes[edge.target]) {
      processes[edge.target].inputs.push(edge.source);
    }
  });
  
  return { processes, connections };
};

// フロントエンドの形式に変換
export const convertFromBackendFormat = (backendData: any): NetworkData => {
  const nodes: NetworkData['nodes'] = [];
  const edges: NetworkData['edges'] = [];
  
  // 工程をノードに変換
  if (backendData.processes) {
    Object.entries(backendData.processes).forEach(([id, process]: [string, any]) => {
      nodes.push({
        id,
        type: 'process',
        position: process.position || { x: 100, y: 100 },
        data: {
          label: process.name || 'Unknown Process',
          name: process.name,
          type: process.type,
          cycleTime: process.cycleTime || 60,
          setupTime: process.setupTime || 300,
          equipmentCount: process.equipmentCount || 1,
          operatorCount: process.operatorCount || 1,
          // バッファ容量は材料設定で部品・製品ごとに管理
          qualitySettings: process.qualitySettings || {
            defectRate: process.defectRate || 2,
            reworkRate: process.reworkRate || 1,
            scrapRate: 0.5,
            inspectionTime: 30,
            inspectionCapacity: 60,
          },
          schedulingSettings: process.schedulingSettings || {
            mode: 'push',
            batchSize: 10,
            leadTime: 300,
            kanbanCards: 5,
            pushThreshold: 80,
            pullSignal: 'inventory_level',
          },
          inputs: process.inputs || [],
          outputs: process.outputs || [],
        },
      });
    });
  }
  
  // 接続をエッジに変換
  if (backendData.connections) {
    Object.entries(backendData.connections).forEach(([id, connection]: [string, any]) => {
      edges.push({
        id,
        source: connection.source,
        target: connection.target,
        type: 'transport',
        data: {
          transportTime: connection.transportTime || 30,
          transportLotSize: connection.transportLotSize || 10,
          distance: connection.distance || 10,
          transportType: connection.transportType || 'conveyor',
          transportSettings: connection.transportSettings || {
            defaultMethod: '',
            enableCapacityControl: true,
            enableRouting: false,
            congestionHandling: 'queue',
          },
          transportMethods: connection.transportMethods || [],
        },
      });
    });
  }
  
  return { nodes, edges };
};

export const networkEditorApi = {
  // ネットワークを保存
  async saveNetwork(networkData: NetworkData) {
    const backendFormat = convertToBackendFormat(networkData);
    return await networkApi.save(backendFormat);
  },
  
  // ネットワークを読込
  async loadNetwork(): Promise<NetworkData> {
    const backendData = await networkApi.load();
    return convertFromBackendFormat(backendData);
  },
  
  // サンプルネットワークを取得
  async getSampleNetwork(): Promise<NetworkData> {
    const backendData = await networkApi.getSample();
    return convertFromBackendFormat(backendData);
  },

  // 自動車部品製造ラインのデモネットワークを取得
  async getAutomotiveDemo(): Promise<NetworkData> {
    const response = await fetch('/api/network/demo/automotive');
    const data = await response.json();
    return convertFromBackendFormat(data);
  },
};