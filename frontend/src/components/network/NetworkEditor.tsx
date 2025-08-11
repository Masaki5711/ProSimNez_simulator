import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setNodes, setEdges } from '../../store/slices/networkSlice';
import { fetchProjectNetwork, updateProjectNetwork } from '../../store/projectSlice';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  MiniMap,
  Background,
  ReactFlowProvider,
  ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
  ConnectionMode,
  EdgeChange,
} from 'react-flow-renderer';
import { Box, Paper, Drawer, IconButton, Tooltip, Fab, SpeedDial, SpeedDialAction, SpeedDialIcon, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon, ListItemText, Checkbox, Divider, TextField, Slider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ProcessNodeData, ConnectionData } from '../../types/networkEditor';
import { Product, BOMItem, ProductVariant, AdvancedProcessData, MaterialInput, ProductOutput } from '../../types/productionTypes';
import { ProjectNetworkData as ProjectNetworkDataType } from '../../types/projectTypes';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  AccountTree as NetworkIcon,
  Analytics as AnalyticsIcon,
  Settings as MachiningIcon,
  Build as AssemblyIcon,
  Search as InspectionIcon,
  Inventory as StorageIcon,
  LocalShipping as ShippingIcon,
  Rule as ValidateIcon,
  Receipt as BOMIcon,
  Folder as ProjectIcon,
  Help as HelpIcon,
  Close as CloseIcon,
  PlayArrow as PlayArrowIcon,
  Edit,
  Settings,
  Inventory,
} from '@mui/icons-material';

import ProcessEditDialog from './ProcessEditDialog';
import ConnectionEditDialog from './ConnectionEditDialog';
import AdvancedProcessDialog from '../production/AdvancedProcessDialog';
import ProcessMaterialDialog from '../production/ProcessMaterialDialog';
import IEAnalysisPanel from './IEAnalysisPanel';
import NetworkValidationPanel from './NetworkValidationPanel';
import BOMManager from '../production/BOMManager';
import ProcessNode from './ProcessNode';
import TransportEdge from './TransportEdge';

import { networkEditorApi as importedNetworkEditorApi } from '../../api/networkEditorApi';
import { simulationApi as importedSimulationApi } from '../../api/simulationApi';

interface NetworkEditorApiType {
  saveNetwork: (networkData: any) => Promise<any>;
  loadNetwork: () => Promise<any>;
  getSampleNetwork: () => Promise<any>;
  getAutomotiveDemo: () => Promise<any>;
}

interface SimulationApiType {
  start: (config: any) => Promise<any>;
  pause: () => Promise<any>;
  resume: () => Promise<any>;
  stop: () => Promise<any>;
  getStatus: () => Promise<any>;
  setSpeed: (speed: number) => Promise<any>;
  getData: () => Promise<any>;
}

const networkEditorApi: NetworkEditorApiType = importedNetworkEditorApi;
const simulationApi: SimulationApiType = importedSimulationApi;

// nodeTypesとedgeTypesをコンポーネントの外に移動
const nodeTypes = { process: ProcessNode };
const edgeTypes = { transport: TransportEdge };
const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed },
};

