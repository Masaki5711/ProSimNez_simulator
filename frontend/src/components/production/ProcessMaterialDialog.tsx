import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Inventory as MaterialIcon,
  Factory as ProcessIcon,
  Schedule as TimingIcon,
  LocalShipping as SupplyIcon,
} from '@mui/icons-material';
import {
  Product,
  AdvancedProcessData,
  MaterialInput,
  ProductOutput,
} from '../../types/productionTypes';

interface ProcessMaterialDialogProps {
  open: boolean;
  processData: AdvancedProcessData | null;
  products: Product[];
  nodes?: any[];
  edges?: any[];
  processAdvancedData?: Map<string, AdvancedProcessData>;
  onClose: () => void;
  onSave: (processData: AdvancedProcessData) => void;
  // 前工程の出力製品を取得するための関数を追加
  getPrecedingOutputs?: (processId: string) => Product[];
  // 保管庫かどうかを判定するフラグを追加
  isStorageProcess?: boolean;
}

const ProcessMaterialDialog: React.FC<ProcessMaterialDialogProps> = ({
  open,
  processData,
  products,
  nodes = [],
  edges = [],
  processAdvancedData = new Map(),
  onClose,
  onSave,
  getPrecedingOutputs,
  isStorageProcess = false,
}) => {
  const [editingProcess, setEditingProcess] = useState<AdvancedProcessData | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<MaterialInput>>({
    requiredQuantity: 1,
    unit: '個',
    timing: 'start',
    supplyMethod: 'manual',
    storageLocation: '',
    isDefective: false,
    qualityGrade: 'A',
    initialBufferSettings: {
      enabled: false,
      initialStock: 0,
      safetyStock: 0,
      maxCapacity: 100,
      bufferType: 'input',
      location: '',
      notes: ''
    }
  });
  const [newOutput, setNewOutput] = useState<Partial<ProductOutput>>({
    outputQuantity: 1,
    unit: '個',
    qualityLevel: 'standard',
    setupTime: 0,
  });
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null);
  const [editingOutputIndex, setEditingOutputIndex] = useState<number | null>(null);

  // 前工程を取得する関数
  const getPrecedingProcesses = useCallback(() => {
    if (!processData?.id) return [];
    
    console.log('🔍 getPrecedingProcesses 呼び出し:', {
      processId: processData.id,
      edgesCount: edges.length,
      nodesCount: nodes.length,
      processAdvancedDataSize: processAdvancedData.size
    });
    
    const filteredEdges = edges.filter(edge => edge.target === processData.id);
    console.log('🔗 対象エッジ:', filteredEdges);
    
    const precedingProcesses = filteredEdges.map(edge => {
        const sourceNode = nodes.find(node => node.id === edge.source);
        const sourceProcessData = processAdvancedData.get(edge.source);
      
      console.log(`📋 エッジ ${edge.source} -> ${edge.target}:`, {
        sourceNode: sourceNode?.data,
        sourceProcessData: sourceProcessData
      });
      
        return {
          id: edge.source,
          name: sourceNode?.data?.label || sourceNode?.data?.name || 'Unknown Process',
          data: sourceProcessData
        };
    });
    
    const validProcesses = precedingProcesses.filter(process => process.data);
    console.log('✅ 有効な前工程:', validProcesses);
    
    return validProcesses;
  }, [processData, edges, nodes, processAdvancedData]);

  // 前工程の出力製品を取得する関数
  const getPrecedingOutputProducts = useCallback(() => {
    const precedingProcesses = getPrecedingProcesses();
    const outputProducts: any[] = [];
    
    console.log('🔍 前工程検索:', { 
      processId: processData?.id, 
      edges: edges.length, 
      precedingProcesses: precedingProcesses.length 
    });
    
    precedingProcesses.forEach(process => {
      console.log(`📋 前工程 ${process.name}:`, process.data);
      
      if (process.data?.outputProducts) {
        process.data.outputProducts.forEach((output: any) => {
          const product = products.find(p => p.id === output.productId);
          if (product) {
            outputProducts.push({
              ...product,
              processName: process.name,
              processId: process.id,
              outputQuantity: output.outputQuantity,
              qualityLevel: output.qualityLevel
            });
            console.log(`✅ 出力製品追加: ${product.name} (${process.name})`);
          } else {
            console.log(`⚠️ 製品が見つかりません: ${output.productId}`);
          }
        });
      } else {
        console.log(`⚠️ 前工程 ${process.name} に出力製品がありません`);
      }
    });
    
    console.log(`📊 前工程出力製品数: ${outputProducts.length}`);
    return outputProducts;
  }, [getPrecedingProcesses, products, processData?.id, edges]);

  // 先頭ノードかどうかを判定する関数
  const isHeadNode = useCallback(() => {
    if (!processData?.id || !edges || edges.length === 0) return false;
    
    // このノードをターゲットとするエッジが存在しない場合、先頭ノード
    const hasIncomingEdges = edges.some(edge => edge.target === processData.id);
    return !hasIncomingEdges;
  }, [processData?.id, edges]);

  // 先頭保管ノードかどうかを判定する関数
  const isHeadStorageNode = useCallback(() => {
    return isHeadNode() && isStorageProcess;
  }, [isHeadNode, isStorageProcess]);

  // 先頭保管ノード有効化の状態
  const [enableHeadStorageNode, setEnableHeadStorageNode] = useState(false);

  // 先頭保管ノード設定変更時の処理
  const handleHeadStorageNodeToggle = (enabled: boolean) => {
    setEnableHeadStorageNode(enabled);
    
    if (enabled && editingProcess) {
      console.log('🔍 先頭保管ノード有効化: 既存の投入材料の初期バッファ設定を更新中...');
      
      // 既存の投入材料の初期バッファ設定を自動的に有効化
      const updatedInputMaterials = editingProcess.inputMaterials.map(material => {
        const updatedMaterial = {
          ...material,
          initialBufferSettings: {
            ...material.initialBufferSettings,
            enabled: true,
            bufferType: 'input' as const,
            initialStock: material.initialBufferSettings?.initialStock || 0,
            safetyStock: material.initialBufferSettings?.safetyStock || 0,
            maxCapacity: material.initialBufferSettings?.maxCapacity || 100,
            location: material.initialBufferSettings?.location || '',
            notes: material.initialBufferSettings?.notes || ''
          }
        };
        return updatedMaterial;
      });
      
      setEditingProcess({
        ...editingProcess,
        inputMaterials: updatedInputMaterials as any
      });
      
      console.log('✅ 投入材料の初期バッファ設定更新完了:', updatedInputMaterials);
    }
  };

  // 投入材料の候補を取得
  const getInputMaterialCandidates = useCallback(() => {
    if (!processData) return [];
    
    // 先頭保管ノードが有効な場合は全製品を候補に
    if (isHeadStorageNode() && enableHeadStorageNode) {
      console.log('🔍 先頭保管ノード有効: 全製品を候補に');
      return products;
    }
    
    // 前工程の出力製品を最優先
    const precedingOutputs = getPrecedingOutputProducts();
    if (precedingOutputs.length > 0) {
      return precedingOutputs;
    }
    
    if (isStorageProcess) {
      // ストア工程の場合は前工程の出力製品がない場合のみ全製品を候補に
      return products;
    }
    
    if (getPrecedingOutputs) {
      // 前工程の出力製品を候補に
      const precedingOutputs = getPrecedingOutputs(processData.id);
      if (precedingOutputs.length > 0) {
        return precedingOutputs;
      }
    }
    
    // 前工程の出力製品がない場合は原材料のみ
    return products.filter(p => p.type === 'raw_material');
  }, [processData, products, isStorageProcess, getPrecedingOutputs, getPrecedingOutputProducts, isHeadStorageNode, enableHeadStorageNode]);

  useEffect(() => {
    if (processData) {
      console.log('🔄 ProcessMaterialDialog 初期化:', {
        processId: processData.id,
        processName: processData.label || processData.id,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        processAdvancedDataSize: processAdvancedData.size,
        isHeadNode: isHeadNode(),
        isHeadStorageNode: isHeadStorageNode()
      });
      
      setEditingProcess({
        ...processData,
        inputMaterials: [...(processData.inputMaterials || [])],
        outputProducts: [...(processData.outputProducts || [])],
      });
      
      // 先頭保管ノードの設定を読み込み
      if (isHeadStorageNode()) {
        // 既存の設定があれば読み込み、なければデフォルト値
        const existingSetting = processData.inputMaterials?.some(material => 
          material.initialBufferSettings?.enabled && material.initialBufferSettings?.bufferType === 'input'
        );
        setEnableHeadStorageNode(existingSetting || false);
        console.log('🔍 先頭保管ノード設定読み込み:', existingSetting);
      }
      
      // 前工程の情報を即座に確認
      const precedingProcesses = getPrecedingProcesses();
      const precedingOutputs = getPrecedingOutputProducts();
      
      console.log('📊 初期化時の前工程情報:', {
        precedingProcesses: precedingProcesses.length,
        precedingOutputs: precedingOutputs.length
      });
    }
  }, [processData, nodes, edges, processAdvancedData, getPrecedingProcesses, getPrecedingOutputProducts, isHeadNode, isHeadStorageNode]);

  // 材料投入追加
  const handleAddMaterial = () => {
    if (!newMaterial.materialId || !editingProcess) return;

    const material: MaterialInput = {
      materialId: newMaterial.materialId!,
      materialName: products.find(p => p.id === newMaterial.materialId)?.name || '',
      requiredQuantity: newMaterial.requiredQuantity || 1,
      unit: newMaterial.unit || '個',
      timing: newMaterial.timing || 'start',
      qualitySpec: {
        parameter: newMaterial.qualitySpec?.parameter || '',
        targetValue: newMaterial.qualitySpec?.targetValue || 0,
        upperLimit: newMaterial.qualitySpec?.upperLimit || 0,
        lowerLimit: newMaterial.qualitySpec?.lowerLimit || 0,
        unit: newMaterial.qualitySpec?.unit || '',
        measurementMethod: newMaterial.qualitySpec?.measurementMethod || '',
      },
      storageLocation: newMaterial.storageLocation || '',
      supplyMethod: newMaterial.supplyMethod || 'manual',
      isDefective: newMaterial.isDefective || false,
      qualityGrade: newMaterial.qualityGrade || 'A',
      originalProductId: newMaterial.originalProductId,
      // デフォルトのスケジューリング設定
      schedulingMode: 'push',
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
        kanbanType: 'production'
      },
      // 先頭保管ノードが有効な場合は初期バッファ設定を有効化
      initialBufferSettings: {
        enabled: isHeadStorageNode() && enableHeadStorageNode,
        initialStock: newMaterial.initialBufferSettings?.initialStock || 0,
        safetyStock: newMaterial.initialBufferSettings?.safetyStock || 0,
        maxCapacity: newMaterial.initialBufferSettings?.maxCapacity || 100,
        bufferType: 'input',
        location: newMaterial.initialBufferSettings?.location || '',
        notes: newMaterial.initialBufferSettings?.notes || ''
      }
    };

    setEditingProcess({
      ...editingProcess,
      inputMaterials: [...editingProcess.inputMaterials, material],
    });

    setNewMaterial({
      requiredQuantity: 1,
      unit: '個',
      timing: 'start',
      supplyMethod: 'manual',
      storageLocation: '',
      isDefective: false,
      qualityGrade: 'A',
      initialBufferSettings: {
        enabled: isHeadStorageNode() && enableHeadStorageNode,
        initialStock: 0,
        safetyStock: 0,
        maxCapacity: 100,
        bufferType: 'input',
        location: '',
        notes: ''
      }
    });
  };

  // 出力製品追加
  const handleAddOutput = () => {
    if (!newOutput.productId || !editingProcess) return;

    const output: ProductOutput = {
      productId: newOutput.productId!,
      productName: products.find(p => p.id === newOutput.productId)?.name || '',
      outputQuantity: newOutput.outputQuantity || 1,
      unit: newOutput.unit || '個',
      qualityLevel: newOutput.qualityLevel || 'standard',
      setupTime: newOutput.setupTime || 0,
      packagingSpec: newOutput.packagingSpec,
    };

    setEditingProcess({
      ...editingProcess,
      outputProducts: [...editingProcess.outputProducts, output],
    });

    setNewOutput({
      outputQuantity: 1,
      unit: '個',
      qualityLevel: 'standard',
      setupTime: 0,
    });
  };

  // 材料編集
  const handleEditMaterial = (index: number) => {
    setEditingMaterialIndex(index);
    const material = editingProcess!.inputMaterials[index];
    setNewMaterial({
      ...material,
      materialId: material.materialId,
      requiredQuantity: material.requiredQuantity,
      unit: material.unit,
      timing: material.timing,
      supplyMethod: material.supplyMethod,
      storageLocation: material.storageLocation,
      isDefective: material.isDefective,
      qualityGrade: material.qualityGrade,
      originalProductId: material.originalProductId,
      // スケジューリング設定も含める
      schedulingMode: material.schedulingMode,
      batchSize: material.batchSize,
      minBatchSize: material.minBatchSize,
      maxBatchSize: material.maxBatchSize,
      kanbanSettings: material.kanbanSettings,
      // 初期バッファー設定も含める
      initialBufferSettings: material.initialBufferSettings,
    });
  };

  // 材料更新
  const handleUpdateMaterial = () => {
    if (editingMaterialIndex === null || !editingProcess) return;

    const updatedMaterials = [...editingProcess.inputMaterials];
    updatedMaterials[editingMaterialIndex] = {
      ...updatedMaterials[editingMaterialIndex],
      ...newMaterial,
      materialName: products.find(p => p.id === newMaterial.materialId)?.name || '',
      isDefective: newMaterial.isDefective,
      qualityGrade: newMaterial.qualityGrade,
      originalProductId: newMaterial.originalProductId,
      // スケジューリング設定も含める
      schedulingMode: newMaterial.schedulingMode,
      batchSize: newMaterial.batchSize,
      minBatchSize: newMaterial.minBatchSize,
      maxBatchSize: newMaterial.maxBatchSize,
      kanbanSettings: newMaterial.kanbanSettings,
      // 初期バッファー設定も含める
      initialBufferSettings: newMaterial.initialBufferSettings,
    } as MaterialInput;

    setEditingProcess({
      ...editingProcess,
      inputMaterials: updatedMaterials,
    });

    setEditingMaterialIndex(null);
    setNewMaterial({
      requiredQuantity: 1,
      unit: '個',
      timing: 'start',
      supplyMethod: 'manual',
      storageLocation: '',
      isDefective: false,
      qualityGrade: 'A',
      // デフォルトのスケジューリング設定
      schedulingMode: 'push',
      batchSize: 1,
      minBatchSize: 1,
      maxBatchSize: 100,
      kanbanSettings: {
        enabled: false,
        cardCount: 5,
        reorderPoint: 10,
        maxInventory: 50,
        supplierLeadTime: 3,
        kanbanType: 'production'
      }
    });
  };

  // 材料削除
  const handleDeleteMaterial = (index: number) => {
    if (!editingProcess) return;

    const updatedMaterials = editingProcess.inputMaterials.filter((_, i) => i !== index);
    setEditingProcess({
      ...editingProcess,
      inputMaterials: updatedMaterials,
    });
  };

  // 出力製品削除
  const handleDeleteOutput = (index: number) => {
    if (!editingProcess) return;

    const updatedOutputs = editingProcess.outputProducts.filter((_, i) => i !== index);
    setEditingProcess({
      ...editingProcess,
      outputProducts: updatedOutputs,
    });
  };

  // 保存
  const handleSave = () => {
    if (editingProcess) {
      // 先頭保管ノードの設定を反映
      let updatedProcess = { ...editingProcess };
      
      if (isHeadStorageNode() && enableHeadStorageNode) {
        console.log('🔍 先頭保管ノード設定を反映中...');
        
        // 既存の投入材料の初期バッファ設定を更新
        updatedProcess.inputMaterials = updatedProcess.inputMaterials.map(material => ({
          ...material,
          initialBufferSettings: {
            ...material.initialBufferSettings,
            enabled: true, // 先頭保管ノードが有効な場合は強制的に有効化
            bufferType: 'input' as const,
            initialStock: material.initialBufferSettings?.initialStock || 0,
            safetyStock: material.initialBufferSettings?.safetyStock || 0,
            maxCapacity: material.initialBufferSettings?.maxCapacity || 100,
            location: material.initialBufferSettings?.location || '',
            notes: material.initialBufferSettings?.notes || ''
          }
        })) as any;
        
        console.log('✅ 先頭保管ノード設定反映完了:', updatedProcess.inputMaterials);
      }
      
      onSave(updatedProcess);
    onClose();
    }
  };

  // 投入タイミングのアイコン
  const getTimingIcon = (timing: string) => {
    switch (timing) {
      case 'start': return <TimingIcon color="success" />;
      case 'middle': return <TimingIcon color="warning" />;
      case 'end': return <TimingIcon color="error" />;
      default: return <TimingIcon />;
    }
  };

  // 供給方法のアイコン
  const getSupplyIcon = (method: string) => {
    switch (method) {
      case 'manual': return <SupplyIcon color="primary" />;
      case 'automated': return <SupplyIcon color="success" />;
      case 'kanban': return <SupplyIcon color="info" />;
      default: return <SupplyIcon />;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ProcessIcon />
          <Typography variant="h6">
            工程材料設定: {processData?.label}
            </Typography>
          <Chip 
            label={processData?.type} 
            color="primary"
            size="small"
                />
              </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* 投入材料設定 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
            <Typography variant="h6" gutterBottom>
                  <MaterialIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  投入材料・部品
            </Typography>
            
                {/* 前工程の出力製品情報を表示 */}
                {getPrecedingOutputProducts().length > 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      🔗 <strong>前工程の出力製品</strong>が検出されました。これらを投入材料として使用できます。
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {getPrecedingOutputProducts().map((product, index) => (
                            <Chip
                          key={index}
                              label={`${product.name} (${product.processName})`}
                          size="small"
                              color="primary"
                              variant="outlined"
                          sx={{ mr: 1, mb: 1 }}
                            />
                        ))}
              </Box>
                  </Alert>
                ) : (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      ⚠️ <strong>前工程の出力製品</strong>が検出されませんでした。
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      原材料のみが投入材料として選択可能です。前工程との接続を確認してください。
                    </Typography>
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, fontSize: '12px' }}>
                      <Typography variant="caption" color="text.secondary">
                        <strong>デバッグ情報:</strong>
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ display: 'block', mt: 1 }}>
                        • 接続エッジ数: {edges.length}
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ display: 'block' }}>
                        • 工程ノード数: {nodes.length}
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ display: 'block' }}>
                        • 工程詳細データ数: {processAdvancedData.size}
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ display: 'block' }}>
                        • 前工程数: {getPrecedingProcesses().length}
                      </Typography>
                      <Typography variant="caption" component="div" sx={{ display: 'block' }}>
                        • 前工程出力製品数: {getPrecedingOutputProducts().length}
                      </Typography>
                    </Box>
                  </Alert>
                )}

                {/* 材料追加フォーム */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                      {editingMaterialIndex !== null ? '材料編集' : '材料追加'}
                  </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
                  📥 投入材料設定
            </Typography>
            
                {/* 先頭保管ノード設定 */}
                {isHeadStorageNode() && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      🔍 先頭保管ノードが検出されました
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={enableHeadStorageNode}
                          onChange={(e) => handleHeadStorageNodeToggle(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="先頭保管ノードを有効化（投入部品を自由選択可能）"
                    />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      {enableHeadStorageNode 
                        ? 'ON: 全製品から投入部品を選択できます。初期バッファ設定が自動的に有効化されます。'
                        : 'OFF: 前工程からの接続がない場合、投入部品は設定できません。'
                      }
                    </Typography>
                  </Alert>
                )}

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>投入材料・部品</InputLabel>
                  <Select
                    value={newMaterial.materialId || ''}
                    onChange={(e) => {
                      const selectedProduct = products.find(p => p.id === e.target.value);
                      const precedingProduct = getPrecedingOutputProducts().find(p => p.id === e.target.value);
                      
                      setNewMaterial({
                        ...newMaterial,
                        materialId: e.target.value,
                        materialName: selectedProduct?.name || '',
                        // 前工程の出力製品の場合、関連情報を自動設定
                        ...(precedingProduct && {
                          originalProductId: precedingProduct.id,
                          storageLocation: `前工程: ${precedingProduct.processName}`,
                          supplyMethod: 'kanban' as any
                        })
                      });
                    }}
                  >
                    {/* 先頭保管ノードが有効な場合は全製品を表示 */}
                    {isHeadStorageNode() && enableHeadStorageNode ? (
                      <>
                        <Box>
                          <Typography variant="caption" color="success.main" sx={{ px: 2, py: 1, display: 'block' }}>
                            🎯 先頭保管ノード有効: 全製品から選択可能
                      </Typography>
                          {products.map((product) => (
                            <MenuItem key={product.id} value={product.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MaterialIcon />
                                <Typography>{product.name}</Typography>
                            <Chip
                                  label={product.type} 
                              size="small"
                                  color="default"
                            />
                              </Box>
                            </MenuItem>
                        ))}
                    </Box>
                      </>
                    ) : (
                      /* 通常の材料選択ロジック */
                      <>
                        {/* 前工程の出力製品を最優先表示 */}
                        {getPrecedingOutputProducts().length > 0 ? (
                          <>
                            <Box>
                              <Typography variant="caption" color="primary" sx={{ px: 2, py: 1, display: 'block' }}>
                                🔗 前工程の出力製品（推奨）
                  </Typography>
                              {getPrecedingOutputProducts().map((product) => (
                                <MenuItem key={`preceding_${product.id}`} value={product.id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MaterialIcon />
                                    <Typography>{product.name}</Typography>
                        <Chip
                                      label={`前工程: ${product.processName}`}
                                      size="small" 
                                      color="primary"
                          variant="outlined"
                                    />
                                    <Chip 
                                      label={product.type} 
                          size="small"
                                      color="default"
                        />
                                  </Box>
                                </MenuItem>
                    ))}
          </Box>

                            {/* 原材料（前工程の出力製品がある場合） */}
                            {products.filter(p => p.type === 'raw_material').length > 0 && (
                              <>
                                <Box sx={{ borderTop: 1, borderColor: 'divider', my: 1 }} />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
                                    🌱 原材料（補助的）
                                  </Typography>
                                  {products
                                    .filter(p => p.type === 'raw_material')
                                    .map((product) => (
                                      <MenuItem key={product.id} value={product.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <MaterialIcon />
                                          <Typography>{product.name}</Typography>
                                          <Chip 
                                            label={product.type} 
                            size="small"
                                            color="default"
                                          />
                                        </Box>
                                      </MenuItem>
                                    ))}
                                </Box>
                              </>
                            )}
                          </>
                        ) : (
                          /* 前工程の出力製品がない場合は原材料のみ */
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
                              🌱 原材料
            </Typography>
                            {products
                              .filter(p => p.type === 'raw_material')
                              .map((product) => (
                      <MenuItem key={product.id} value={product.id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MaterialIcon />
                                    <Typography>{product.name}</Typography>
                                    <Chip 
                                      label={product.type} 
                                      size="small" 
                                      color="default"
                                    />
                                  </Box>
                      </MenuItem>
                    ))}
                          </Box>
                        )}
                      </>
                    )}
                  </Select>
                </FormControl>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="必要数量"
                  type="number"
                  value={newMaterial.requiredQuantity || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, requiredQuantity: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.1 }}
                />
                <TextField
                  label="単位"
                  value={newMaterial.unit || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                />
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>投入タイミング</InputLabel>
                  <Select
                            value={newMaterial.timing || 'start'}
                            onChange={(e) => setNewMaterial({ ...newMaterial, timing: e.target.value as any })}
                  >
                    <MenuItem value="start">工程開始時</MenuItem>
                            <MenuItem value="middle">工程中間</MenuItem>
                    <MenuItem value="end">工程終了時</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>供給方法</InputLabel>
                  <Select
                            value={newMaterial.supplyMethod || 'manual'}
                            onChange={(e) => setNewMaterial({ ...newMaterial, supplyMethod: e.target.value as any })}
                  >
                    <MenuItem value="manual">手動供給</MenuItem>
                    <MenuItem value="automated">自動供給</MenuItem>
                    <MenuItem value="kanban">かんばん</MenuItem>
                  </Select>
                </FormControl>
                      </Box>

                <TextField
                  label="保管場所"
                  value={newMaterial.storageLocation || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, storageLocation: e.target.value })}
                        fullWidth
                      />

                      {/* 品質・不良品設定 */}
                      <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          品質・不良品設定
                        </Typography>
                        
                        <FormControlLabel
                          control={
                            <Switch
                              checked={newMaterial.isDefective || false}
                              onChange={(e) => setNewMaterial({
                                ...newMaterial,
                                isDefective: e.target.checked,
                                qualityGrade: e.target.checked ? 'defective' : 'A'
                              })}
                            />
                          }
                          label="不良品として扱う"
                        />

                        {!newMaterial.isDefective && (
                          <FormControl fullWidth sx={{ mt: 1 }}>
                            <InputLabel>品質グレード</InputLabel>
                            <Select
                              value={newMaterial.qualityGrade || 'A'}
                              onChange={(e) => setNewMaterial({ ...newMaterial, qualityGrade: e.target.value as any })}
                            >
                              <MenuItem value="A">A級（最高品質）</MenuItem>
                              <MenuItem value="B">B級（標準品質）</MenuItem>
                              <MenuItem value="C">C級（低品質）</MenuItem>
                            </Select>
                          </FormControl>
                        )}

                        {newMaterial.isDefective && (
                          <TextField
                            label="元製品ID（オプション）"
                            value={newMaterial.originalProductId || ''}
                            onChange={(e) => setNewMaterial({ ...newMaterial, originalProductId: e.target.value })}
                            fullWidth
                            sx={{ mt: 1 }}
                            helperText="この不良品の元となった製品のIDを入力してください"
                          />
                        )}
                      </Box>

                      {/* 部品ごとの初期バッファー設定 */}
                      <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          🗂️ 初期バッファー設定
                        </Typography>
                        
                        <FormControlLabel
                          control={
                            <Switch
                              checked={newMaterial.initialBufferSettings?.enabled || false}
                              onChange={(e) => setNewMaterial({
                                ...newMaterial,
                                initialBufferSettings: {
                                  ...newMaterial.initialBufferSettings,
                                  enabled: e.target.checked,
                                  initialStock: 0,
                                  safetyStock: 0,
                                  maxCapacity: 100,
                                  bufferType: 'input',
                                  location: '',
                                  notes: ''
                                }
                              })}
                            />
                          }
                          label="初期バッファーを有効化"
                        />

                        {newMaterial.initialBufferSettings?.enabled && (
                          <>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                              <FormControl fullWidth>
                                <InputLabel>バッファータイプ</InputLabel>
                                <Select
                                  value={newMaterial.initialBufferSettings.bufferType || 'input'}
                                  onChange={(e) => setNewMaterial({
                                    ...newMaterial,
                                    initialBufferSettings: {
                                      ...newMaterial.initialBufferSettings!,
                                      bufferType: e.target.value as 'input' | 'output' | 'both'
                                    }
                                  })}
                                >
                                  <MenuItem value="input">入力バッファー</MenuItem>
                                  <MenuItem value="output">出力バッファー</MenuItem>
                                  <MenuItem value="both">両方</MenuItem>
                                </Select>
                              </FormControl>

                              <TextField
                                label="最大容量"
                                type="number"
                                value={newMaterial.initialBufferSettings.maxCapacity || 100}
                                onChange={(e) => setNewMaterial({
                                  ...newMaterial,
                                  initialBufferSettings: {
                                    ...newMaterial.initialBufferSettings!,
                                    maxCapacity: Number(e.target.value)
                                  }
                                })}
                                inputProps={{ min: 1 }}
                              />
                            </Box>

                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                              <TextField
                                label="初期在庫数"
                                type="number"
                                value={newMaterial.initialBufferSettings.initialStock || 0}
                                onChange={(e) => setNewMaterial({
                                  ...newMaterial,
                                  initialBufferSettings: {
                                    ...newMaterial.initialBufferSettings!,
                                    initialStock: Number(e.target.value)
                                  }
                                })}
                                inputProps={{ min: 0 }}
                              />
                              <TextField
                                label="安全在庫数"
                                type="number"
                                value={newMaterial.initialBufferSettings.safetyStock || 0}
                                onChange={(e) => setNewMaterial({
                                  ...newMaterial,
                                  initialBufferSettings: {
                                    ...newMaterial.initialBufferSettings!,
                                    safetyStock: Number(e.target.value)
                                  }
                                })}
                                inputProps={{ min: 0 }}
                              />
                            </Box>

                            <TextField
                              label="バッファー位置"
                              value={newMaterial.initialBufferSettings.location || ''}
                              onChange={(e) => setNewMaterial({
                                ...newMaterial,
                                initialBufferSettings: {
                                  ...newMaterial.initialBufferSettings!,
                                  location: e.target.value
                                }
                              })}
                              fullWidth
                              sx={{ mt: 2 }}
                              placeholder="例: 工程前、工程後、倉庫Aなど"
                            />

                            <TextField
                              label="備考"
                              value={newMaterial.initialBufferSettings.notes || ''}
                              onChange={(e) => setNewMaterial({
                                ...newMaterial,
                                initialBufferSettings: {
                                  ...newMaterial.initialBufferSettings!,
                                  notes: e.target.value
                                }
                              })}
                              fullWidth
                              multiline
                              rows={2}
                              sx={{ mt: 2 }}
                              placeholder="バッファーに関する追加情報"
                            />
                          </>
                        )}
                      </Box>

                      {/* 部品ごとのスケジューリング設定 */}
                      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        スケジューリング設定
                      </Typography>
                      
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <FormControl fullWidth>
                          <InputLabel>スケジューリング方式</InputLabel>
                          <Select
                            value={newMaterial.schedulingMode || 'push'}
                            onChange={(e) => setNewMaterial({ ...newMaterial, schedulingMode: e.target.value as any })}
                          >
                            <MenuItem value="push">プッシュ型</MenuItem>
                            <MenuItem value="pull">プル型</MenuItem>
                            <MenuItem value="hybrid">ハイブリッド</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          label="バッチサイズ"
                          type="number"
                          value={newMaterial.batchSize || 1}
                          onChange={(e) => setNewMaterial({ ...newMaterial, batchSize: Number(e.target.value) })}
                          inputProps={{ min: 1 }}
                        />
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="最小バッチサイズ"
                          type="number"
                          value={newMaterial.minBatchSize || 1}
                          onChange={(e) => setNewMaterial({ ...newMaterial, minBatchSize: Number(e.target.value) })}
                          inputProps={{ min: 1 }}
                        />
                        <TextField
                          label="最大バッチサイズ"
                          type="number"
                          value={newMaterial.maxBatchSize || 100}
                          onChange={(e) => setNewMaterial({ ...newMaterial, maxBatchSize: Number(e.target.value) })}
                          inputProps={{ min: 1 }}
                        />
                      </Box>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={newMaterial.kanbanSettings?.enabled || false}
                            onChange={(e) => setNewMaterial({
                              ...newMaterial,
                              kanbanSettings: {
                                ...newMaterial.kanbanSettings,
                                enabled: e.target.checked,
                                cardCount: 5,
                                reorderPoint: 10,
                                maxInventory: 50,
                                supplierLeadTime: 3,
                                kanbanType: 'production'
                              }
                            })}
                          />
                        }
                        label="かんばん方式を有効化"
                      />

                      {newMaterial.kanbanSettings?.enabled && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                          <TextField
                            label="かんばん枚数"
                            type="number"
                            value={newMaterial.kanbanSettings.cardCount || 5}
                            onChange={(e) => setNewMaterial({
                              ...newMaterial,
                              kanbanSettings: {
                                ...newMaterial.kanbanSettings!,
                                cardCount: Number(e.target.value)
                              }
                            })}
                            inputProps={{ min: 1 }}
                          />
                          <TextField
                            label="発注点"
                            type="number"
                            value={newMaterial.kanbanSettings.reorderPoint || 10}
                            onChange={(e) => setNewMaterial({
                              ...newMaterial,
                              kanbanSettings: {
                                ...newMaterial.kanbanSettings!,
                                reorderPoint: Number(e.target.value)
                              }
                            })}
                            inputProps={{ min: 1 }}
                          />
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 1 }}>
              {editingMaterialIndex !== null ? (
                <>
                  <Button
                    startIcon={<SaveIcon />}
                              variant="contained"
                    onClick={handleUpdateMaterial}
                    disabled={!newMaterial.materialId}
                  >
                    更新
                  </Button>
                  <Button
                    startIcon={<CancelIcon />}
                              onClick={() => {
                                setEditingMaterialIndex(null);
                                setNewMaterial({
                                  requiredQuantity: 1,
                                  unit: '個',
                                  timing: 'start',
                                  supplyMethod: 'manual',
                                  storageLocation: '',
                                });
                              }}
                  >
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button
                  startIcon={<AddIcon />}
                            variant="contained"
                  onClick={handleAddMaterial}
                  disabled={!newMaterial.materialId}
                >
                            追加
                </Button>
              )}
            </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>

                {/* 材料一覧 */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    投入材料一覧 ({editingProcess?.inputMaterials.length || 0}項目)
            </Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>材料名</TableCell>
                          <TableCell align="right">数量</TableCell>
                          <TableCell>タイミング</TableCell>
                          <TableCell>供給方法</TableCell>
                          <TableCell>品質・不良品</TableCell>
                          <TableCell>スケジューリング</TableCell>
                          <TableCell>初期バッファー</TableCell>
                          <TableCell align="center">アクション</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {editingProcess?.inputMaterials.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center">
                              <Typography variant="body2" color="textSecondary">
                                材料が設定されていません
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          editingProcess?.inputMaterials.map((material, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <MaterialIcon fontSize="small" />
                <Typography variant="body2">
                                    {material.materialName}
                </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {material.requiredQuantity} {material.unit}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {getTimingIcon(material.timing)}
                                  <Typography variant="caption">
                                    {material.timing === 'start' && '開始時'}
                                    {material.timing === 'middle' && '中間'}
                                    {material.timing === 'end' && '終了時'}
              </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {getSupplyIcon(material.supplyMethod)}
                                  <Typography variant="caption">
                                    {material.supplyMethod === 'manual' && '手動'}
                                    {material.supplyMethod === 'automated' && '自動'}
                                    {material.supplyMethod === 'kanban' && 'かんばん'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {material.isDefective ? (
                    <Chip
                                      label="不良品" 
                                      size="small" 
                                      color="error" 
                      variant="outlined"
                                    />
                                  ) : (
                                    <Chip 
                                      label={`${material.qualityGrade || 'A'}級`} 
                      size="small"
                                      color="success" 
                                      variant="outlined"
                                    />
                                  )}
                                  {material.originalProductId && (
                                    <Typography variant="caption" color="textSecondary">
                                      元製品: {material.originalProductId}
                                    </Typography>
                                  )}
            </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <Typography variant="caption">
                                    {material.schedulingMode === 'push' && 'プッシュ型'}
                                    {material.schedulingMode === 'pull' && 'プル型'}
                                    {material.schedulingMode === 'hybrid' && 'ハイブリッド'}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    バッチ: {material.batchSize}
                                  </Typography>
                                  {material.kanbanSettings?.enabled && (
                                    <Chip 
                                      label="かんばん" 
                                      size="small" 
                                      color="info" 
                                      variant="outlined"
                                    />
                                  )}
          </Box>
                              </TableCell>
                        <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {material.initialBufferSettings?.enabled ? (
                                    <>
                                      <Chip 
                                        label={`${material.initialBufferSettings.bufferType === 'input' ? '入力' : 
                                               material.initialBufferSettings.bufferType === 'output' ? '出力' : '両方'}バッファー`}
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                      />
                                      <Typography variant="caption" color="textSecondary">
                                        初期: {material.initialBufferSettings.initialStock}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary">
                                        最大: {material.initialBufferSettings.maxCapacity}
                                      </Typography>
                                      {material.initialBufferSettings.location && (
                                        <Typography variant="caption" color="textSecondary">
                                          位置: {material.initialBufferSettings.location}
                                        </Typography>
                                      )}
                                    </>
                                  ) : (
                                    <Typography variant="caption" color="textSecondary">
                                      未設定
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="編集">
                          <IconButton
                            size="small"
                                    onClick={() => handleEditMaterial(index)}
                          >
                                    <EditIcon fontSize="small" />
                          </IconButton>
                                </Tooltip>
                                <Tooltip title="削除">
                          <IconButton
                            size="small"
                                    onClick={() => handleDeleteMaterial(index)}
                                    color="error"
                          >
                                    <DeleteIcon fontSize="small" />
                          </IconButton>
                                </Tooltip>
                        </TableCell>
                      </TableRow>
                          ))
                        )}
                  </TableBody>
                </Table>
              </TableContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 出力製品設定 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
            <Typography variant="h6" gutterBottom>
                  <ProcessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  出力製品
            </Typography>

                {/* 出力製品追加フォーム */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>出力製品追加</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>出力製品</InputLabel>
                  <Select
                          value={newOutput.productId || ''}
                          onChange={(e) => setNewOutput({ ...newOutput, productId: e.target.value })}
                  >
                          {products.map((product) => (
                      <MenuItem key={product.id} value={product.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ProcessIcon />
                                <Typography>{product.name}</Typography>
                                <Chip label={product.type} size="small" />
                              </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                <TextField
                  label="出力数量"
                  type="number"
                          value={newOutput.outputQuantity || ''}
                          onChange={(e) => setNewOutput({ ...newOutput, outputQuantity: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.1 }}
                />
                <TextField
                  label="単位"
                          value={newOutput.unit || ''}
                          onChange={(e) => setNewOutput({ ...newOutput, unit: e.target.value })}
                />
                <TextField
                  label="品質レベル"
                          value={newOutput.qualityLevel || ''}
                          onChange={(e) => setNewOutput({ ...newOutput, qualityLevel: e.target.value })}
                />
                      </Box>
                      
                <TextField
                  label="段取り時間（分）"
                  type="number"
                        value={newOutput.setupTime || ''}
                        onChange={(e) => setNewOutput({ ...newOutput, setupTime: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 1 }}
                        helperText="この製品を製造する際の段取り時間を設定してください"
                        fullWidth
                      />

                  <Button
                        startIcon={<AddIcon />}
                    variant="contained"
                        onClick={handleAddOutput}
                        disabled={!newOutput.productId}
                      >
                        追加
                  </Button>
                    </Box>
                  </AccordionDetails>
                </Accordion>

                {/* 出力製品一覧 */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    出力製品一覧 ({editingProcess?.outputProducts.length || 0}項目)
                  </Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>製品名</TableCell>
                          <TableCell align="right">数量</TableCell>
                          <TableCell>品質レベル</TableCell>
                          <TableCell align="right">段取り時間</TableCell>
                          <TableCell align="center">アクション</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {editingProcess?.outputProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography variant="body2" color="textSecondary">
                                出力製品が設定されていません
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          editingProcess?.outputProducts.map((output, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <ProcessIcon fontSize="small" />
                                  <Typography variant="body2">
                                    {output.productName}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {output.outputQuantity} {output.unit}
                              </TableCell>
                              <TableCell>
                                <Chip label={output.qualityLevel} size="small" />
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <TimingIcon fontSize="small" />
                                  <Typography variant="body2">
                                    {output.setupTime}分
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="削除">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteOutput(index)}
                                    color="error"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
            </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 材料バランスチェック */}
        {editingProcess && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              材料バランス
            </Typography>
            <Typography variant="body2">
              投入材料: {editingProcess.inputMaterials.length}種類 / 
              出力製品: {editingProcess.outputProducts.length}種類
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcessMaterialDialog;