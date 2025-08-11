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
import { Box, Paper, Drawer, IconButton, Tooltip, Fab, SpeedDial, SpeedDialAction, SpeedDialIcon, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon, ListItemText, Checkbox } from '@mui/material';
import {
  Settings as MachiningIcon,
  Build as AssemblyIcon,
  Search as InspectionIcon,
  Inventory as StorageIcon,
  LocalShipping as ShippingIcon,
  Save as SaveIcon,
  Upload as LoadIcon,
  PlayArrow as SimulateIcon,
  Analytics as AnalyzeIcon,
  Science as SampleIcon,
  DirectionsCar,
  CheckCircle as ValidateIcon,
  Inventory as BOMIcon,
  Settings as AdvancedIcon,
  Build as MaterialIcon,
  Help as HelpIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import ProcessNode from './ProcessNode';
import TransportEdge from './TransportEdge';
import ProcessEditDialog from './ProcessEditDialog';
import ConnectionEditDialog from './ConnectionEditDialog';
import IEAnalysisPanel from './IEAnalysisPanel';
import NetworkValidationPanel from './NetworkValidationPanel';
import BOMManager from '../production/BOMManager';
import AdvancedProcessDialog from '../production/AdvancedProcessDialog';
import ProcessMaterialDialog from '../production/ProcessMaterialDialog';
import { ProcessNodeData, ConnectionData, nodeTemplates } from '../../types/networkEditor';
import { Product, BOMItem, ProductVariant, AdvancedProcessData } from '../../types/productionTypes';
import { networkEditorApi } from '../../api/networkEditorApi';
import { simulationApi } from '../../api/simulationApi';
import { useNavigate } from 'react-router-dom';

const nodeTypes = {
  process: ProcessNode,
};

const edgeTypes = {
  transport: TransportEdge,
};

const defaultEdgeOptions = {
  type: 'default',
  style: { stroke: '#2196f3', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
};

const NetworkEditor: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  // プロジェクト状態から取得
  const currentProject = useSelector((state: RootState) => state.project.currentProject);
  const projectNetworkData = useSelector((state: RootState) => state.project.networkData);
  
  // プロジェクトのネットワークデータから初期値を取得
  const savedNodes = projectNetworkData?.nodes || [];
  const savedEdges = projectNetworkData?.edges || [];
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNodeData>(savedNodes);
  const [edges, setEdges, defaultOnEdgesChange] = useEdgesState<ConnectionData>(savedEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<ProcessNodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge<ConnectionData> | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [connectionEditDialogOpen, setConnectionEditDialogOpen] = useState(false);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const [validationPanelOpen, setValidationPanelOpen] = useState(false);
  const [bomPanelOpen, setBomPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'analysis' | 'validation' | 'bom' | 'advanced'>('validation');
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
  
  // 工程ごとの材料データ管理
  const [processAdvancedData, setProcessAdvancedData] = useState<Map<string, AdvancedProcessData>>(new Map());
  // 出力製品選択ダイアログ
  const [selectOutputDialogOpen, setSelectOutputDialogOpen] = useState(false);
  const [pendingConnect, setPendingConnect] = useState<{source: string; target: string} | null>(null);
  const [selectableOutputs, setSelectableOutputs] = useState<{productId: string; productName: string}[]>([]);
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);

  // プロジェクトが変更されたときにネットワークデータを読み込む
  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchProjectNetwork(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  // プロジェクトネットワークデータが更新されたときにReactFlowの状態を更新
  useEffect(() => {
    if (projectNetworkData) {
      setNodes(projectNetworkData.nodes || []);
      setEdges(projectNetworkData.edges || []);
      setIsInitialized(true);
    }
  }, [projectNetworkData, setNodes, setEdges]);

  // 接続削除時に関連する材料を自動削除する関数
  const cleanupMaterialsOnEdgeRemoval = useCallback((removedEdges: Edge[], currentProcessData: Map<string, AdvancedProcessData>, currentNodes: Node<ProcessNodeData>[]) => {
    removedEdges.forEach(edge => {
      const sourceProcessId = edge.source;
      const targetProcessId = edge.target;
      
      // 接続先工程のデータを取得
      const targetProcessData = currentProcessData.get(targetProcessId);
      
      if (targetProcessData) {
        // 削除された接続に関連する自動継承材料を除去
        const filteredMaterials = targetProcessData.inputMaterials.filter(material => 
          !(material.isAutoInherited && material.sourceProcessId === sourceProcessId)
        );
        
        const removedMaterials = targetProcessData.inputMaterials.filter(material => 
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
          console.log('削除された材料:', removedMaterials.map(m => m.materialName).join(', '));
          
          // ユーザーに通知
          const materialNames = removedMaterials.map(m => m.materialName).join(', ');
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
      .map(change => {
        if (change.type === 'remove') {
          return edges.find(edge => edge.id === change.id);
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

  // 生産管理データ
  const [products, setProducts] = useState<Product[]>([]);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [advancedProcessDialogOpen, setAdvancedProcessDialogOpen] = useState(false);
  const [selectedAdvancedProcess, setSelectedAdvancedProcess] = useState<AdvancedProcessData | null>(null);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [selectedProcessForMaterial, setSelectedProcessForMaterial] = useState<AdvancedProcessData | null>(null);

  // ノードのダブルクリックで編集
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<ProcessNodeData>) => {
    setSelectedNode(node);
    setEditDialogOpen(true);
  }, []);

  // エッジのダブルクリックで編集
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge<ConnectionData>) => {
    console.log('NetworkEditor: Edge double clicked', edge);
    setSelectedEdge(edge);
    setConnectionEditDialogOpen(true);
  }, []);

  // ノード削除（Deleteキー）
  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    const nodeIds = nodesToDelete.map(node => node.id);
    setEdges((edges) => edges.filter(edge => 
      !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
    ));
  }, [setEdges]);

  // キーボードイベント処理
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete') {
      // 選択されたノードを削除
      if (nodes.some(node => node.selected)) {
        const selectedNodes = nodes.filter(node => node.selected);
        onNodesDelete(selectedNodes);
        setNodes((nodes) => nodes.filter(node => !node.selected));
      }
      
              // 選択されたエッジを削除
        if (edges.some(edge => edge.selected)) {
          setEdges((edges) => edges.filter(edge => !edge.selected));
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
    const validNodes = nodes.map(node => ({
      ...node,
      type: node.type || 'process',
    }));
    const validEdges = edges.map(edge => ({
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
            products: projectNetworkData?.products || [],
            bom_items: projectNetworkData?.bom_items || [],
            variants: projectNetworkData?.variants || [],
            process_advanced_data: Object.fromEntries(processAdvancedData),
          }
        }));
      }
      previousNetworkDataRef.current = currentData;
      console.log('Network data updated:', currentData.nodes.length, 'nodes,', currentData.edges.length, 'edges');
    }, 1000); // 1秒のデバウンス（少し長めに）
    
    return () => clearTimeout(timeoutId);
  }, [memoizedNetworkData, dispatch, isInitialized, currentProject?.id, projectNetworkData, processAdvancedData]);

  // 前工程の出力製品を次工程の入力材料として設定する関数
  const inheritProductFlow = useCallback((sourceNodeId: string, targetNodeId: string, restrictToProductIds?: string[]) => {
    const sourceProcessData = processAdvancedData.get(sourceNodeId);
    
    if (sourceProcessData && sourceProcessData.outputProducts.length > 0) {
      // 前工程の出力製品を取得
      const outputProducts = restrictToProductIds && restrictToProductIds.length > 0
        ? sourceProcessData.outputProducts.filter(o => restrictToProductIds.includes(o.productId))
        : sourceProcessData.outputProducts;
      
      // 次工程のデータを取得または作成
      const targetNode = nodes.find(node => node.id === targetNodeId);
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
      const newInputMaterials = outputProducts.map(output => ({
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
        isAutoInherited: true, // 自動継承フラグを設定
      }));
      
      // 既存の入力材料と重複チェック（同じソース工程からの材料は除外して置き換え）
      const filteredExistingMaterials = targetProcessData.inputMaterials.filter(
        material => !(material.isAutoInherited && material.sourceProcessId === sourceNodeId)
      );
      
      const existingMaterialIds = filteredExistingMaterials.map(m => m.materialId);
      const uniqueNewMaterials = newInputMaterials.filter(
        material => !existingMaterialIds.includes(material.materialId)
      );
      
      if (uniqueNewMaterials.length > 0) {
        const updatedTargetData = {
          ...targetProcessData,
          inputMaterials: [...filteredExistingMaterials, ...uniqueNewMaterials],
        };
        
        // 更新されたデータを保存
        setProcessAdvancedData(prev => new Map(prev.set(targetNodeId, updatedTargetData)));
        
        console.log(`工程連携: ${sourceProcessData.label} → ${targetProcessData?.label || '未知の工程'}`);
        console.log('継承された材料:', uniqueNewMaterials.map(m => m.materialName).join(', '));
        
        // ユーザーに成功メッセージを表示
        const materialNames = uniqueNewMaterials.map(m => m.materialName).join(', ');
        setTimeout(() => {
          alert(`✅ 工程連携完了!\n${sourceProcessData.label} → ${targetProcessData?.label || '未知の工程'}\n継承された材料: ${materialNames}`);
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
        edge => edge.source === params.source && edge.target === params.target
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
      setEdges((eds) => addEdge(newEdge, eds));

      // 出力製品の選択が必要か確認
      if (params.source && params.target) {
        const sourceData = processAdvancedData.get(params.source);
        if (sourceData && sourceData.outputProducts.length > 1) {
          // 複数ある場合は選択ダイアログを表示
          setSelectableOutputs(sourceData.outputProducts.map(o => ({ productId: o.productId, productName: o.productName })));
          setSelectedOutputIds(sourceData.outputProducts.map(o => o.productId)); // 既定は全選択
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

      setNodes((nds) => nds.concat(newNode));
      setDraggedNodeType(null);
    },
    [reactFlowInstance, setNodes]
  );

  // ノード編集の保存
  const handleNodeEditSave = useCallback(
    (data: ProcessNodeData) => {
      if (!selectedNode) return;
      
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id
            ? { ...node, data }
            : node
        )
      );
      setEditDialogOpen(false);
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
      
      setEdges((eds) =>
        eds.map((edge) =>
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
      setNodes(networkData.nodes.map(node => ({
        ...node,
        type: node.type || 'process',
      })));
      setEdges(networkData.edges.map(edge => ({
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

  const handleLoadSample = async () => {
    try {
      setLoading(true);
      const networkData = await networkEditorApi.getSampleNetwork();
      
      // ノードとエッジを設定
      setNodes(networkData.nodes.map(node => ({
        ...node,
        type: node.type || 'process',
      })));
      setEdges(networkData.edges.map(edge => ({
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
      setNodes(networkData.nodes.map(node => ({
        ...node,
        type: node.type || 'process',
      })));
      setEdges(networkData.edges.map(edge => ({
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

  const isPanelOpen = analysisPanelOpen || validationPanelOpen || bomPanelOpen;

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
    <Box sx={{ height: '100%', display: 'flex' }}>
      <ReactFlowProvider>
        <Box 
          sx={{ 
            flexGrow: 1, 
            position: 'relative',
            width: isPanelOpen ? 'calc(100% - 400px)' : '100%',
            transition: 'width 0.3s ease'
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

            {/* ヘルプテキスト */}
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                maxWidth: 300,
              }}
            >
              <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    操作方法
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => navigate('/help')}
                    sx={{ 
                      backgroundColor: 'primary.main', 
                      color: 'white',
                      '&:hover': { backgroundColor: 'primary.dark' },
                      width: 24,
                      height: 24,
                    }}
                  >
                    <HelpIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
                  • 工程配置: パレットからドラッグ&ドロップ<br/>
                  • 接続作成: 緑色の点から青色の点へドラッグ<br/>
                  • 工程編集: 工程をダブルクリック<br/>
                  • 接続編集: 接続線をダブルクリック<br/>
                  • 材料設定: 工程を選択→右下の「+」クリック→材料アイコン<br/>
                  • 工程連携: 接続時に前工程の出力製品が自動で次工程の材料に追加<br/>
                  • 接続削除: 接続を削除すると関連する自動継承材料も削除<br/>
                  • メニュー制御: +ボタンで開閉、背景クリック/Escapeで閉じる<br/>
                  • パネル折り畳み: 同じパネルアイコンを再クリックで折り畳み<br/>
                  • 削除: 要素を選択してDeleteキー<br/>
                  • 検証: 右下のアクションメニューから検証パネルを開く
                </Typography>
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                    💡 詳しい使い方は右上の「?」ボタンから
                  </Typography>
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

            {/* アクションボタン */}
            <Box
              sx={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 9999,
              }}
            >
              <SpeedDial
                ariaLabel="Actions"
                icon={<SpeedDialIcon />}
                open={speedDialOpen}
                onOpen={() => setSpeedDialOpen(true)}
                onClose={() => {
                  // 自動では閉じないように空の関数
                }}
                onClick={() => setSpeedDialOpen(!speedDialOpen)}
                sx={{
                  '& .MuiSpeedDial-fab': {
                    zIndex: 9999,
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                  '& .MuiSpeedDialAction-fab': {
                    zIndex: 9998,
                    margin: '8px 0',
                  },
                  '& .MuiSpeedDial-actions': {
                    paddingBottom: '16px',
                  },
                  // マウスリーブでの自動閉じを無効化
                  '& .MuiSpeedDial-root': {
                    '&:hover': {},
                    '&:focus': {},
                  },
                  // ClickAwayListenerを無効化
                  '& .MuiClickAwayListener-root': {
                    pointerEvents: 'none',
                  },
                }}
                direction="up"
                FabProps={{
                  size: 'large',
                  color: 'primary',
                }}
              >
                <SpeedDialAction
                  icon={<SaveIcon />}
                  tooltipTitle="保存"
                  onClick={(e) => { e.stopPropagation(); handleSave(); setSpeedDialOpen(false); }}
                />
                <SpeedDialAction
                  icon={<LoadIcon />}
                  tooltipTitle="読込"
                  onClick={(e) => { e.stopPropagation(); handleLoad(); setSpeedDialOpen(false); }}
                />
                <SpeedDialAction
                  icon={<SampleIcon />}
                  tooltipTitle="基本サンプル読込"
                  onClick={(e) => { e.stopPropagation(); handleLoadSample(); setSpeedDialOpen(false); }}
                />
                <SpeedDialAction
                  icon={<DirectionsCar />}
                  tooltipTitle="自動車デモ読込"
                  onClick={(e) => { e.stopPropagation(); handleLoadAutomotiveDemo(); setSpeedDialOpen(false); }}
                />
                <SpeedDialAction
                  icon={<SimulateIcon />}
                  tooltipTitle="シミュレーション実行"
                  onClick={(e) => { e.stopPropagation(); handleSimulate(); setSpeedDialOpen(false); }}
                />
                <SpeedDialAction
                  icon={<AnalyzeIcon />}
                  tooltipTitle="IE分析パネル"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanel('analysis');
                    // 既に分析パネルが開いていて同じパネルの場合はトグル、そうでなければ開く
                    if (analysisPanelOpen && activePanel === 'analysis') {
                      setAnalysisPanelOpen(false);
                    } else {
                      setAnalysisPanelOpen(true);
                      setValidationPanelOpen(false); // 他のパネルを閉じる
                      setBomPanelOpen(false);
                    }
                    setSpeedDialOpen(false);
                  }}
                />
                <SpeedDialAction
                  icon={<ValidateIcon />}
                  tooltipTitle="検証パネル"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanel('validation');
                    // 既に検証パネルが開いていて同じパネルの場合はトグル、そうでなければ開く
                    if (validationPanelOpen && activePanel === 'validation') {
                      setValidationPanelOpen(false);
                    } else {
                      setValidationPanelOpen(true);
                      setAnalysisPanelOpen(false); // 他のパネルを閉じる
                      setBomPanelOpen(false);
                    }
                    setSpeedDialOpen(false);
                  }}
                />
                <SpeedDialAction
                  icon={<BOMIcon />}
                  tooltipTitle="BOM管理"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanel('bom');
                    // 既にBOMパネルが開いていて同じパネルの場合はトグル、そうでなければ開く
                    if (bomPanelOpen && activePanel === 'bom') {
                      setBomPanelOpen(false);
                    } else {
                      setBomPanelOpen(true);
                      setAnalysisPanelOpen(false); // 他のパネルを閉じる
                      setValidationPanelOpen(false);
                    }
                    setSpeedDialOpen(false);
                  }}
                />
                <SpeedDialAction
                  icon={<AdvancedIcon />}
                  tooltipTitle={selectedNode ? "拡張工程設定" : "拡張工程設定（工程を選択してください）"}
                  FabProps={{
                    disabled: !selectedNode,
                    color: selectedNode ? 'primary' : 'default',
                    sx: {
                      zIndex: 9998,
                      '&:hover': {
                        backgroundColor: selectedNode ? 'primary.dark' : 'default',
                      },
                    },
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (selectedNode) {
                      // 既存の工程データを取得、なければ新規作成
                      let processData = processAdvancedData.get(selectedNode.id);
                      
                      if (!processData) {
                        processData = {
                          id: selectedNode.id,
                          label: selectedNode.data.label,
                          type: selectedNode.data.type,
                          cycleTime: selectedNode.data.cycleTime,
                          setupTime: selectedNode.data.setupTime,
                          equipmentCount: selectedNode.data.equipmentCount,
                          operatorCount: selectedNode.data.operatorCount,
                          availability: selectedNode.data.availability,
                          inputMaterials: [],
                          outputProducts: [],
                          bomMappings: [],
                          schedulingMode: 'push',
                          batchSize: 1,
                          minBatchSize: 1,
                          maxBatchSize: 100,
                          defectRate: selectedNode.data.defectRate,
                          reworkRate: selectedNode.data.reworkRate,
                          operatingCost: selectedNode.data.operatingCost,
                          qualityCheckpoints: [],
                          skillRequirements: [],
                          toolRequirements: [],
                          capacityConstraints: [],
                          setupHistory: [],
                        };
                      }
                      setSelectedAdvancedProcess(processData);
                      setAdvancedProcessDialogOpen(true);
                      // ダイアログを開いたらSpeedDialを閉じる
                      setSpeedDialOpen(false);
                    } else {
                      alert('工程ノードを選択してから設定してください');
                    }
                  }}
                />
                <SpeedDialAction
                  icon={<MaterialIcon />}
                  tooltipTitle={selectedNode ? "工程材料設定" : "工程材料設定（工程を選択してください）"}
                  FabProps={{
                    disabled: !selectedNode,
                    color: selectedNode ? 'secondary' : 'default',
                    sx: {
                      zIndex: 9998,
                      '&:hover': {
                        backgroundColor: selectedNode ? 'secondary.dark' : 'default',
                      },
                    },
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    console.log('Material setting clicked, selectedNode:', selectedNode?.id);
                    if (selectedNode) {
                      // 既存の工程データを取得、なければ新規作成
                      let processData = processAdvancedData.get(selectedNode.id);
                      
                      if (!processData) {
                        processData = {
                          id: selectedNode.id,
                          label: selectedNode.data.label,
                          type: selectedNode.data.type,
                          cycleTime: selectedNode.data.cycleTime,
                          setupTime: selectedNode.data.setupTime,
                          equipmentCount: selectedNode.data.equipmentCount,
                          operatorCount: selectedNode.data.operatorCount,
                          availability: selectedNode.data.availability,
                          inputMaterials: [],
                          outputProducts: [],
                          bomMappings: [],
                          schedulingMode: 'push',
                          batchSize: 1,
                          minBatchSize: 1,
                          maxBatchSize: 100,
                          defectRate: selectedNode.data.defectRate,
                          reworkRate: selectedNode.data.reworkRate,
                          operatingCost: selectedNode.data.operatingCost,
                          qualityCheckpoints: [],
                          skillRequirements: [],
                          toolRequirements: [],
                          capacityConstraints: [],
                          setupHistory: [],
                        };
                      }
                      setSelectedProcessForMaterial(processData);
                      setMaterialDialogOpen(true);
                      // ダイアログを開いたらSpeedDialを閉じる
                      setSpeedDialOpen(false);
                    } else {
                      alert('工程ノードを選択してから設定してください');
                    }
                  }}
                />
              </SpeedDial>
            </Box>
          </ReactFlow>
        </Box>
        
        {/* 統合分析・検証・BOMパネル */}
        <Drawer
          anchor="right"
          open={isPanelOpen}
          variant="persistent"
          sx={{
            width: isPanelOpen ? 400 : 0,
            flexShrink: 0,
            transition: 'width 0.3s ease',
            '& .MuiDrawer-paper': {
              width: 400,
              position: 'relative',
              height: '100%',
              transition: 'transform 0.3s ease',
            },
          }}
        >
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {activePanel === 'analysis' && 'IE分析'}
              {activePanel === 'validation' && 'ネットワーク検証'}
              {activePanel === 'bom' && 'BOM管理'}
              {activePanel === 'advanced' && '拡張設定'}
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
                    }
                  }} 
                  size="small"
                  color={activePanel === 'analysis' ? 'primary' : 'default'}
                >
                  <AnalyzeIcon />
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
                    }
                  }} 
                  size="small"
                  color={activePanel === 'bom' ? 'primary' : 'default'}
                >
                  <BOMIcon />
                </IconButton>
              </Tooltip>
              <IconButton 
                onClick={() => {
                  // 現在開いているパネルを閉じる
                  if (analysisPanelOpen) {
                    setAnalysisPanelOpen(false);
                  }
                  if (validationPanelOpen) {
                    setValidationPanelOpen(false);
                  }
                  if (bomPanelOpen) {
                    setBomPanelOpen(false);
                  }
                }} 
                size="small"
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
          </Box>
        </Drawer>
        
        {/* 工程編集ダイアログ */}
        <ProcessEditDialog
          open={editDialogOpen}
          nodeData={selectedNode?.data || null}
          onClose={() => {
            setEditDialogOpen(false);
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
      </ReactFlowProvider>
    </Box>
  );
};

export default NetworkEditor;





