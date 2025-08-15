import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Container,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Refresh,
  CheckCircle,
  Error,
  Schedule,
  Factory,
  Inventory,
  Security,
  CalendarToday,
  BarChart,
  LocalShipping,
  ExpandMore,
  Science,
} from '@mui/icons-material';

interface TestResult {
  test_type: string;
  status: string;
  results: any;
  events: Array<{
    event: string;
    timestamp: string;
    [key: string]: any;
  }>;
  timestamp: string;
}

interface SystemStatus {
  status: string;
  factory?: {
    id: string;
    name: string;
    products: number;
    processes: number;
    buffers: number;
  };
  systems?: string[];
  timestamp: string;
}

const Phase2TestPage: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState<string>('all');

  const testTypes = [
    { value: 'all', label: 'すべてのシステム', icon: <Factory />, color: 'primary' as const },
    { value: 'material', label: '材料フロー管理', icon: <Inventory />, color: 'info' as const },
    { value: 'quality', label: '品質管理', icon: <Security />, color: 'success' as const },
    { value: 'scheduling', label: 'スケジューリング', icon: <CalendarToday />, color: 'warning' as const },
  ];

  const runTest = async (testType: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_type: testType,
          duration_minutes: 5,
        }),
      });

      if (!response.ok) {
        throw new window.Error(`テスト実行エラー: ${response.statusText}`);
      }

      const result = await response.json();
      setTestResults(result);
    } catch (error: any) {
      console.error('テスト実行エラー:', error);
      alert(`テスト実行に失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runQuickDemo = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/demo/quick-test', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new window.Error(`デモ実行エラー: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`クイックデモ完了: ${result.message}`);
      
      setTestResults({
        test_type: 'demo',
        status: result.status,
        results: result.results,
        events: [
          {
            event: 'demo_completed',
            timestamp: result.timestamp,
            details: result.results
          }
        ],
        timestamp: result.timestamp
      });
    } catch (error: any) {
      console.error('デモ実行エラー:', error);
      alert(`デモ実行に失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/test/status');
      const status = await response.json();
      setSystemStatus(status);
    } catch (error) {
      console.error('システム状況取得エラー:', error);
    }
  };

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <CheckCircle sx={{ color: 'green' }} />;
      case 'error':
        return <Error sx={{ color: 'red' }} />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <Schedule sx={{ color: 'orange' }} />;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            <Science sx={{ mr: 1, verticalAlign: 'bottom' }} />
            フェーズ2シミュレーション機能テスト
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            材料フロー、品質管理、スケジューリング機能をテストします
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={checkSystemStatus}
        >
          状況更新
        </Button>
      </Box>

      <Stack spacing={3}>
        {/* システム状況 */}
        <Card>
          <CardHeader 
            avatar={<BarChart />}
            title="システム状況"
          />
          <CardContent>
            {systemStatus ? (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(systemStatus.status)}
                    <Typography variant="h6">{systemStatus.status}</Typography>
                  </Box>
                </Grid>
                {systemStatus.factory && (
                  <>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="body2" color="text.secondary">製品数</Typography>
                      <Typography variant="h6">{systemStatus.factory.products}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="body2" color="text.secondary">工程数</Typography>
                      <Typography variant="h6">{systemStatus.factory.processes}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="body2" color="text.secondary">バッファ数</Typography>
                      <Typography variant="h6">{systemStatus.factory.buffers}</Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            ) : (
              <Typography color="text.secondary">システム状況を読み込み中...</Typography>
            )}
          </CardContent>
        </Card>

        {/* テスト実行セクション */}
        <Card>
          <CardHeader
            title="テスト実行"
            subheader="テストしたいシステムを選択して実行してください"
          />
          <CardContent>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {testTypes.map((type) => (
                <Grid item xs={12} sm={6} md={3} key={type.value}>
                  <Button
                    variant={selectedTestType === type.value ? "contained" : "outlined"}
                    color={type.color}
                    fullWidth
                    size="large"
                    startIcon={type.icon}
                    onClick={() => setSelectedTestType(type.value)}
                    sx={{ height: 80, flexDirection: 'column', gap: 1 }}
                  >
                    <Typography variant="caption">{type.label}</Typography>
                  </Button>
                </Grid>
              ))}
            </Grid>
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                onClick={() => runTest(selectedTestType)}
                disabled={loading}
                sx={{ flex: 1 }}
              >
                テスト実行
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                startIcon={<LocalShipping />}
                onClick={runQuickDemo}
                disabled={loading}
              >
                クイックデモ
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* テスト結果 */}
        {testResults && (
          <Card>
            <CardHeader
              avatar={getStatusIcon(testResults.status)}
              title={`テスト結果 - ${testResults.test_type}`}
              subheader={`実行時刻: ${new Date(testResults.timestamp).toLocaleString()}`}
            />
            <CardContent>
              {/* 概要 */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {testResults.results?.summary?.total_events || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      総イベント数
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {testResults.results?.summary?.test_duration_minutes || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      テスト時間（分）
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Chip 
                      label={testResults.results?.summary?.systems_tested || '不明'}
                      color="secondary"
                      size="medium"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      テスト対象
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* 詳細結果 */}
              {testResults.results && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">詳細結果</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ 
                      backgroundColor: '#f5f5f5', 
                      p: 2, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}>
                      <pre>{JSON.stringify(testResults.results, null, 2)}</pre>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* イベントログ */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">イベントログ</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {testResults.events?.length > 0 ? (
                    <List>
                      {testResults.events.map((event, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            {event.event.includes('error') ? <Error color="error" /> : <CheckCircle color="success" />}
                          </ListItemIcon>
                          <ListItemText
                            primary={event.event}
                            secondary={`${new Date(event.timestamp).toLocaleTimeString()} ${
                              event.error ? `- エラー: ${event.error}` : ''
                            }`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">イベントがありません</Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* テスト進行状況 */}
        {loading && (
          <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 2 }} />
            テスト実行中です。しばらくお待ちください...
          </Alert>
        )}

        {/* 使用方法ガイド */}
        <Card>
          <CardHeader title="📋 テスト機能説明" />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Inventory sx={{ mr: 1 }} /> 材料フロー管理テスト
                </Typography>
                <List dense>
                  <ListItem><ListItemText primary="• 材料要求の作成と処理" /></ListItem>
                  <ListItem><ListItemText primary="• 在庫管理とアラート" /></ListItem>
                  <ListItem><ListItemText primary="• かんばんシステム" /></ListItem>
                  <ListItem><ListItemText primary="• MRP計算" /></ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Security sx={{ mr: 1 }} /> 品質管理テスト
                </Typography>
                <List dense>
                  <ListItem><ListItemText primary="• 品質検査の実行" /></ListItem>
                  <ListItem><ListItemText primary="• 統計的品質管理" /></ListItem>
                  <ListItem><ListItemText primary="• 工程能力分析" /></ListItem>
                  <ListItem><ListItemText primary="• 不良率計算" /></ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarToday sx={{ mr: 1 }} /> スケジューリングテスト
                </Typography>
                <List dense>
                  <ListItem><ListItemText primary="• 生産オーダー作成" /></ListItem>
                  <ListItem><ListItemText primary="• スケジュール最適化" /></ListItem>
                  <ListItem><ListItemText primary="• ボトルネック分析" /></ListItem>
                  <ListItem><ListItemText primary="• 納期管理" /></ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocalShipping sx={{ mr: 1 }} /> クイックデモ
                </Typography>
                <List dense>
                  <ListItem><ListItemText primary="• 全システムの基本動作確認" /></ListItem>
                  <ListItem><ListItemText primary="• 簡単なデータ生成" /></ListItem>
                  <ListItem><ListItemText primary="• 結果の即座確認" /></ListItem>
                  <ListItem><ListItemText primary="• 動作確認用" /></ListItem>
                </List>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default Phase2TestPage;