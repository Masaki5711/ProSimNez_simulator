import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Description as FileIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { simulationApi, Phase2TestReport } from '../../api/simulationApi';

const Phase2TestReports: React.FC = () => {
  const [reports, setReports] = useState<Phase2TestReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Phase2TestReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // レポート一覧を取得
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await simulationApi.getPhase2Reports();
      setReports(response.reports);
    } catch (error: any) {
      setError('レポート一覧の取得に失敗しました: ' + (error.message || 'Unknown error'));
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初期読み込み
  useEffect(() => {
    fetchReports();
  }, []);

  // ファイルサイズをフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 日時をフォーマット
  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  // レポートダウンロード
  const handleDownload = async (report: Phase2TestReport) => {
    try {
      await simulationApi.downloadPhase2Report(report.filename);
    } catch (error: any) {
      setError('ダウンロードに失敗しました: ' + (error.message || 'Unknown error'));
      console.error('Failed to download report:', error);
    }
  };

  // レポート削除確認ダイアログを開く
  const handleDeleteClick = (report: Phase2TestReport) => {
    setSelectedReport(report);
    setDeleteDialogOpen(true);
  };

  // HTMLレポート表示
  const handleViewHtmlReport = (filename: string) => {
    const htmlFilename = filename.replace('.md', '.html');
    const reportUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/simulation/reports/download/${htmlFilename}`;
    window.open(reportUrl, '_blank');
  };

  // レポート削除実行
  const handleDeleteConfirm = async () => {
    if (!selectedReport) return;

    try {
      await simulationApi.deletePhase2Report(selectedReport.filename);
      await fetchReports(); // 一覧を再読み込み
      setDeleteDialogOpen(false);
      setSelectedReport(null);
    } catch (error: any) {
      setError('削除に失敗しました: ' + (error.message || 'Unknown error'));
      console.error('Failed to delete report:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileIcon />
          フェーズ２テストレポート
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchReports}
          disabled={loading}
        >
          更新
        </Button>
      </Box>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ローディング状態 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {/* レポート情報 */}
      <Paper elevation={1} sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <InfoIcon color="info" />
          <Typography variant="subtitle1" fontWeight="bold">
            フェーズ２テストについて
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          フェーズ２テストは、シミュレーション実行時のすべてのイベントとシステム状態を詳細に記録し、
          実行結果をMarkdownファイルとHTMLファイルとして自動生成します。レポートには以下の情報が含まれます：
        </Typography>
        <Box sx={{ mt: 1, ml: 2 }}>
          <Typography variant="body2" color="text.secondary">
            • テスト概要とパフォーマンスメトリクス
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 時系列イベントログ（工程開始/完了、在庫変化など）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • システム状態履歴（工程・バッファ状態）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 生産効率とKPI分析結果
          </Typography>
        </Box>
      </Paper>

      {/* レポート一覧 */}
      <Paper elevation={2}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            生成されたレポート ({reports.length})
          </Typography>
        </Box>

        {reports.length === 0 && !loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              まだレポートがありません。
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              シミュレーションを実行してテストレポートを生成してください。
            </Typography>
          </Box>
        ) : (
          <List>
            {reports.map((report, index) => (
              <React.Fragment key={report.filename}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileIcon color="primary" />
                        <Typography variant="subtitle1">
                          {report.filename}
                        </Typography>
                        <Chip 
                          label={formatFileSize(report.size)} 
                          size="small" 
                          variant="outlined" 
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          作成日時: {formatDateTime(report.created_at)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          更新日時: {formatDateTime(report.modified_at)}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Markdownダウンロード">
                      <IconButton
                        edge="end"
                        onClick={() => handleDownload(report)}
                        color="primary"
                        sx={{ mr: 1 }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="HTMLレポート表示">
                      <IconButton
                        edge="end"
                        onClick={() => handleViewHtmlReport(report.filename)}
                        color="secondary"
                        sx={{ mr: 1 }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteClick(report)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < reports.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>レポート削除の確認</DialogTitle>
        <DialogContent>
          <Typography>
            以下のレポートを削除しますか？
          </Typography>
          <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 'bold' }}>
            {selectedReport?.filename}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Phase2TestReports;
