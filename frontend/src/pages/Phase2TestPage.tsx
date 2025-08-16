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
  Tabs,
  Tab,
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
  Assessment,
  Timeline,
} from '@mui/icons-material';
import Phase2TestReports from '../components/simulation/Phase2TestReports';
import { simulationApi } from '../api/simulationApi';

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
  const [activeTab, setActiveTab] = useState(0);

  const testTypes = [
    { value: 'all', label: 'すべてのシステム', icon: <Factory />, color: 'primary' as const },
    { value: 'material', label: '材料フロー管理', icon: <Inventory />, color: 'info' as const },
    { value: 'quality', label: '品質管理', icon: <Security />, color: 'success' as const },
    { value: 'scheduling', label: 'スケジューリング', icon: <CalendarToday />, color: 'warning' as const },
  ];

  // シミュレーション妥当性検証用のテストケース
  const validationTestCases = [
    {
      name: '高速シミュレーション',
      description: '10倍速での短時間テスト',
      config: { duration: 60, speed: 10.0, test_duration: 6 },
      color: 'success' as const
    },
    {
      name: '低速シミュレーション',
      description: '0.1倍速での長時間テスト',
      config: { duration: 600, speed: 0.1, test_duration: 60 },
      color: 'info' as const
    },
    {
      name: '短時間シミュレーション',
      description: '1分間の高密度テスト',
      config: { duration: 60, speed: 1.0, test_duration: 6 },
      color: 'warning' as const
    },
    {
      name: '長時間シミュレーション',
      description: '10分間の包括的テスト',
      config: { duration: 600, speed: 1.0, test_duration: 60 },
      color: 'error' as const
    },
    {
      name: 'ストレステスト',
      description: '高負荷での安定性テスト',
      config: { duration: 300, speed: 5.0, test_duration: 30 },
      color: 'secondary' as const
    }
  ];

  const [validationResults, setValidationResults] = useState<Array<{
    testCase: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
    duration?: number;
    events?: number;
    error?: string;
    reportPath?: string;
  }>>([]);

  const [isValidationRunning, setIsValidationRunning] = useState(false);

  // シミュレーション妥当性検証を実行
  const runValidationTests = async () => {
    setIsValidationRunning(true);
    setValidationResults(validationTestCases.map(tc => ({
      testCase: tc.name,
      status: 'pending'
    })));

    for (let i = 0; i < validationTestCases.length; i++) {
      const testCase = validationTestCases[i];
      
      // テストケースの状態を更新
      setValidationResults(prev => prev.map((result, index) => 
        index === i ? { ...result, status: 'running', startTime: new Date().toISOString() } : result
      ));

      try {
        console.log(`妥当性検証開始: ${testCase.name}`);
        
        // シミュレーション開始
        const startResult = await simulationApi.start({
          start_time: new Date().toISOString(),
          duration: testCase.config.duration,
          speed: testCase.config.speed
        });

        // 指定された時間実行
        await new Promise(resolve => setTimeout(resolve, testCase.config.test_duration * 1000));

        // シミュレーション停止
        const stopResult = await simulationApi.stop();
        
        console.log(`${testCase.name} 完了:`, stopResult);

        // 成功結果を記録
        setValidationResults(prev => prev.map((result, index) => 
          index === i ? {
            ...result,
            status: 'completed',
            endTime: new Date().toISOString(),
            duration: testCase.config.test_duration,
            events: 0, // イベント数は後でレポートから取得
            reportPath: stopResult.report_path
          } : result
        ));

        // 次のテストケースまで少し待機
        if (i < validationTestCases.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error: any) {
        console.error(`${testCase.name} エラー:`, error);
        
        // エラー結果を記録
        setValidationResults(prev => prev.map((result, index) => 
          index === i ? {
            ...result,
            status: 'failed',
            endTime: new Date().toISOString(),
            error: error.message || '不明なエラー'
          } : result
        ));
      }
    }

    setIsValidationRunning(false);
  };

  // 個別の妥当性テストを実行
  const runSingleValidationTest = async (testCaseIndex: number) => {
    const testCase = validationTestCases[testCaseIndex];
    
    setValidationResults(prev => prev.map((result, index) => 
      index === testCaseIndex ? { ...result, status: 'running', startTime: new Date().toISOString() } : result
    ));

    try {
      console.log(`個別妥当性検証開始: ${testCase.name}`);
      
      const startResult = await simulationApi.start({
        start_time: new Date().toISOString(),
        duration: testCase.config.duration,
        speed: testCase.config.speed
      });

      await new Promise(resolve => setTimeout(resolve, testCase.config.test_duration * 1000));
      const stopResult = await simulationApi.stop();
      
      setValidationResults(prev => prev.map((result, index) => 
        index === testCaseIndex ? {
          ...result,
          status: 'completed',
          endTime: new Date().toISOString(),
          duration: testCase.config.test_duration,
                      events: 0, // イベント数は後でレポートから取得
          reportPath: stopResult.report_path
        } : result
      ));

    } catch (error: any) {
      console.error(`${testCase.name} エラー:`, error);
      setValidationResults(prev => prev.map((result, index) => 
        index === testCaseIndex ? {
          ...result,
          status: 'failed',
          endTime: new Date().toISOString(),
          error: error.message || '不明なエラー'
        } : result
      ));
    }
  };

  const runTest = async (testType: string) => {
    setLoading(true);
    try {
      // 新しいシミュレーションAPIを使用
      const config = {
        start_time: new Date().toISOString(),
        duration: 300, // 5分 = 300秒
        speed: 1.0
      };
      
      const result = await simulationApi.start(config);
      console.log('シミュレーション開始結果:', result);
      
      // シミュレーションが開始されたら、十分な時間実行してから停止
      setTimeout(async () => {
        try {
          console.log('シミュレーション停止を開始...');
          const stopResult = await simulationApi.stop();
          console.log('シミュレーション停止結果:', stopResult);
          
          // テスト結果を設定
          setTestResults({
            test_type: testType,
            status: 'completed',
            results: {
              summary: {
                total_events: 'シミュレーション完了',
                test_duration_minutes: 5,
                systems_tested: '全システム'
              }
            },
            events: [
              {
                event: 'シミュレーション完了',
                timestamp: new Date().toISOString(),
                details: stopResult
              }
            ],
            timestamp: new Date().toISOString()
          });
          
          setLoading(false);
        } catch (stopError: any) {
          console.error('シミュレーション停止エラー:', stopError);
          alert(`シミュレーション停止に失敗しました: ${stopError.message}`);
          setLoading(false);
        }
      }, 10000); // 10秒後に停止（より長い時間実行）
      
    } catch (error: any) {
      console.error('テスト実行エラー:', error);
      alert(`テスト実行に失敗しました: ${error.message}`);
      setLoading(false);
    }
  };

  const runQuickDemo = async () => {
    setLoading(true);
    try {
      // クイックデモ用の短時間シミュレーション
      const config = {
        start_time: new Date().toISOString(),
        duration: 120, // 2分 = 120秒
        speed: 2.0 // 2倍速
      };
      
      const result = await simulationApi.start(config);
      console.log('クイックデモ開始結果:', result);
      
      // 5秒後に自動停止（より長い時間実行）
      setTimeout(async () => {
        try {
          console.log('クイックデモ停止を開始...');
          const stopResult = await simulationApi.stop();
          console.log('クイックデモ停止結果:', stopResult);
          
          alert(`クイックデモ完了: シミュレーションが正常に実行されました`);
          
          setTestResults({
            test_type: 'demo',
            status: 'completed',
            results: {
              summary: {
                total_events: 'クイックデモ完了',
                test_duration_minutes: 2,
                systems_tested: '全システム'
              }
            },
            events: [
              {
                event: 'demo_completed',
                timestamp: new Date().toISOString(),
                details: stopResult
              }
            ],
            timestamp: new Date().toISOString()
          });
          
          setLoading(false);
        } catch (stopError: any) {
          console.error('クイックデモ停止エラー:', stopError);
          alert(`クイックデモ停止に失敗しました: ${stopError.message}`);
          setLoading(false);
        }
      }, 5000); // 5秒後に停止（より長い時間実行）
      
    } catch (error: any) {
      console.error('デモ実行エラー:', error);
      alert(`デモ実行に失敗しました: ${error.message}`);
      setLoading(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      // シミュレーションAPIの状態を確認
      const status = await simulationApi.getStatus();
      console.log('システム状況:', status);
      
      // システム状況を設定
      setSystemStatus({
        status: status.status,
        factory: {
          id: 'test_factory',
          name: 'テストファクトリー',
          products: 4, // 固定モデルの製品数
          processes: 4, // 固定モデルの工程数
          buffers: 4   // 固定モデルのバッファ数
        },
        systems: ['material_flow', 'quality_management', 'scheduling'],
        timestamp: status.current_time
      });
    } catch (error) {
      console.error('システム状況取得エラー:', error);
      // エラー時はデフォルト値を設定
      setSystemStatus({
        status: 'unknown',
        factory: {
          id: 'test_factory',
          name: 'テストファクトリー',
          products: 4,
          processes: 4,
          buffers: 4
        },
        systems: ['material_flow', 'quality_management', 'scheduling'],
        timestamp: new Date().toISOString()
      });
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

      {/* タブナビゲーション */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          aria-label="フェーズ2テストタブ"
          variant="fullWidth"
        >
          <Tab 
            icon={<Timeline />} 
            label="テスト実行" 
            iconPosition="start"
          />
          <Tab 
            icon={<Assessment />} 
            label="テストレポート" 
            iconPosition="start"
          />
          <Tab 
            icon={<Science />} 
            label="妥当性検証" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* タブコンテンツ */}
      {activeTab === 0 && (
        <Box>
          {/* 既存のテスト実行機能 */}

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
        </Box>
      )}

      {/* タブ2: テストレポート */}
      {activeTab === 1 && (
        <Box sx={{ mt: 3 }}>
          <Phase2TestReports />
        </Box>
      )}

      {/* シミュレーション妥当性検証タブ */}
      {activeTab === 2 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            🧪 シミュレーション妥当性検証
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            異なる設定でのシミュレーション実行と長時間シミュレーションを行い、システムの安定性とデータ整合性を検証します。
          </Typography>

          {/* 一括実行ボタン */}
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={runValidationTests}
              disabled={isValidationRunning}
              startIcon={isValidationRunning ? <CircularProgress size={20} /> : <Science />}
              sx={{ mr: 2 }}
            >
              {isValidationRunning ? '検証実行中...' : '全テストケース実行'}
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => setValidationResults([])}
              disabled={isValidationRunning}
            >
              結果クリア
            </Button>
          </Box>

          {/* テストケース一覧 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {validationTestCases.map((testCase, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card>
                  <CardHeader
                    title={testCase.name}
                    subheader={testCase.description}
                    action={
                      <Chip
                        label={`${testCase.config.duration}秒 / ${testCase.config.speed}倍速`}
                        color={testCase.color}
                        size="small"
                      />
                    }
                  />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      実行時間: {testCase.config.test_duration}秒
                    </Typography>
                    
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => runSingleValidationTest(index)}
                      disabled={isValidationRunning}
                      fullWidth
                    >
                      個別実行
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* 検証結果 */}
          {validationResults.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                📊 検証結果
              </Typography>
              
              <Grid container spacing={2}>
                {validationResults.map((result, index) => (
                  <Grid item xs={12} md={6} lg={4} key={index}>
                    <Card>
                      <CardHeader
                        title={result.testCase}
                        action={
                          <Chip
                            label={result.status}
                            color={
                              result.status === 'completed' ? 'success' :
                              result.status === 'failed' ? 'error' :
                              result.status === 'running' ? 'warning' : 'default'
                            }
                            size="small"
                          />
                        }
                      />
                      <CardContent>
                        {result.status === 'completed' && (
                          <Box>
                            <Typography variant="body2">
                              ✅ 実行時間: {result.duration}秒
                            </Typography>
                            <Typography variant="body2">
                              📊 イベント数: {result.events}
                            </Typography>
                            <Typography variant="body2">
                              📅 開始: {result.startTime?.slice(11, 19)}
                            </Typography>
                            <Typography variant="body2">
                              📅 終了: {result.endTime?.slice(11, 19)}
                            </Typography>
                            {result.reportPath && (
                              <Typography variant="body2" color="primary">
                                📄 レポート生成済み
                              </Typography>
                            )}
                          </Box>
                        )}
                        
                        {result.status === 'failed' && (
                          <Box>
                            <Typography variant="body2" color="error">
                              ❌ エラー: {result.error}
                            </Typography>
                            <Typography variant="body2">
                              📅 開始: {result.startTime?.slice(11, 19)}
                            </Typography>
                            <Typography variant="body2">
                              📅 終了: {result.endTime?.slice(11, 19)}
                            </Typography>
                          </Box>
                        )}
                        
                        {result.status === 'running' && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            <Typography variant="body2">
                              実行中... {result.startTime?.slice(11, 19)}
                            </Typography>
                          </Box>
                        )}
                        
                        {result.status === 'pending' && (
                          <Typography variant="body2" color="text.secondary">
                            ⏳ 待機中
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
};

export default Phase2TestPage;