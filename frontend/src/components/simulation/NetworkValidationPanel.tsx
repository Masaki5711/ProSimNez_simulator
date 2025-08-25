import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Divider,
  Grid,
  IconButton,
  Tooltip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  BugReport as DebugIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface ConnectionValidation {
  edgeId: string;
  fromNode: string;
  toNode: string;
  transportTime: number;
  transportLotSize: number | null;
  routingRule: string;
  isValid: boolean;
  issues: string[];
}

interface NodeValidation {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'valid' | 'warning' | 'error';
  issues: string[];
  details: {
    basic: Record<string, any>;
    connections: Record<string, any>;
    materials: Record<string, any>;
    simulation: Record<string, any>;
    materialFlow: Record<string, any>;
  };
}

interface ValidationResult {
  nodes: NodeValidation[];
  connections: ConnectionValidation[];
  overall: {
    isValid: boolean;
    totalIssues: number;
    recommendations: string[];
  };
}

const NetworkValidationPanel: React.FC = () => {
  const { network } = useSelector((state: RootState) => state.simulation);
  const { components } = useSelector((state: RootState) => state.components);
  const { currentProject } = useSelector((state: RootState) => state.project);
  
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [connectionValidations, setConnectionValidations] = useState<ConnectionValidation[]>([]);
  const [overallStatus, setOverallStatus] = useState<'valid' | 'warning' | 'error'>('valid');
  const [isValidating, setIsValidating] = useState(false);
  const [validationTimestamp, setValidationTimestamp] = useState<string>('');

  // 材料フロー分析
  const analyzeMaterialFlow = (node: any, incomingEdges: any[], outgoingEdges: any[]) => {
    const nodeData = node.data;
    const analysis = {
      inputMaterials: [] as any[],
      outputProducts: [] as any[],
      flowBalance: {
        inputCapacity: 0,
        outputCapacity: 0,
        balanceRatio: 0,
        isBalanced: false,
      },
      bottlenecks: [] as string[],
      recommendations: [] as string[],
    };

    // 入力材料の分析
    incomingEdges.forEach((edge: any) => {
      const sourceNode = (network as any).nodes?.find((n: any) => n.id === edge.source);
      if (sourceNode) {
        const sourceData = sourceNode.data;
        const inputMaterial = {
          sourceNode: sourceData.label || sourceData.name,
          sourceType: sourceData.type,
          transportTime: edge.data?.transportTime || 0,
          transportCapacity: edge.data?.maxCapacity || 0,
          sourceCapacity: sourceData.equipmentCount && sourceData.cycleTime ? 
            (3600 / sourceData.cycleTime) * sourceData.equipmentCount : 0,
        };
        analysis.inputMaterials.push(inputMaterial);
        analysis.flowBalance.inputCapacity += inputMaterial.sourceCapacity;
      }
    });

    // 出力製品の分析
    outgoingEdges.forEach((edge: any) => {
      const targetNode = (network as any).nodes?.find((n: any) => n.id === edge.target);
      if (targetNode) {
        const targetData = targetNode.data;
        const outputProduct = {
          targetNode: targetData.label || targetData.name,
          targetType: targetData.type,
          transportTime: edge.data?.transportTime || 0,
          transportCapacity: edge.data?.maxCapacity || 0,
          targetCapacity: targetData.equipmentCount && targetData.cycleTime ? 
            (3600 / targetData.cycleTime) * targetData.equipmentCount : 0,
        };
        analysis.outputProducts.push(outputProduct);
        analysis.flowBalance.outputCapacity += outputProduct.targetCapacity;
      }
    });

    // フローバランスの計算
    if (analysis.flowBalance.inputCapacity > 0 && analysis.flowBalance.outputCapacity > 0) {
      analysis.flowBalance.balanceRatio = analysis.flowBalance.inputCapacity / analysis.flowBalance.outputCapacity;
      analysis.flowBalance.isBalanced = Math.abs(analysis.flowBalance.balanceRatio - 1) < 0.1; // 10%以内をバランス済みとする
    }

    // ボトルネックの特定
    if (analysis.flowBalance.inputCapacity > 0 && analysis.flowBalance.outputCapacity > 0) {
      if (analysis.flowBalance.balanceRatio < 0.8) {
        analysis.bottlenecks.push('入力能力が不足しています');
        analysis.recommendations.push('入力工程の能力向上または並列化を検討してください');
      } else if (analysis.flowBalance.balanceRatio > 1.2) {
        analysis.bottlenecks.push('出力能力が不足しています');
        analysis.recommendations.push('出力工程の能力向上または並列化を検討してください');
      }
    }

    // バッファ容量の妥当性チェック
    if (nodeData.inputBufferCapacity && nodeData.outputBufferCapacity) {
      const theoreticalBuffer = Math.max(
        analysis.flowBalance.inputCapacity * 0.1, // 入力能力の10%
        analysis.flowBalance.outputCapacity * 0.1  // 出力能力の10%
      );
      
      if (nodeData.inputBufferCapacity < theoreticalBuffer) {
        analysis.recommendations.push(`入力バッファ容量を${Math.ceil(theoreticalBuffer)}個以上に増やすことを推奨します`);
      }
      
      if (nodeData.outputBufferCapacity < theoreticalBuffer) {
        analysis.recommendations.push(`出力バッファ容量を${Math.ceil(theoreticalBuffer)}個以上に増やすことを推奨します`);
      }
    }

    return analysis;
  };

  // 接続の検証
  const validateConnection = (edge: any, nodes: any[]): ConnectionValidation => {
    const issues: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';
    
    const sourceNode = nodes.find((n: any) => n.id === edge.source);
    const targetNode = nodes.find((n: any) => n.id === edge.target);
    
    if (!sourceNode) {
      issues.push('ソースノードが見つかりません');
      status = 'error';
    }
    
    if (!targetNode) {
      issues.push('ターゲットノードが見つかりません');
      status = 'error';
    }
    
    // 搬送設定の検証
    const edgeData = edge.data || {};
    
    if (!edgeData.transportTime || edgeData.transportTime <= 0) {
      issues.push('搬送時間が設定されていないか、無効な値です');
      status = 'error';
    }
    
    if (!edgeData.transportLotSize || edgeData.transportLotSize <= 0) {
      issues.push('搬送ロットサイズが設定されていないか、無効な値です');
      status = 'error';
    }
    
    if (edgeData.transportCost < 0) {
      issues.push('搬送コストが負の値です');
      status = 'error';
    }
    
    if (edgeData.distance < 0) {
      issues.push('距離が負の値です');
      status = 'error';
    }
    
    // 接続の妥当性検証
    if (sourceNode && targetNode) {
      const sourceType = sourceNode.data?.type;
      const targetType = targetNode.data?.type;
      
      // 保管工程の入力接続チェック
      if (targetType === 'storage' && sourceType === 'storage') {
        issues.push('保管工程同士の接続は推奨されません');
        status = 'warning';
      }
      
      // 検査工程の入力接続チェック
      if (targetType === 'inspection' && sourceType === 'inspection') {
        issues.push('検査工程同士の接続は推奨されません');
        status = 'warning';
      }
    }
    
    return {
      edgeId: edge.id,
      fromNode: sourceNode?.data?.label || sourceNode?.data?.name || edge.source,
      toNode: targetNode?.data?.label || targetNode?.data?.name || edge.target,
      transportTime: edgeData.transportTime,
      transportLotSize: edgeData.transportLotSize,
      routingRule: edgeData.routingRule || 'なし',
      isValid: status === 'valid',
      issues,
    };
  };

  // ノードの検証
  const validateNode = (node: any): ValidationResult => {
    const issues: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';
    
    const nodeData = node.data;
    
    // 基本パラメータの検証
    if (!nodeData.cycleTime || nodeData.cycleTime <= 0) {
      issues.push('サイクルタイムが設定されていないか、無効な値です');
      status = 'error';
    }
    
    if (!nodeData.setupTime || nodeData.setupTime < 0) {
      issues.push('段取り時間が設定されていないか、無効な値です');
      status = 'error';
    }
    
    if (!nodeData.equipmentCount || nodeData.equipmentCount <= 0) {
      issues.push('設備台数が設定されていないか、無効な値です');
      status = 'warning';
    }
    
    if (!nodeData.inputBufferCapacity || nodeData.inputBufferCapacity <= 0) {
      issues.push('入力バッファ容量が設定されていないか、無効な値です');
      status = 'warning';
    }
    
    if (!nodeData.outputBufferCapacity || nodeData.outputBufferCapacity <= 0) {
      issues.push('出力バッファ容量が設定されていないか、無効な値です');
      status = 'warning';
    }
    
    if (nodeData.defectRate < 0 || nodeData.defectRate > 100) {
      issues.push('不良率が0-100%の範囲外です');
      status = 'error';
    }
    
    if (nodeData.operatingCost < 0) {
      issues.push('運転コストが負の値です');
      status = 'error';
    }
    
    // 接続性の検証
    const incomingEdges = (network as any).edges?.filter((e: any) => e.target === node.id) || [];
    const outgoingEdges = (network as any).edges?.filter((e: any) => e.source === node.id) || [];
    
    if (incomingEdges.length === 0 && nodeData.type !== 'store') {
      issues.push('入力接続がありません（原材料工程以外）');
      status = 'warning';
    }
    
    if (outgoingEdges.length === 0 && nodeData.type !== 'shipping') {
      issues.push('出力接続がありません（最終工程以外）');
      status = 'warning';
    }
    
    // 材料フロー分析
    const materialFlow = analyzeMaterialFlow(node, incomingEdges, outgoingEdges);
    
    return {
      nodes: [
        {
          nodeId: node.id,
          nodeName: nodeData.label || nodeData.name || 'Unknown',
          nodeType: nodeData.type || 'unknown',
          status,
          issues,
          details: {
            basic: {
              cycleTime: nodeData.cycleTime,
              setupTime: nodeData.setupTime,
              equipmentCount: nodeData.equipmentCount,
              operatorCount: nodeData.operatorCount,
              inputBufferCapacity: nodeData.inputBufferCapacity,
              outputBufferCapacity: nodeData.outputBufferCapacity,
              defectRate: nodeData.defectRate,
              reworkRate: nodeData.reworkRate,
              operatingCost: nodeData.operatingCost,
            },
            connections: {
              incomingCount: incomingEdges.length,
              outgoingCount: outgoingEdges.length,
              incomingNodes: incomingEdges.map((e: any) => {
                const sourceNode = (network as any).nodes?.find((n: any) => n.id === e.source);
                return sourceNode?.data?.label || sourceNode?.data?.name || e.source;
              }),
              outgoingNodes: outgoingEdges.map((e: any) => {
                const targetNode = (network as any).nodes?.find((n: any) => n.id === e.target);
                return targetNode?.data?.label || targetNode?.data?.name || e.target;
              }),
            },
            materials: {
              inputs: nodeData.inputs || [],
              outputs: nodeData.outputs || [],
            },
            simulation: {
              theoreticalCapacity: nodeData.equipmentCount && nodeData.cycleTime ? 
                (3600 / nodeData.cycleTime) * nodeData.equipmentCount : 0,
              setupTimeRatio: nodeData.setupTime && nodeData.cycleTime ? 
                (nodeData.setupTime / (nodeData.setupTime + nodeData.cycleTime)) * 100 : 0,
              bufferUtilization: nodeData.inputBufferCapacity && nodeData.outputBufferCapacity ? 
                Math.min(nodeData.inputBufferCapacity, nodeData.outputBufferCapacity) : 0,
            },
            materialFlow, // 材料フロー情報を追加
          },
        },
      ],
      connections: [
        {
          edgeId: node.id, // ノードIDをエッジIDとして扱う
          fromNode: node.id,
          toNode: node.id, // ノードIDをエッジIDとして扱う
          transportTime: 0, // ノードの場合は0とする
          transportLotSize: null, // ノードの場合はnullとする
          routingRule: 'なし', // ノードの場合はなしとする
          isValid: true, // ノードの場合は常にtrueとする
          issues: [], // ノードの場合は空とする
        },
      ],
      overall: {
        isValid: status === 'valid',
        totalIssues: issues.length,
        recommendations: materialFlow.recommendations,
      },
    };
  };

  // 検証実行
  const runValidation = () => {
    setIsValidating(true);
    
    try {
      const results: ValidationResult[] = [];
      const connections: ConnectionValidation[] = [];
      
      // ノードの検証
      (network as any).nodes?.forEach((node: any) => {
        const result = validateNode(node);
        results.push(result);
      });
      
      // 接続の検証
      (network as any).edges?.forEach((edge: any) => {
        const connection = validateConnection(edge, (network as any).nodes || []);
        connections.push(connection);
      });
      
      setValidationResults(results);
      setConnectionValidations(connections);
      
      // 全体の状態を判定
      const hasErrors = results.some(r => r.overall.totalIssues > 0) || connections.some(c => c.issues.length > 0);
      const hasWarnings = results.some(r => r.overall.totalIssues > 0) || connections.some(c => c.issues.length > 0);
      
      if (hasErrors) {
        setOverallStatus('error');
      } else if (hasWarnings) {
        setOverallStatus('warning');
      } else {
        setOverallStatus('valid');
      }
      
      setValidationTimestamp(new Date().toLocaleString('ja-JP'));
      
    } catch (error) {
      console.error('検証エラー:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // 検証結果のエクスポート
  const exportValidationReport = () => {
    const report = {
      timestamp: validationTimestamp,
      overallStatus,
      summary: {
        totalNodes: validationResults.length,
        validNodes: validationResults.filter(r => r.overall.isValid).length,
        warningNodes: validationResults.filter(r => r.overall.totalIssues > 0).length,
        errorNodes: validationResults.filter(r => r.overall.totalIssues > 0).length,
        totalConnections: connectionValidations.length,
        validConnections: connectionValidations.filter(c => c.isValid).length,
        warningConnections: connectionValidations.filter(c => c.issues.length > 0).length,
        errorConnections: connectionValidations.filter(c => c.issues.length > 0).length,
      },
      nodeValidations: validationResults,
      connectionValidations: connectionValidations,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network_validation_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 状態アイコンの取得
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon />;
    }
  };

  // 状態カラーの取得
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'success.main';
      case 'warning':
        return 'warning.main';
      case 'error':
        return 'error.main';
      default:
        return 'info.main';
    }
  };

  useEffect(() => {
    if ((network as any).nodes?.length > 0) {
      runValidation();
    }
  }, [network]);

  // ネットワークデータがない場合の表示
  if (!(network as any).nodes || (network as any).nodes.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                🔍 ネットワーク検証パネル（暫定）
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ネットワークデータが読み込まれていません。
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                ネットワークエディタでネットワークを作成または読み込んでから、このパネルを使用してください。
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5" component="h2">
              🔍 ネットワーク検証パネル（暫定）
            </Typography>
            <Box>
              <Tooltip title="検証を再実行">
                <IconButton onClick={runValidation} disabled={isValidating}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="検証レポートをエクスポート">
                <IconButton onClick={exportValidationReport}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              このパネルは暫定的な機能です。シミュレーション設定の妥当性を確認するために使用してください。
              検証完了後は削除予定です。
            </Typography>
          </Alert>

          {/* 全体状況サマリー */}
          <Card sx={{ mb: 2, backgroundColor: 'background.default' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {getStatusIcon(overallStatus)}
                <Typography variant="h6">
                  全体状況: {overallStatus === 'valid' ? '正常' : overallStatus === 'warning' ? '警告' : 'エラー'}
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {validationResults.filter(r => r.overall.isValid).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      正常なノード
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {validationResults.filter(r => r.overall.totalIssues > 0).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      警告ノード
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {validationResults.filter(r => r.overall.totalIssues > 0).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      エラーノード
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                      {connectionValidations.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      総接続数
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              {validationTimestamp && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  最終検証時刻: {validationTimestamp}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* ノード検証結果 */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                📋 ノード検証結果 ({validationResults.length}件)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {validationResults.map((result, index) => (
                <Card key={result.nodes[0].nodeId} sx={{ mb: 2, borderLeft: `4px solid ${getStatusColor(result.overall.isValid ? 'valid' : result.overall.totalIssues > 0 ? 'warning' : 'error')}` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      {getStatusIcon(result.overall.isValid ? 'valid' : result.overall.totalIssues > 0 ? 'warning' : 'error')}
                      <Typography variant="h6">
                        {result.nodes[0].nodeName} ({result.nodes[0].nodeType})
                      </Typography>
                      <Chip 
                        label={result.overall.isValid ? '正常' : result.overall.totalIssues > 0 ? '警告' : 'エラー'}
                        color={result.overall.isValid ? 'success' : result.overall.totalIssues > 0 ? 'warning' : 'error'}
                        size="small"
                      />
                    </Box>
                    
                    {result.overall.totalIssues > 0 && (
                      <Alert severity={result.overall.totalIssues > 0 ? 'warning' : 'info'} sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          合計 {result.overall.totalIssues} 件の問題が見つかりました。
                        </Typography>
                        {result.overall.recommendations.length > 0 && (
                          <>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              推奨事項:
                            </Typography>
                            <ul>
                              {result.overall.recommendations.map((rec, i) => (
                                <li key={i}>• {rec}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </Alert>
                    )}
                    
                    <Grid container spacing={2}>
                      {/* 基本パラメータ */}
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          基本パラメータ
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell>サイクルタイム</TableCell>
                                <TableCell>{result.nodes[0].details.basic.cycleTime}秒</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>段取り時間</TableCell>
                                <TableCell>{result.nodes[0].details.basic.setupTime}秒</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>設備台数</TableCell>
                                <TableCell>{result.nodes[0].details.basic.equipmentCount}台</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>作業者数</TableCell>
                                <TableCell>{result.nodes[0].details.basic.operatorCount}人</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>入力バッファ容量</TableCell>
                                <TableCell>{result.nodes[0].details.basic.inputBufferCapacity}個</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>出力バッファ容量</TableCell>
                                <TableCell>{result.nodes[0].details.basic.outputBufferCapacity}個</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>不良率</TableCell>
                                <TableCell>{result.nodes[0].details.basic.defectRate}%</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>運転コスト</TableCell>
                                <TableCell>{result.nodes[0].details.basic.operatingCost}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      
                      {/* 接続情報 */}
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          接続情報
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell>入力接続数</TableCell>
                                <TableCell>{result.nodes[0].details.connections.incomingCount}件</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>出力接続数</TableCell>
                                <TableCell>{result.nodes[0].details.connections.outgoingCount}件</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>入力元</TableCell>
                                <TableCell>
                                  {result.nodes[0].details.connections.incomingNodes.length > 0 ? 
                                    result.nodes[0].details.connections.incomingNodes.join(', ') : 'なし'}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>出力先</TableCell>
                                <TableCell>
                                  {result.nodes[0].details.connections.outgoingNodes.length > 0 ? 
                                    result.nodes[0].details.connections.outgoingNodes.join(', ') : 'なし'}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                    
                    {/* シミュレーション指標 */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        シミュレーション指標
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="h6" color="primary.main">
                              {result.nodes[0].details.simulation.theoreticalCapacity.toFixed(1)}
                            </Typography>
                            <Typography variant="caption">理論生産能力 (個/時間)</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="h6" color="secondary.main">
                              {result.nodes[0].details.simulation.setupTimeRatio.toFixed(1)}%
                            </Typography>
                            <Typography variant="caption">段取り時間比率</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="h6" color="info.main">
                              {result.nodes[0].details.simulation.bufferUtilization}
                            </Typography>
                            <Typography variant="caption">バッファ利用率</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* 材料フロー分析 */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        材料フロー分析
                      </Typography>
                      
                      {/* フローバランス */}
                      <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          フローバランス
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="h6" color="primary.main">
                                {result.nodes[0].details.materialFlow.flowBalance.inputCapacity.toFixed(1)}
                              </Typography>
                              <Typography variant="caption">入力能力 (個/時間)</Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={4}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="h6" color="secondary.main">
                                {result.nodes[0].details.materialFlow.flowBalance.outputCapacity.toFixed(1)}
                              </Typography>
                              <Typography variant="caption">出力能力 (個/時間)</Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={4}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="h6" color={result.nodes[0].details.materialFlow.flowBalance.isBalanced ? 'success' : 'warning'}>
                                {result.nodes[0].details.materialFlow.flowBalance.balanceRatio.toFixed(2)}
                              </Typography>
                              <Typography variant="caption">バランス比率</Typography>
                            </Box>
                          </Grid>
                        </Grid>
                        
                        {!result.nodes[0].details.materialFlow.flowBalance.isBalanced && (
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            <Typography variant="body2">
                              フローバランスが取れていません。入力・出力能力の調整を検討してください。
                            </Typography>
                          </Alert>
                        )}
                      </Box>

                      {/* ボトルネックと推奨事項 */}
                      {result.nodes[0].details.materialFlow.bottlenecks.length > 0 && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            検出されたボトルネック
                          </Typography>
                          {result.nodes[0].details.materialFlow.bottlenecks.map((bottleneck: string, i: number) => (
                            <Typography variant="body2" key={i}>• {bottleneck}</Typography>
                          ))}
                        </Alert>
                      )}

                      {result.nodes[0].details.materialFlow.recommendations.length > 0 && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            推奨事項
                          </Typography>
                          {result.nodes[0].details.materialFlow.recommendations.map((recommendation: string, i: number) => (
                            <Typography variant="body2" key={i}>• {recommendation}</Typography>
                          ))}
                        </Alert>
                      )}

                      {/* 詳細な材料フロー情報 */}
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            入力材料フロー
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>ソース工程</TableCell>
                                  <TableCell>能力</TableCell>
                                  <TableCell>搬送時間</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {result.nodes[0].details.materialFlow.inputMaterials.map((material: any, i: number) => (
                                  <TableRow key={i}>
                                    <TableCell>{material.sourceNode}</TableCell>
                                    <TableCell>{material.sourceCapacity.toFixed(1)} 個/時間</TableCell>
                                    <TableCell>{material.transportTime} 秒</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            出力製品フロー
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>ターゲット工程</TableCell>
                                  <TableCell>能力</TableCell>
                                  <TableCell>搬送時間</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {result.nodes[0].details.materialFlow.outputProducts.map((product: any, i: number) => (
                                  <TableRow key={i}>
                                    <TableCell>{product.targetNode}</TableCell>
                                    <TableCell>{product.targetCapacity.toFixed(1)} 個/時間</TableCell>
                                    <TableCell>{product.transportTime} 秒</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      </Grid>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </AccordionDetails>
          </Accordion>

          {/* コネクタ情報セクション */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TimelineIcon color="info" />
                <Typography variant="h6">コネクタ情報</Typography>
                <Chip 
                  label={`${connectionValidations.length}件`}
                  color="info"
                  size="small"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {/* コネクタ概要 */}
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>接続状況</Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                        <Box>
                          <Typography variant="h4" color="success.main">
                            {connectionValidations.filter(c => c.isValid).length}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            正常
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="h4" color="warning.main">
                            {connectionValidations.filter(c => c.issues.length > 0).length}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            警告
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 搬送統計 */}
                <Grid item xs={12} md={8}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>搬送統計</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" color="primary.main">
                              {connectionValidations.reduce((sum, c) => sum + c.transportTime, 0).toFixed(1)}
                            </Typography>
                            <Typography variant="caption">総搬送時間 (秒)</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" color="secondary.main">
                              {(connectionValidations.reduce((sum, c) => sum + c.transportTime, 0) / 60).toFixed(1)}
                            </Typography>
                            <Typography variant="caption">総搬送時間 (分)</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* コネクタ詳細一覧 */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>コネクタ詳細</Typography>
                {connectionValidations.map((connection, index) => (
                  <Card key={connection.edgeId} sx={{ mb: 2, borderLeft: `4px solid ${getStatusColor(connection.isValid ? 'valid' : connection.issues.length > 0 ? 'warning' : 'error')}` }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        {getStatusIcon(connection.isValid ? 'valid' : connection.issues.length > 0 ? 'warning' : 'error')}
                        <Typography variant="h6">
                          {connection.fromNode} → {connection.toNode}
                        </Typography>
                        <Chip 
                          label={connection.isValid ? '正常' : connection.issues.length > 0 ? '警告' : 'エラー'}
                          color={connection.isValid ? 'success' : connection.issues.length > 0 ? 'warning' : 'error'}
                          size="small"
                        />
                      </Box>
                      
                      {connection.issues.length > 0 && (
                        <Alert severity={connection.issues.length > 0 ? 'warning' : 'info'} sx={{ mb: 2 }}>
                          <Typography variant="body2">
                            合計 {connection.issues.length} 件の問題が見つかりました。
                          </Typography>
                          {connection.issues.map((issue, i) => (
                            <Typography variant="body2" key={i}>• {issue}</Typography>
                          ))}
                        </Alert>
                      )}

                      {/* コネクタ詳細テーブル */}
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>搬送時間</TableCell>
                              <TableCell>{connection.transportTime}</TableCell>
                              <TableCell>秒</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>搬送ロットサイズ</TableCell>
                              <TableCell>{connection.transportLotSize || 'なし'}</TableCell>
                              <TableCell>個</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>搬送ルール</TableCell>
                              <TableCell>{connection.routingRule}</TableCell>
                              <TableCell>-</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* 検証レポート */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                📊 検証レポート
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  この検証パネルは以下の項目をチェックしています：
                </Typography>
                <ul>
                  <li>基本パラメータの妥当性（サイクルタイム、段取り時間、設備台数など）</li>
                  <li>バッファ容量の設定</li>
                  <li>品質パラメータの範囲</li>
                  <li>接続の妥当性</li>
                  <li>搬送設定の完全性</li>
                  <li>シミュレーション指標の計算</li>
                </ul>
              </Box>
              
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportValidationReport}
                fullWidth
              >
                検証レポートをエクスポート
              </Button>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NetworkValidationPanel;
