import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  AlertTitle,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

import { MaterialBalanceValidator, MaterialBalanceResult, MaterialBalanceIssue } from '../../utils/materialBalanceValidator';
import { Product, BOMItem } from '../../types/productionTypes';

interface MaterialBalancePanelProps {
  nodes: any[];
  processAdvancedData: Map<string, any>;
  products: Product[];
  bomItems?: BOMItem[];
  components?: any[];
}

const MaterialBalancePanel: React.FC<MaterialBalancePanelProps> = ({
  nodes,
  processAdvancedData,
  products,
  bomItems = [],
  components = []
}) => {
  const [validationResult, setValidationResult] = useState<MaterialBalanceResult | null>(null);
  const [loading, setLoading] = useState(false);

  // 材料バランスの検証を実行
  const validateMaterialBalance = useMemo(() => {
    return () => {
      if (!products || products.length === 0) {
        console.log('🔍 No products available for validation');
        return;
      }

      setLoading(true);
      console.log('🔍 Starting material balance validation...');
      
      try {
        const validator = new MaterialBalanceValidator(products, bomItems, components);
        const result = validator.validateNetwork(nodes, processAdvancedData);
        setValidationResult(result);
        console.log('🔍 Validation result:', result);
      } catch (error) {
        console.error('🔍 Validation error:', error);
      } finally {
        setLoading(false);
      }
    };
  }, [nodes, processAdvancedData, products, bomItems, components]);

  // 自動検証（データが変更されたとき）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateMaterialBalance();
    }, 1000); // 1秒のデバウンス

    return () => clearTimeout(timeoutId);
  }, [validateMaterialBalance]);

  // 問題の重要度に基づくアイコンとカラー
  const getIssueIcon = (issue: MaterialBalanceIssue) => {
    switch (issue.issueType) {
      case 'shortage':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'excess':
        return <InfoIcon color="info" fontSize="small" />;
      case 'missing_bom':
        // BOM必須の製品タイプかどうかで重要度を変更
        if (issue.materialName?.includes('には必須')) {
          return <ErrorIcon color="error" fontSize="small" />;
        } else {
          return <WarningIcon color="warning" fontSize="small" />;
        }
      default:
        return <InfoIcon fontSize="small" />;
    }
  };

  const getIssueColor = (issue: MaterialBalanceIssue) => {
    switch (issue.issueType) {
      case 'shortage':
        return 'error';
      case 'excess':
        return 'info';
      case 'missing_bom':
        // BOM必須の製品タイプかどうかで重要度を変更
        if (issue.materialName?.includes('には必須')) {
          return 'error';
        } else {
          return 'warning';
        }
      default:
        return 'default';
    }
  };

  const getIssueSeverityText = (issue: MaterialBalanceIssue) => {
    switch (issue.issueType) {
      case 'shortage':
        return '材料不足';
      case 'excess':
        return '材料過多';
      case 'missing_bom':
        if (issue.materialName?.includes('には必須')) {
          return 'BOM必須';
        } else if (issue.materialName?.includes('確認が必要')) {
          return 'BOM要確認';
        } else {
          return 'BOM未設定';
        }
      default:
        return '不明';
    }
  };

  // ノード別にグループ化された問題
  const issuesByNode = useMemo(() => {
    if (!validationResult) return {};
    
    const grouped: Record<string, MaterialBalanceIssue[]> = {};
    for (const issue of validationResult.issues) {
      if (!grouped[issue.nodeId]) {
        grouped[issue.nodeId] = [];
      }
      grouped[issue.nodeId].push(issue);
    }
    return grouped;
  }, [validationResult]);

  if (!validationResult) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <WarningIcon color="action" />
          <Typography variant="h6">材料バランス検証</Typography>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={validateMaterialBalance}
            disabled={loading}
          >
            検証実行
          </Button>
        </Box>
        <Typography color="text.secondary">
          {loading ? '検証中...' : 'BOMと材料設定の整合性を検証します。'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {validationResult.isValid ? (
          <CheckCircleIcon color="success" />
        ) : (
          <WarningIcon color="warning" />
        )}
        <Typography variant="h6">材料バランス検証</Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={validateMaterialBalance}
          disabled={loading}
        >
          再検証
        </Button>
      </Box>

      {/* 検証サマリー */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          検証対象: {validationResult.summary.totalNodes}工程 / 
          問題のある工程: {validationResult.summary.nodesWithIssues}個 / 
          総問題数: {validationResult.summary.totalIssues}件
        </Typography>
      </Box>

      {validationResult.isValid ? (
        <Alert severity="success">
          <AlertTitle>材料バランスOK</AlertTitle>
          すべての工程で材料設定がBOMと一致しています。
        </Alert>
      ) : (
        <>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>材料バランスに問題があります</AlertTitle>
            {validationResult.summary.nodesWithIssues}個の工程で材料設定に不整合が検出されました。
          </Alert>

          {/* ノード別の問題表示 */}
          {Object.entries(issuesByNode).map(([nodeId, issues]) => {
            const nodeName = issues[0]?.nodeName || nodeId;
            const shortageIssues = issues.filter(i => i.issueType === 'shortage');
            const excessIssues = issues.filter(i => i.issueType === 'excess');
            const bomIssues = issues.filter(i => i.issueType === 'missing_bom');

            return (
              <Accordion key={nodeId} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <WarningIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                      {nodeName} ({nodeId})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {shortageIssues.length > 0 && (
                        <Chip 
                          label={`不足: ${shortageIssues.length}`} 
                          size="small" 
                          color="error" 
                        />
                      )}
                      {excessIssues.length > 0 && (
                        <Chip 
                          label={`過多: ${excessIssues.length}`} 
                          size="small" 
                          color="info" 
                        />
                      )}
                      {bomIssues.length > 0 && (
                        <Chip 
                          label={`BOM未設定: ${bomIssues.length}`} 
                          size="small" 
                          color="warning" 
                        />
                      )}
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>製品</TableCell>
                          <TableCell>材料</TableCell>
                          <TableCell>問題</TableCell>
                          <TableCell align="right">必要数</TableCell>
                          <TableCell align="right">実際数</TableCell>
                          <TableCell align="right">差異</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {issues.map((issue, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {issue.productName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {issue.materialName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {getIssueIcon(issue)}
                                <Typography 
                                  variant="body2" 
                                  color={getIssueColor(issue)}
                                >
                                  {getIssueSeverityText(issue)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {issue.issueType !== 'missing_bom' ? issue.requiredQuantity : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {issue.issueType !== 'missing_bom' ? issue.actualQuantity : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography 
                                variant="body2" 
                                color={issue.issueType === 'shortage' ? 'error' : 'info'}
                                sx={{ fontWeight: 'medium' }}
                              >
                                {issue.issueType === 'shortage' ? `-${issue.shortageQuantity}` :
                                 issue.issueType === 'excess' ? `+${issue.shortageQuantity}` : '-'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </>
      )}
    </Paper>
  );
};

export default MaterialBalancePanel;