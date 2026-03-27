import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Alert,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon,
} from '@mui/icons-material';
import { validateNetwork, ValidationResult, ValidationError, ValidationWarning } from '../../utils/networkValidator';

interface NetworkValidationPanelProps {
  nodes: any[];
  edges: any[];
  onHighlightNodes?: (nodeIds: string[]) => void;
  onHighlightEdges?: (edgeIds: string[]) => void;
}

const NetworkValidationPanel: React.FC<NetworkValidationPanelProps> = ({
  nodes,
  edges,
  onHighlightNodes,
  onHighlightEdges,
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>(['errors']);

  // 自動検証（デバウンス付き — ちらつき防止）
  useEffect(() => {
    if (nodes.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const result = validateNetwork(nodes, edges);
        setValidationResult(result);
      } catch (error) {
        console.error('Network validation error:', error);
      }
    }, 1000); // 1秒デバウンス
    return () => clearTimeout(timer);
  }, [nodes.length, edges.length]); // 配列の長さ変更時のみ再検証

  const validateNetworkStructure = () => {
    try {
      const result = validateNetwork(nodes, edges);
      setValidationResult(result);
    } catch (error) {
      console.error('Network validation error:', error);
    }
  };

  const handleAccordionChange = (section: string) => (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedSections(prev =>
      isExpanded 
        ? [...prev, section]
        : prev.filter(s => s !== section)
    );
  };

  const handleItemClick = (nodeIds?: string[], edgeIds?: string[]) => {
    if (nodeIds && onHighlightNodes) {
      onHighlightNodes(nodeIds);
    }
    if (edgeIds && onHighlightEdges) {
      onHighlightEdges(edgeIds);
    }
  };

  const getErrorIcon = (error: ValidationError) => {
    switch (error.severity) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getErrorColor = (error: ValidationError) => {
    switch (error.severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'warning';
    }
  };

  const getSeverityCount = (errors: ValidationError[], severity: 'error' | 'warning') => {
    return errors.filter(error => error.severity === severity).length;
  };

  if (!validationResult && !isValidating) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          ネットワーク検証
        </Typography>
        <Typography variant="body2" color="textSecondary">
          工程を配置すると自動的に検証が開始されます
        </Typography>
      </Paper>
    );
  }

  if (isValidating) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          ネットワーク検証中...
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <RefreshIcon sx={{ animation: 'rotate 1s linear infinite', mr: 1 }} />
          <Typography variant="body2">
            ネットワーク構造を分析しています
          </Typography>
        </Box>
      </Paper>
    );
  }

  if (!validationResult) {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom color="primary">
          ネットワーク検証
        </Typography>
        <Typography variant="body2" color="textSecondary">
          検証結果を読み込み中...
        </Typography>
      </Paper>
    );
  }

  const errorCount = getSeverityCount(validationResult.errors, 'error');
  const warningCount = getSeverityCount(validationResult.errors, 'warning');

  return (
    <Paper sx={{ p: 2, maxHeight: '80vh', overflow: 'auto' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          ネットワーク検証
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="再検証">
            <IconButton onClick={validateNetworkStructure} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={showWarnings ? "警告を非表示" : "警告を表示"}>
            <IconButton onClick={() => setShowWarnings(!showWarnings)} size="small">
              {showWarnings ? <HideIcon /> : <ShowIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 検証結果のサマリー */}
      <Box sx={{ mb: 2 }}>
        {validationResult.isValid ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            <Typography variant="body2">
              ネットワーク構造に問題はありません
            </Typography>
          </Alert>
        ) : (
          <Alert severity="error">
            <Typography variant="body2">
              {errorCount > 0 && `${errorCount}個のエラー`}
              {errorCount > 0 && warningCount > 0 && '、'}
              {warningCount > 0 && `${warningCount}個の警告`}
              が検出されました
            </Typography>
          </Alert>
        )}
      </Box>

      {/* エラー一覧 */}
      {validationResult.errors.length > 0 && (
        <Accordion
          expanded={expandedSections.includes('errors')}
          onChange={handleAccordionChange('errors')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              <Typography variant="subtitle1">
                エラー・警告 ({validationResult.errors.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                {errorCount > 0 && (
                  <Chip label={`エラー ${errorCount}`} color="error" size="small" />
                )}
                {warningCount > 0 && (
                  <Chip label={`警告 ${warningCount}`} color="warning" size="small" />
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {validationResult.errors
                .filter(error => showWarnings || error.severity === 'error')
                .map((error, index) => (
                <ListItem
                  key={index}
                  button
                  onClick={() => handleItemClick(error.nodeIds, error.edgeIds)}
                  sx={{
                    border: 1,
                    borderColor: getErrorColor(error) === 'error' ? 'error.light' : 'warning.light',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: getErrorColor(error) === 'error' ? 'error.lighter' : 'warning.lighter',
                  }}
                >
                  <ListItemIcon>
                    {getErrorIcon(error)}
                  </ListItemIcon>
                  <ListItemText
                    primary={error.message}
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Chip 
                          label={error.type} 
                          size="small" 
                          variant="outlined"
                          color={getErrorColor(error)}
                        />
                        {error.nodeIds && error.nodeIds.length > 0 && (
                          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                            関連工程: {error.nodeIds.length}個
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 警告・最適化提案 */}
      {validationResult.warnings.length > 0 && showWarnings && (
        <Accordion
          expanded={expandedSections.includes('warnings')}
          onChange={handleAccordionChange('warnings')}
          sx={{ mt: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="info" />
              <Typography variant="subtitle1">
                最適化提案 ({validationResult.warnings.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {validationResult.warnings.map((warning, index) => (
                <ListItem
                  key={index}
                  button
                  onClick={() => handleItemClick(warning.nodeIds)}
                  sx={{
                    border: 1,
                    borderColor: 'info.light',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'info.lighter',
                  }}
                >
                  <ListItemIcon>
                    <WarningIcon color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary={warning.message}
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Chip 
                          label={warning.type} 
                          size="small" 
                          variant="outlined"
                          color="info"
                        />
                        {warning.suggestions && warning.suggestions.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                              提案:
                            </Typography>
                            {warning.suggestions.map((suggestion, idx) => (
                              <Typography key={idx} variant="caption" sx={{ display: 'block', ml: 1 }}>
                                • {suggestion}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 統計情報 */}
      <Accordion
        expanded={expandedSections.includes('stats')}
        onChange={handleAccordionChange('stats')}
        sx={{ mt: 1 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="subtitle1">
              ネットワーク統計
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip label={`工程数: ${nodes.length}`} variant="outlined" />
            <Chip label={`接続数: ${edges.length}`} variant="outlined" />
            <Chip 
              label={`開始工程: ${nodes.filter(n => !edges.some(e => e.target === n.id)).length}`} 
              variant="outlined" 
            />
            <Chip 
              label={`終了工程: ${nodes.filter(n => !edges.some(e => e.source === n.id)).length}`} 
              variant="outlined" 
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* アクションボタン */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={validateNetworkStructure}
          startIcon={<RefreshIcon />}
        >
          再検証
        </Button>
        {!validationResult.isValid && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => {
              // 自動修正機能（将来実装）
              console.log('Auto-fix functionality to be implemented');
            }}
          >
            自動修正
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default NetworkValidationPanel;