const NetworkEditor = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { currentProject, networkData } = useSelector((state: RootState) => state.project);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, defaultOnEdgesChange] = useEdgesState([]);

  const [isInitialized, setIsInitialized] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<ProcessNodeData> | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [processEditDialogOpen, setProcessEditDialogOpen] = useState(false);

  const [selectedEdge, setSelectedEdge] = useState<Edge<ConnectionData> | null>(null);
  const [connectionEditDialogOpen, setConnectionEditDialogOpen] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulationTime, setSimulationTime] = useState(60); // Default to 60 minutes
  const [simulationSpeed, setSimulationSpeed] = useState(1.0); // Default to 1.0x
  const [activePanel, setActivePanel] = useState<'simulation' | 'analysis' | 'validation' | 'bom' | null>(null);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [validationPanelOpen, setValidationPanelOpen] = useState(false);
  const [bomPanelOpen, setBomPanelOpen] = useState(false);
  const [simulationPanelOpen, setSimulationPanelOpen] = useState(false);

  const isPanelOpen = analysisPanelOpen || validationPanelOpen || bomPanelOpen || simulationPanelOpen;

  // 工程ごとの材料データ管理
  const [processAdvancedData, setProcessAdvancedData] = useState<Map<string, AdvancedProcessData>>(new Map());
  // 出力製品選択ダイアログ
  const [selectOutputDialogOpen, setSelectOutputDialogOpen] = useState(false);
  const [pendingConnect, setPendingConnect] = useState<{source: string; target: string} | null>(null);
  const [selectableOutputs, setSelectableOutputs] = useState<{productId: string; productName: string}[]>([]);
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [selectedProcessForMaterial, setSelectedProcessForMaterial] = useState<AdvancedProcessData | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<Node<ProcessNodeData> | null>(null);

  // プロジェクトが変更されたときにネットワークデータを読み込む
  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchProjectNetwork(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  // プロジェクトネットワークデータが更新されたときにReactFlowの状態を更新
  useEffect(() => {
    if (networkData) {
      setNodes(networkData.nodes || []);
      setEdges(networkData.edges || []);
      setIsInitialized(true);
    }
  }, [networkData, setNodes, setEdges]);

  // 接続削除時に関連する材料を自動削除する関数
  const cleanupMaterialsOnEdgeRemoval = useCallback((removedEdges: Edge[], currentProcessData: Map<string, AdvancedProcessData>, currentNodes: Node<ProcessNodeData>[]) => {
    removedEdges.forEach(edge => {
      const sourceProcessId = edge.source;
      const targetProcessId = edge.target;
      
      // 接続先工程のデータを取得
      const targetProcessData = currentProcessData.get(targetProcessId);
      
      if (targetProcessData) {
        // 削除された接続に関連する自動継承材料を除去
        const filteredMaterials = targetProcessData.inputMaterials.filter((material: MaterialInput) => 
          !(material.isAutoInherited && material.sourceProcessId === sourceProcessId)
        );
        
        const removedMaterials = targetProcessData.inputMaterials.filter((material: MaterialInput) => 
          material.isAutoInherited && material.sourceProcessId === sourceProcessId
        );
        
        if (removedMaterials.length > 0) {
          // 更新されたデータを保存
          const updatedTargetData = {
            ...targetProcessData,
            inputMaterials: filteredMaterials,
          };
          
          setProcessAdvancedData(prev => new Map(prev.set(targetProcessId, updatedTargetData)));
          
          console.log(`接続削除による材料自動削除: ${targetProcessData.label}`);
          console.log('削除された材料:', removedMaterials.map((m: MaterialInput) => m.materialName).join(', '));
          
          // ユーザーに通知
          const materialNames = removedMaterials.map((m: MaterialInput) => m.materialName).join(', ');
          const sourceNode = currentNodes.find(n => n.id === sourceProcessId);
          setTimeout(() => {
            alert(`🗑️ 接続削除により材料を自動削除しました\n${sourceNode?.data.label || '前工程'} → ${targetProcessData.label}\n削除された材料: ${materialNames}`);
          }, 500);
        }
      }
    });
  }, []);

  // エッジ変更時の処理（削除時のクリーンアップを含む）
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // 削除されたエッジを検出
    const removedEdges = changes
      .filter(change => change.type === 'remove')
      .map((change: EdgeChange) => {
        if (change.type === 'remove') {
          return edges.find((edge: Edge) => edge.id === change.id);
        }
        return null;
      })
      .filter(Boolean) as Edge[];
    
    // 削除されたエッジに関連する材料を自動削除
    if (removedEdges.length > 0) {
      cleanupMaterialsOnEdgeRemoval(removedEdges, processAdvancedData, nodes);
    }
    
    // デフォルトの変更処理を実行
    defaultOnEdgesChange(changes);
  }, [edges, defaultOnEdgesChange, cleanupMaterialsOnEdgeRemoval, processAdvancedData, nodes]);

  // エスケープキーでSpeedDialを閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSpeedDialOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 工程ノードの設定ボタンクリックイベントをリッスン
  useEffect(() => {
    const handleProcessNodeSettings = (event: CustomEvent) => {
      console.log('NetworkEditor: processNodeSettings event received:', event.detail);
      const { nodeId, nodeData } = event.detail;
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        console.log('NetworkEditor: Found node, opening dialog:', node);
        setSelectedNode(node);
        setProcessEditDialogOpen(true);
      } else {
        console.log('NetworkEditor: Node not found for id:', nodeId);
      }
    };

    window.addEventListener('processNodeSettings', handleProcessNodeSettings as EventListener);
    return () => {
      window.removeEventListener('processNodeSettings', handleProcessNodeSettings as EventListener);
    };
  }, [nodes]);

  // 生産管理データ
  const [products, setProducts] = useState<Product[]>([]);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [advancedProcessDialogOpen, setAdvancedProcessDialogOpen] = useState(false);
  const [selectedAdvancedProcess, setSelectedAdvancedProcess] = useState<AdvancedProcessData | null>(null);

  // ノードのダブルクリックで編集
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<ProcessNodeData>) => {
    setSelectedNode(node);
    setProcessEditDialogOpen(true);
  }, []);

  // ノードの右クリックでコンテキストメニューを表示
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<ProcessNodeData>) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuNode(node);
    setContextMenuOpen(true);
  }, []);

  // コンテキストメニューのアクション
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenuNode) return;
    
    switch (action) {
      case 'basic_edit':
        setSelectedNode(contextMenuNode);
        setProcessEditDialogOpen(true);
        break;
      case 'advanced_edit':
        const existingData = processAdvancedData.get(contextMenuNode.id);
        if (existingData) {
          setSelectedAdvancedProcess(existingData);
        } else {
          // 新規作成
          const newAdvancedData: AdvancedProcessData = {
            id: contextMenuNode.id,
            label: contextMenuNode.data.label,
            type: contextMenuNode.data.type,
            cycleTime: contextMenuNode.data.cycleTime,
            setupTime: contextMenuNode.data.setupTime,
            equipmentCount: contextMenuNode.data.equipmentCount,
            operatorCount: contextMenuNode.data.operatorCount,
            availability: contextMenuNode.data.availability,
            inputMaterials: [],
            outputProducts: [],
            bomMappings: [],
            schedulingMode: 'push',
            batchSize: 1,
            minBatchSize: 1,
            maxBatchSize: 100,
            defectRate: contextMenuNode.data.defectRate,
            reworkRate: contextMenuNode.data.reworkRate,
            operatingCost: contextMenuNode.data.operatingCost,
            qualityCheckpoints: [],
            skillRequirements: [],
            toolRequirements: [],
            capacityConstraints: [],
            setupHistory: [],
          };
          setSelectedAdvancedProcess(newAdvancedData);
        }
        setAdvancedProcessDialogOpen(true);
        break;
      case 'material_edit':
        const materialData = processAdvancedData.get(contextMenuNode.id);
        if (materialData) {
          setSelectedProcessForMaterial(materialData);
        } else {
          // 新規作成
          const newMaterialData: AdvancedProcessData = {
            id: contextMenuNode.id,
            label: contextMenuNode.data.label,
            type: contextMenuNode.data.type,
            cycleTime: contextMenuNode.data.cycleTime,
            setupTime: contextMenuNode.data.setupTime,
            equipmentCount: contextMenuNode.data.equipmentCount,
            operatorCount: contextMenuNode.data.operatorCount,
            availability: contextMenuNode.data.availability,
            inputMaterials: [],
            outputProducts: [],
            bomMappings: [],
            schedulingMode: 'push',
            batchSize: 1,
            minBatchSize: 1,
            maxBatchSize: 100,
            defectRate: contextMenuNode.data.defectRate,
            reworkRate: contextMenuNode.data.reworkRate,
            operatingCost: contextMenuNode.data.operatingCost,
            qualityCheckpoints: [],
            skillRequirements: [],
            toolRequirements: [],
            capacityConstraints: [],
            setupHistory: [],
          };
          setSelectedProcessForMaterial(newMaterialData);
        }
        setMaterialDialogOpen(true);
        break;
    }
    
    setContextMenuOpen(false);
    setContextMenuPosition(null);
    setContextMenuNode(null);
  }, [contextMenuNode, processAdvancedData]);

  // エッジのダブルクリックで編集
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge<ConnectionData>) => {
    console.log('NetworkEditor: Edge double clicked', edge);
    setSelectedEdge(edge);
    setConnectionEditDialogOpen(true);
  }, []);

  // ノード削除（Deleteキー）
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    const nodeIds = nodesToDelete.map(node => node.id);
    setEdges((edges: Edge[]) => edges.filter((edge: Edge) => 
      !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
    ));
  }, [setEdges]);

  // キーボードイベント処理
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete') {
      // 選択されたノードを削除
      if (nodes.some((node: Node) => node.selected)) {
        const selectedNodes = nodes.filter((node: Node) => node.selected);
        onNodesDelete(selectedNodes);
        setNodes((nodes: Node[]) => nodes.filter((node: Node) => !node.selected));
      }
      
              // 選択されたエッジを削除
        if (edges.some((edge: Edge) => edge.selected)) {
          setEdges((edges: Edge[]) => edges.filter((edge: Edge) => !edge.selected));
        }
    }
  }, [nodes, edges, onNodesDelete, setNodes, setEdges]);

  // キーボードイベントリスナーの設定
  React.useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  // 初期化フラグの管理
  const [hasInitializedSamples, setHasInitializedSamples] = useState(false);

  // 初期化完了を設定
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // サンプルデータの初期化（1回のみ）
  useEffect(() => {
    if (!hasInitializedSamples && products.length === 0) {
      initializeSampleData();
      setHasInitializedSamples(true);
    }
  }, [hasInitializedSamples, products.length]);

  // サンプルデータの初期化
  const initializeSampleData = () => {
    const sampleProducts: Product[] = [
      {
        id: 'prod_steel',
        name: '鋼材',
        code: 'STEEL-001',
        type: 'raw_material',
        version: '1.0',
        unitCost: 500,
        leadTime: 7,
        supplier: '鋼材商事',
      },
      {
        id: 'prod_bolt',
        name: 'ボルト',
        code: 'BOLT-M8',
        type: 'component',
        version: '1.0',
        unitCost: 50,
        leadTime: 3,
        supplier: 'ファスナー工業',
      },
      {
        id: 'prod_bracket',
        name: 'ブラケット',
        code: 'BRKT-001',
        type: 'sub_assembly',
        version: '1.0',
        unitCost: 800,
        leadTime: 5,
      },
      {
        id: 'prod_final',
        name: '完成品A',
        code: 'PROD-A',
        type: 'finished_product',
        version: '1.0',
        unitCost: 2000,
        leadTime: 10,
      },
    ];

    const sampleBOMItems: BOMItem[] = [
      {
        id: 'bom_1',
        parentProductId: 'prod_bracket',
        childProductId: 'prod_steel',
        quantity: 1,
        unit: 'kg',
        isOptional: false,
        effectiveDate: new Date(),
      },
      {
        id: 'bom_2',
        parentProductId: 'prod_final',
        childProductId: 'prod_bracket',
        quantity: 2,
        unit: '個',
        isOptional: false,
        effectiveDate: new Date(),
      },
      {
        id: 'bom_3',
        parentProductId: 'prod_final',
        childProductId: 'prod_bolt',
        quantity: 4,
        unit: '個',
        isOptional: false,
        effectiveDate: new Date(),
      },
    ];

    const sampleVariants: ProductVariant[] = [
      {
        id: 'var_a1',
        baseProductId: 'prod_final',
        variantName: '製品A - 標準仕様',
        variantCode: 'PROD-A-STD',
        bom: sampleBOMItems,
        routingId: 'route_1',
        setupRequirements: [],
        demand: {
          dailyDemand: 100,
          weeklyPattern: [100, 100, 100, 100, 100, 0, 0],
          seasonality: 1,
          priority: 'high',
          customerOrders: [],
        },
      },
    ];

    setProducts(sampleProducts);
    setBomItems(sampleBOMItems);
    setVariants(sampleVariants);
  };

  // ノードやエッジのデータをメモ化
  const memoizedNetworkData = useMemo(() => {
    const validNodes = nodes.map((node: Node) => ({
      ...node,
      type: node.type || 'process',
    }));
    const validEdges = edges.map((edge: Edge) => ({
      ...edge,
      type: edge.type || 'default',
      data: edge.data || {
        transportTime: 30,
        transportLotSize: 10,
        transportCost: 50,
        distance: 10,
        transportType: 'conveyor' as const,
      },
    }));
    return { nodes: validNodes, edges: validEdges };
  }, [nodes, edges]);

  // ノードやエッジの変更をReduxに保存（安全な実装）
  const previousNetworkDataRef = useRef<{nodes: any[], edges: any[]} | null>(null);
  
  useEffect(() => {
    if (!isInitialized) return;
    
    // 前回のデータと同じ場合はスキップ
    const currentData = memoizedNetworkData;
    const previousData = previousNetworkDataRef.current;
    
    if (previousData && 
        previousData.nodes.length === currentData.nodes.length &&
        previousData.edges.length === currentData.edges.length) {
      return;
    }
    
    // データが実際に変更された場合のみプロジェクトネットワークを更新
    const timeoutId = setTimeout(() => {
      if (currentProject?.id) {
        dispatch(updateProjectNetwork({
          projectId: currentProject.id,
          networkData: {
            nodes: currentData.nodes,
            edges: currentData.edges,
            products: networkData?.products || [],
            bom_items: networkData?.bom_items || [],
            variants: networkData?.variants || [],
            process_advanced_data: Object.fromEntries(processAdvancedData),
          }
        }));
      }
      previousNetworkDataRef.current = currentData;
      console.log('Network data updated:', currentData.nodes.length, 'nodes,', currentData.edges.length, 'edges');
    }, 1000); // 1秒のデバウンス（少し長めに）
    
    return () => clearTimeout(timeoutId);
  }, [memoizedNetworkData, dispatch, isInitialized, currentProject?.id, networkData, processAdvancedData]);

  // 前工程の出力製品を次工程の入力材料として設定する関数
  const inheritProductFlow = useCallback((sourceNodeId: string, targetNodeId: string, restrictToProductIds?: string[]) => {
    const sourceProcessData = processAdvancedData.get(sourceNodeId);
    
    if (sourceProcessData && sourceProcessData.outputProducts.length > 0) {
      // 前工程の出力製品を取得
      const outputProducts = restrictToProductIds && restrictToProductIds.length > 0
        ? sourceProcessData.outputProducts.filter((o: ProductOutput) => restrictToProductIds.includes(o.productId))
        : sourceProcessData.outputProducts;
      
      // 次工程のデータを取得または作成
      const targetNode = nodes.find((node: Node) => node.id === targetNodeId);
      if (!targetNode) return;
      
      let targetProcessData = processAdvancedData.get(targetNodeId);
      
      if (!targetProcessData) {
        // 次工程のAdvancedProcessDataを新規作成
        targetProcessData = {
          id: targetNodeId,
          label: targetNode.data.label,
          type: targetNode.data.type,
          cycleTime: targetNode.data.cycleTime,
          setupTime: targetNode.data.setupTime,
          equipmentCount: targetNode.data.equipmentCount,
          operatorCount: targetNode.data.operatorCount,
          availability: targetNode.data.availability,
          inputMaterials: [],
          outputProducts: [],
          bomMappings: [],
          schedulingMode: 'push',
          batchSize: 1,
          minBatchSize: 1,
          maxBatchSize: 100,
          defectRate: targetNode.data.defectRate,
          reworkRate: targetNode.data.reworkRate,
          operatingCost: targetNode.data.operatingCost,
          qualityCheckpoints: [],
          skillRequirements: [],
          toolRequirements: [],
          capacityConstraints: [],
          setupHistory: [],
        };
      }
      
      // 前工程の出力製品を次工程の入力材料として追加
      const newInputMaterials: MaterialInput[] = outputProducts.map((output: ProductOutput) => ({
        materialId: output.productId,
        materialName: output.productName,
        requiredQuantity: output.outputQuantity,
        unit: output.unit,
        timing: 'start' as const,
        qualitySpec: {
          parameter: 'visual_inspection',
          targetValue: 100,
          upperLimit: 100,
          lowerLimit: 95,
          unit: '%',
          measurementMethod: 'visual',
        },
        storageLocation: 'line_side',
        supplyMethod: 'automated' as const,
        sourceProcessId: sourceNodeId, // ソース工程IDを記録
        isAutoInherited: true, // 自動継承された材料かどうか
        // デフォルトのスケジューリング設定
        schedulingMode: 'push' as const,
        batchSize: 1,
        minBatchSize: 1,
        maxBatchSize: 100,
        // デフォルトのかんばん設定
        kanbanSettings: {
          enabled: false,
          cardCount: 5,
          reorderPoint: 10,
          maxInventory: 50,
          supplierLeadTime: 3,
          kanbanType: 'production' as const
        }
      }));
      
      // 既存の入力材料と重複チェック（同じソース工程からの材料は除外して置き換え）
      if (!targetProcessData) return;
      
      const filteredExistingMaterials = targetProcessData.inputMaterials.filter(
        (material: MaterialInput) => !(material.isAutoInherited && material.sourceProcessId === sourceNodeId)
      );
      
      const existingMaterialIds = filteredExistingMaterials.map((m: MaterialInput) => m.materialId);
      const uniqueNewMaterials = newInputMaterials.filter(
        (material: MaterialInput) => !existingMaterialIds.includes(material.materialId)
      );
      
      if (uniqueNewMaterials.length > 0) {
        const updatedTargetData = {
          ...targetProcessData,
          inputMaterials: [...filteredExistingMaterials, ...uniqueNewMaterials],
        };
        
        // 更新されたデータを保存
        setProcessAdvancedData(prev => new Map(prev.set(targetNodeId, updatedTargetData)));
        
        console.log(`工程連携: ${sourceProcessData.label} → ${targetProcessData.label || '未知の工程'}`);
        console.log('継承された材料:', uniqueNewMaterials.map((m: MaterialInput) => m.materialName).join(', '));
        
        // ユーザーに成功メッセージを表示
        const materialNames = uniqueNewMaterials.map((m: MaterialInput) => m.materialName).join(', ');
        setTimeout(() => {
          if (targetProcessData) {
            alert(`✅ 工程連携完了!\n${sourceProcessData.label} → ${targetProcessData.label || '未知の工程'}\n継承された材料: ${materialNames}`);
          }
        }, 500);
      }
    }
  }, [processAdvancedData, nodes]);

  // エッジ接続時の処理
  const onConnect = useCallback(
    (params: Connection) => {
      // 接続の妥当性チェック
      if (params.source === params.target) {
        return;
      }
      
      // 既に同じ接続が存在するかチェック
      const existingConnection = edges.find(
        (edge: Edge) => edge.source === params.source && edge.target === params.target
      );
      
      if (existingConnection) {
        return;
      }
      
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        type: 'default',
        style: { stroke: '#2196f3', strokeWidth: 3 },
        data: {
          transportTime: 30,
          transportLotSize: 10,
          transportCost: 50,
          distance: 10,
          transportType: 'conveyor',
        } as ConnectionData,
      };
      
      // エッジを追加
      setEdges((eds: Edge[]) => addEdge(newEdge, eds));

      // 出力製品の選択が必要か確認
      if (params.source && params.target) {
        const sourceData = processAdvancedData.get(params.source);
        if (sourceData && sourceData.outputProducts.length > 1) {
          // 複数ある場合は選択ダイアログを表示
          setSelectableOutputs(sourceData.outputProducts.map((o: ProductOutput) => ({ productId: o.productId, productName: o.productName })));
          setSelectedOutputIds(sourceData.outputProducts.map((o: ProductOutput) => o.productId)); // 既定は全選択
          setPendingConnect({ source: params.source, target: params.target });
          setSelectOutputDialogOpen(true);
        } else {
          // 1件以下は自動継承
          inheritProductFlow(params.source, params.target);
        }
      }
    },
    [setEdges, edges, inheritProductFlow]
  );

  // ドラッグオーバーイベント
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ドロップイベント
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type || !reactFlowInstance || !reactFlowBounds) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // 新しいノードの作成
      const newNode = {
        id: `node_${Date.now()}`,
        type: 'process',
        position,
        data: createDefaultNodeData(type),
      };

      setNodes((nds: Node[]) => nds.concat(newNode));
      setDraggedNodeType(null);
    },
    [reactFlowInstance, setNodes]
  );

  // ノード編集の保存
  const handleNodeEditSave = useCallback(
    (data: ProcessNodeData) => {
      if (!selectedNode) return;
      
      setNodes((nds: Node[]) =>
        nds.map((node: Node) =>
          node.id === selectedNode.id
            ? { ...node, data }
            : node
        )
      );
      setProcessEditDialogOpen(false);
      setSelectedNode(null);
    },
    [selectedNode, setNodes]
  );

  // 接続線編集の保存
  const handleConnectionEditSave = useCallback(
    (data: ConnectionData) => {
      console.log('NetworkEditor: handleConnectionEditSave called', { selectedEdge, data });
      if (!selectedEdge) {
        console.log('NetworkEditor: No selectedEdge found');
        return;
      }
      
      setEdges((eds: Edge[]) =>
        eds.map((edge: Edge) =>
          edge.id === selectedEdge.id
            ? { ...edge, data }
            : edge
        )
      );
      setConnectionEditDialogOpen(false);
      setSelectedEdge(null);
      console.log('NetworkEditor: Connection edit completed');
    },
    [selectedEdge, setEdges]
  );

  // 接続線編集ダイアログを閉じる（Hooksはトップレベルで宣言）
  const handleConnectionEditClose = useCallback(() => {
    console.log('NetworkEditor: ConnectionEditDialog onClose called');
    setConnectionEditDialogOpen(false);
    setSelectedEdge(null);
  }, [setConnectionEditDialogOpen, setSelectedEdge]);

  // ハイライト機能
  const handleHighlightNodes = useCallback((nodeIds: string[]) => {
    console.log('Highlighting nodes:', nodeIds);
    setHighlightedNodes(nodeIds);
    // ハイライトを5秒後に自動クリア
    setTimeout(() => setHighlightedNodes([]), 5000);
  }, []);

  const handleHighlightEdges = useCallback((edgeIds: string[]) => {
    console.log('Highlighting edges:', edgeIds);
    setHighlightedEdges(edgeIds);
    // ハイライトを5秒後に自動クリア
    setTimeout(() => setHighlightedEdges([]), 5000);
  }, []);

  // ドラッグ開始イベント
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedNodeType(nodeType);
  };

  const createDefaultNodeData = (type: string): ProcessNodeData => {
    const templates: Record<string, ProcessNodeData> = {
      machining: {
        label: '機械加工',
        type: 'machining',
        equipmentCount: 2,
        operatorCount: 1,
        cycleTime: 60,
        setupTime: 300,
        availability: 85,
        inputBufferCapacity: 50,
        outputBufferCapacity: 100,
        defectRate: 2.0,
        reworkRate: 1.0,
        operatingCost: 120,
        inputs: [],
        outputs: ['PART_A'],
      },
      assembly: {
        label: '組立',
        type: 'assembly',
        equipmentCount: 1,
        operatorCount: 2,
        cycleTime: 120,
        setupTime: 600,
        availability: 90,
        inputBufferCapacity: 30,
        outputBufferCapacity: 50,
        defectRate: 1.0,
        reworkRate: 0.5,
        operatingCost: 150,
        inputs: ['PART_A', 'PART_B'],
        outputs: ['SUB_ASSY'],
      },
      inspection: {
        label: '検査',
        type: 'inspection',
        equipmentCount: 1,
        operatorCount: 1,
        cycleTime: 30,
        setupTime: 180,
        availability: 95,
        inputBufferCapacity: 20,
        outputBufferCapacity: 20,
        defectRate: 0.5,
        reworkRate: 10.0,
        operatingCost: 80,
        inputs: ['SUB_ASSY'],
        outputs: ['INSPECTED_ASSY'],
      },
      storage: {
        label: '保管',
        type: 'storage',
        equipmentCount: 0,
        operatorCount: 0,
        cycleTime: 5,
        setupTime: 0,
        availability: 99,
        inputBufferCapacity: 1000,
        outputBufferCapacity: 1000,
        defectRate: 0,
        reworkRate: 0,
        operatingCost: 10,
        inputs: ['INSPECTED_ASSY'],
        outputs: ['STORED_PRODUCT'],
      },
      shipping: {
        label: '出荷',
        type: 'shipping',
        equipmentCount: 1,
        operatorCount: 2,
        cycleTime: 45,
        setupTime: 120,
        availability: 95,
        inputBufferCapacity: 100,
        outputBufferCapacity: 0,
        defectRate: 0,
        reworkRate: 0,
        operatingCost: 100,
        inputs: ['STORED_PRODUCT'],
        outputs: [],
      },
    };

    return templates[type] || {
      label: '新しい工程',
      type: 'machining',
      equipmentCount: 1,
      operatorCount: 1,
      cycleTime: 60,
      setupTime: 300,
      availability: 85,
      inputBufferCapacity: 50,
      outputBufferCapacity: 100,
      defectRate: 1.0,
      reworkRate: 0.5,
      operatingCost: 100,
      inputs: [],
      outputs: [],
    };
  };

  // SpeedDial アクション
  const speedDialActions = [
    { icon: <MachiningIcon />, name: '機械加工', type: 'machining' },
    { icon: <AssemblyIcon />, name: '組立', type: 'assembly' },
    { icon: <InspectionIcon />, name: '検査', type: 'inspection' },
    { icon: <StorageIcon />, name: '保管', type: 'storage' },
    { icon: <ShippingIcon />, name: '出荷', type: 'shipping' },
  ];

  const handleSave = async () => {
    try {
      setLoading(true);
      const networkData = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type || 'process',
          position: node.position,
          data: node.data,
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type || 'transport',
          data: edge.data || {
            transportTime: 30,
            transportLotSize: 10,
            transportCost: 50,
            distance: 10,
            transportType: 'conveyor' as const,
          },
        })),
      };
      
      await networkEditorApi.saveNetwork(networkData);
      alert('ネットワークを保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    try {
      setLoading(true);
      const networkData = await networkEditorApi.loadNetwork();
      
      // ノードとエッジを設定
      setNodes(networkData.nodes.map((node: Node) => ({
        ...node,
        type: node.type || 'process',
      })));
      setEdges(networkData.edges.map((edge: Edge) => ({
        ...edge,
        type: edge.type || 'transport',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      })));
      
      // ビューを調整
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView();
        }, 100);
      }
      
      alert('ネットワークを読み込みました');
    } catch (error) {
      console.error('読込エラー:', error);
      alert('読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      // まずネットワークを保存
      await handleSave();
      
      // シミュレーションを開始
      await simulationApi.start({
        start_time: new Date().toISOString(),
        speed: 1.0,
      });
      
      // シミュレーター画面に遷移
      navigate('/');
    } catch (error) {
      console.error('シミュレーション開始エラー:', error);
      alert('シミュレーションの開始に失敗しました');
    }
  };

  const handleSimulateWithSettings = async () => {
    try {
      // シミュレーションを開始
      await simulationApi.start({
        start_time: new Date().toISOString(),
        speed: simulationSpeed,
        duration_minutes: simulationTime,
      });

      // シミュレーター画面に遷移
      navigate('/');
    } catch (error) {
      console.error('シミュレーション開始エラー:', error);
      alert('シミュレーションの開始に失敗しました');
    }
  };

  const handleLoadSample = async () => {
    try {
      setLoading(true);
      const networkData = await networkEditorApi.getSampleNetwork();
      
      // ノードとエッジを設定
      setNodes(networkData.nodes.map((node: Node) => ({
        ...node,
        type: node.type || 'process',
      })));
      setEdges(networkData.edges.map((edge: Edge) => ({
        ...edge,
        type: edge.type || 'transport',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      })));
      
      // ビューを調整
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView();
        }, 100);
      }
      
      alert('基本サンプルネットワークを読み込みました');
    } catch (error) {
      console.error('サンプル読込エラー:', error);
      alert('サンプルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAutomotiveDemo = async () => {
    try {
      setLoading(true);
      const networkData = await networkEditorApi.getAutomotiveDemo();
      
      // ノードとエッジを設定
      setNodes(networkData.nodes.map((node: Node) => ({
        ...node,
        type: node.type || 'process',
      })));
      setEdges(networkData.edges.map((edge: Edge) => ({
        ...edge,
        type: edge.type || 'transport',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      })));
      
      // ビューを調整
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView();
        }, 100);
      }
      
      alert('自動車部品製造ラインのデモを読み込みました');
    } catch (error) {
      console.error('デモ読込エラー:', error);
      alert('デモの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  

  // プロジェクトが選択されていない場合の表示
  if (!currentProject) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography variant="h5" color="text.secondary">
          プロジェクトが選択されていません
        </Typography>
        <Typography variant="body1" color="text.secondary">
          プロジェクトタブからプロジェクトを選択してください
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/projects')}
          sx={{ mt: 2 }}
        >
          プロジェクト選択
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', position: 'relative' }}>
      <ReactFlowProvider>
        <Box 
          sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            width: isPanelOpen ? 'calc(100% - 400px)' : '100%',
            transition: 'width 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box 
            sx={{ 
              flexGrow: 1, 
              position: 'relative',
              width: '100%'
            }} 
            ref={reactFlowWrapper}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onNodeClick={(event, node) => {
                setSelectedNode(node);
                console.log('Node selected:', node.id, node.data.label);
              }}
              onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => {
                if (selectedNodes.length > 0) {
                  setSelectedNode(selectedNodes[0]);
                  console.log('Selection changed - Node:', selectedNodes[0].id);
                } else {
                  setSelectedNode(null);
                  console.log('Selection cleared');
                }
              }}
              onPaneClick={(event) => {
                // 背景（パネル）クリック時はSpeedDialを閉じる
                setSpeedDialOpen(false);
                // ノード選択をクリア
                setSelectedNode(null);
              }}
              connectOnClick={false}
              connectionMode={ConnectionMode.Loose}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              elementsSelectable={true}
              nodesConnectable={true}
              nodesDraggable={true}
              fitView
            >
              <Controls />
              <MiniMap />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

              {/* 右上操作パネル */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 10,
                }}
              >
                <Paper sx={{ p: 1, display: 'flex', gap: 1 }}>
                  <Tooltip title="シミュレーション設定">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        if (simulationPanelOpen && activePanel === 'simulation') {
                          setSimulationPanelOpen(false);
                          setActivePanel(null);
                        } else {
                          setActivePanel('simulation');
                          setSimulationPanelOpen(true);
                          setAnalysisPanelOpen(false);
                          setValidationPanelOpen(false);
                          setBomPanelOpen(false);
                        }
                      }}
                      sx={{
                        color: activePanel === 'simulation' ? 'primary.main' : 'default',
                        backgroundColor: activePanel === 'simulation' ? 'primary.light' : 'transparent'
                      }}
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem />
                  <Tooltip title="IE分析パネル">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        if (analysisPanelOpen && activePanel === 'analysis') {
                          setAnalysisPanelOpen(false);
                          setActivePanel(null);
                        } else {
                          setActivePanel('analysis');
                          setAnalysisPanelOpen(true);
                          setValidationPanelOpen(false);
                          setBomPanelOpen(false);
                          setSimulationPanelOpen(false);
                        }
                      }}
                      sx={{
                        color: activePanel === 'analysis' ? 'primary.main' : 'default',
                        backgroundColor: activePanel === 'analysis' ? 'primary.light' : 'transparent'
                      }}
                    >
                      <AnalyticsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="検証パネル">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        if (validationPanelOpen && activePanel === 'validation') {
                          setValidationPanelOpen(false);
                          setActivePanel(null);
                        } else {
                          setActivePanel('validation');
                          setValidationPanelOpen(true);
                          setAnalysisPanelOpen(false);
                          setBomPanelOpen(false);
                          setSimulationPanelOpen(false);
                        }
                      }}
                      sx={{
                        color: activePanel === 'validation' ? 'primary.main' : 'default',
                        backgroundColor: activePanel === 'validation' ? 'primary.light' : 'transparent'
                      }}
                    >
                      <ValidateIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="BOM管理">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        if (bomPanelOpen && activePanel === 'bom') {
                          setBomPanelOpen(false);
                          setActivePanel(null);
                        } else {
                          setActivePanel('bom');
                          setBomPanelOpen(true);
                          setAnalysisPanelOpen(false);
                          setValidationPanelOpen(false);
                          setSimulationPanelOpen(false);
                        }
                      }}
                      sx={{
                        color: activePanel === 'bom' ? 'primary.main' : 'default',
                        backgroundColor: activePanel === 'bom' ? 'primary.light' : 'transparent'
                      }}
                    >
                      <BOMIcon />
                    </IconButton>
                  </Tooltip>
                </Paper>
              </Box>
              
              {/* 工程パレット */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  zIndex: 10,
                }}
              >
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                    工程パレット
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {speedDialActions.map((action) => (
                      <Tooltip key={action.type} title={action.name}>
                        <Paper
                          sx={{
                            p: 1,
                            cursor: 'grab',
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                          draggable
                          onDragStart={(e) => onDragStart(e, action.type)}
                        >
                          {action.icon}
                        </Paper>
                      </Tooltip>
                    ))}
                  </Box>
                </Paper>
              </Box>

              {/* 選択状態表示 */}
              {selectedNode && (
                <Box
                  sx={{
                    position: 'fixed',
                    bottom: 120,
                    right: 20,
                    zIndex: 9997,
                  }}
                >
                  <Paper sx={{ p: 2, backgroundColor: 'primary.light', color: 'white' }}>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                      選択中の工程
                    </Typography>
                    <Typography variant="body2">
                      {selectedNode.data.label}
                    </Typography>
                    <Typography variant="caption">
                      ID: {selectedNode.id}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </ReactFlow>
          </Box>
          
          {/* 統合分析・検証・BOMパネル */}
          <Drawer
            anchor="right"
            open={isPanelOpen}
            variant="persistent"
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: isPanelOpen ? 400 : 0,
              flexShrink: 0,
              transition: 'width 0.3s ease',
              zIndex: 1000,
              overflow: 'hidden',
              '& .MuiDrawer-paper': {
                width: 400,
                position: 'absolute',
                right: 0,
                top: 0,
                height: '100%',
                transition: 'all 0.3s ease',
                transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)',
                backgroundColor: 'background.paper',
                borderLeft: '1px solid',
                borderColor: 'divider',
                boxShadow: isPanelOpen ? '-4px 0 8px rgba(0,0,0,0.1)' : 'none',
              },
            }}
          >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">
                {activePanel === 'analysis' && 'IE分析'}
                {activePanel === 'validation' && 'ネットワーク検証'}
                {activePanel === 'bom' && 'BOM管理'}
                {activePanel === 'simulation' && 'シミュレーション設定'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="IE分析">
                  <IconButton 
                    onClick={() => {
                      if (activePanel === 'analysis' && analysisPanelOpen) {
                        setAnalysisPanelOpen(false);
                      } else {
                        setActivePanel('analysis');
                        setAnalysisPanelOpen(true);
                        setValidationPanelOpen(false);
                        setBomPanelOpen(false);
                        setSimulationPanelOpen(false);
                      }
                    }} 
                    size="small"
                    color={activePanel === 'analysis' ? 'primary' : 'default'}
                  >
                    <AnalyticsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="ネットワーク検証">
                  <IconButton 
                    onClick={() => {
                      if (activePanel === 'validation' && validationPanelOpen) {
                        setValidationPanelOpen(false);
                      } else {
                        setActivePanel('validation');
                        setValidationPanelOpen(true);
                        setAnalysisPanelOpen(false);
                        setBomPanelOpen(false);
                        setSimulationPanelOpen(false);
                      }
                    }} 
                    size="small"
                    color={activePanel === 'validation' ? 'primary' : 'default'}
                  >
                    <ValidateIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="BOM管理">
                  <IconButton 
                    onClick={() => {
                      if (activePanel === 'bom' && bomPanelOpen) {
                        setBomPanelOpen(false);
                      } else {
                        setActivePanel('bom');
                        setBomPanelOpen(true);
                        setAnalysisPanelOpen(false);
                        setValidationPanelOpen(false);
                        setSimulationPanelOpen(false);
                      }
                    }} 
                    size="small"
                    color={activePanel === 'bom' ? 'primary' : 'default'}
                  >
                    <BOMIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="シミュレーション設定">
                  <IconButton 
                    onClick={() => {
                      if (activePanel === 'simulation' && simulationPanelOpen) {
                        setSimulationPanelOpen(false);
                      } else {
                        setActivePanel('simulation');
                        setSimulationPanelOpen(true);
                        setAnalysisPanelOpen(false);
                        setValidationPanelOpen(false);
                        setBomPanelOpen(false);
                      }
                    }} 
                    size="small"
                    color={activePanel === 'simulation' ? 'primary' : 'default'}
                  >
                    <PlayArrowIcon />
                  </IconButton>
                </Tooltip>
                <IconButton 
                  onClick={() => {
                    // 現在開いているパネルを閉じる
                    setAnalysisPanelOpen(false);
                    setValidationPanelOpen(false);
                    setBomPanelOpen(false);
                    setSimulationPanelOpen(false);
                    setActivePanel(null);
                  }} 
                  size="small"
                  sx={{
                    color: 'error.main',
                    '&:hover': {
                      backgroundColor: 'error.light',
                      color: 'error.contrastText'
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              {activePanel === 'analysis' && (
                <IEAnalysisPanel nodes={nodes} edges={edges} />
              )}
              {activePanel === 'validation' && (
                <NetworkValidationPanel 
                  nodes={nodes} 
                  edges={edges} 
                  onHighlightNodes={handleHighlightNodes}
                  onHighlightEdges={handleHighlightEdges}
                />
              )}
              {activePanel === 'bom' && (
                <BOMManager
                  products={products}
                  bomItems={bomItems}
                  variants={variants}
                  onProductAdd={(product) => setProducts([...products, product])}
                  onProductUpdate={(updatedProduct) => {
                    setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
                  }}
                  onProductDelete={(productId) => {
                    setProducts(products.filter(p => p.id !== productId));
                  }}
                  onBOMUpdate={setBomItems}
                  onVariantUpdate={setVariants}
                />
              )}
              {activePanel === 'simulation' && (
                <Box>
                  <Typography variant="h6" gutterBottom>シミュレーション実行設定</Typography>
                  <TextField
                    label="実行時間 (分)"
                    type="number"
                    value={simulationTime}
                    onChange={(e) => setSimulationTime(Number(e.target.value))}
                    fullWidth
                    margin="normal"
                    inputProps={{ min: 1 }}
                  />
                  <Typography gutterBottom>実行速度 (倍速): {simulationSpeed}x</Typography>
                  <Slider
                    value={simulationSpeed}
                    onChange={(e, newValue) => setSimulationSpeed(newValue as number)}
                    aria-labelledby="simulation-speed-slider"
                    valueLabelDisplay="auto"
                    step={0.1}
                    marks
                    min={0.1}
                    max={10}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={handleSimulateWithSettings}
                  >
                    この設定でシミュレーション実行
                  </Button>
                </Box>
              )}
            </Box>
          </Drawer>
          
          {/* 工程編集ダイアログ */}
          <ProcessEditDialog
            open={processEditDialogOpen}
            nodeData={selectedNode?.data || null}
            onClose={() => {
              setProcessEditDialogOpen(false);
              setSelectedNode(null);
            }}
            onSave={handleNodeEditSave}
            products={products}
          />

          {/* 接続線編集ダイアログ */}
          <ConnectionEditDialog
            open={connectionEditDialogOpen}
            onClose={handleConnectionEditClose}
            onSave={handleConnectionEditSave}
            initialData={selectedEdge?.data || null}
            sourceNodeName={
              selectedEdge ? 
                nodes.find(n => n.id === selectedEdge.source)?.data.label || selectedEdge.source :
                undefined
            }
            targetNodeName={
              selectedEdge ? 
                nodes.find(n => n.id === selectedEdge.target)?.data.label || selectedEdge.target :
                undefined
            }
            sourcePosition={
              selectedEdge ? 
                nodes.find(n => n.id === selectedEdge.source)?.position :
                undefined
            }
            targetPosition={
              selectedEdge ? 
                nodes.find(n => n.id === selectedEdge.target)?.position :
                undefined
            }
          />

          {/* 出力製品選択ダイアログ */}
          <Dialog open={selectOutputDialogOpen} onClose={() => setSelectOutputDialogOpen(false)}>
            <DialogTitle>受け渡す出力製品を選択</DialogTitle>
            <DialogContent>
              <List>
                {selectableOutputs.map(item => {
                  const labelId = `select-output-${item.productId}`;
                  const checked = selectedOutputIds.includes(item.productId);
                  return (
                    <ListItem key={item.productId} button onClick={() => {
                      setSelectedOutputIds(prev => checked
                        ? prev.filter(id => id !== item.productId)
                        : [...prev, item.productId]
                      );
                    }}>
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={checked}
                          tabIndex={-1}
                          disableRipple
                          inputProps={{ 'aria-labelledby': labelId }}
                        />
                      </ListItemIcon>
                      <ListItemText id={labelId} primary={item.productName} secondary={item.productId} />
                    </ListItem>
                  );
                })}
              </List>
              {selectableOutputs.length === 0 && (
                <Typography color="text.secondary">選択可能な出力製品がありません</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectOutputDialogOpen(false)}>キャンセル</Button>
              <Button variant="contained" onClick={() => {
                if (pendingConnect && selectedOutputIds.length > 0) {
                  inheritProductFlow(pendingConnect.source, pendingConnect.target, selectedOutputIds);
                }
                setSelectOutputDialogOpen(false);
                setPendingConnect(null);
              }}>受け渡し</Button>
            </DialogActions>
          </Dialog>

          {/* 拡張工程設定ダイアログ */}
          <AdvancedProcessDialog
            open={advancedProcessDialogOpen}
            processData={selectedAdvancedProcess}
            products={products}
            onClose={() => {
              setAdvancedProcessDialogOpen(false);
              setSelectedAdvancedProcess(null);
            }}
            onSave={(processData) => {
              console.log('Advanced process data saved:', processData);
              // 工程の拡張データを保存
              setProcessAdvancedData(prev => new Map(prev.set(processData.id, processData)));
              setAdvancedProcessDialogOpen(false);
              setSelectedAdvancedProcess(null);
            }}
          />

          {/* 工程材料設定ダイアログ */}
          <ProcessMaterialDialog
            open={materialDialogOpen}
            processData={selectedProcessForMaterial}
            products={products}
            onClose={() => {
              setMaterialDialogOpen(false);
              setSelectedProcessForMaterial(null);
            }}
            onSave={(processData) => {
              console.log('Process material data saved:', processData);
              // 工程の材料データを保存
              setProcessAdvancedData(prev => new Map(prev.set(processData.id, processData)));
              setMaterialDialogOpen(false);
              setSelectedProcessForMaterial(null);
            }}
          />

          {/* コンテキストメニュー */}
          {contextMenuOpen && contextMenuPosition && (
            <Box
              sx={{
                position: 'fixed',
                top: contextMenuPosition.y,
                left: contextMenuPosition.x,
                zIndex: 9999,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: 1,
                boxShadow: 3,
                minWidth: 150,
              }}
            >
              <List dense>
                <ListItem button onClick={() => handleContextMenuAction('basic_edit')}>
                  <ListItemIcon>
                    <Edit />
                  </ListItemIcon>
                  <ListItemText primary="基本編集" />
                </ListItem>
                <ListItem button onClick={() => handleContextMenuAction('advanced_edit')}>
                  <ListItemIcon>
                    <Settings />
                  </ListItemIcon>
                  <ListItemText primary="拡張設定" />
                </ListItem>
                <ListItem button onClick={() => handleContextMenuAction('material_edit')}>
                  <ListItemIcon>
                    <Inventory />
                  </ListItemIcon>
                  <ListItemText primary="材料設定" />
                </ListItem>
              </List>
            </Box>
          )}
        </Box>
      </ReactFlowProvider>
    </Box>
  );
};

export default NetworkEditor;





