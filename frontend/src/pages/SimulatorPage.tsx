import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
} from '@mui/material';
import {
  PlayArrow as SimulationIcon,
  AccountTree as NetworkIcon,
  Assessment as MonitorIcon,
} from '@mui/icons-material';

// コンポーネントのインポート
import SimulationControl from '../components/simulation/SimulationControl';
import NetworkEditor from '../components/network/NetworkEditor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simulator-tabpanel-${index}`}
      aria-labelledby={`simulator-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const SimulatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* ヘッダー */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SimulationIcon color="primary" />
          ProSimNez シミュレーター
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          製造ネットワークの設計とシミュレーション実行
        </Typography>
      </Paper>

      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, px: 2, pb: 2 }}>
        <Card sx={{ height: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab 
                label="シミュレーション" 
                icon={<SimulationIcon />} 
                iconPosition="start" 
              />
              <Tab 
                label="ネットワーク設計" 
                icon={<NetworkIcon />} 
                iconPosition="start" 
              />
              <Tab 
                label="監視・分析" 
                icon={<MonitorIcon />} 
                iconPosition="start" 
              />
            </Tabs>
          </Box>

          <CardContent sx={{ height: 'calc(100% - 48px)', p: 0 }}>
            <TabPanel value={activeTab} index={0}>
              <SimulationControl />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <Box sx={{ height: '100%' }}>
                <NetworkEditor />
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <Box sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                  監視・分析
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          KPI監視
                        </Typography>
                        <Typography color="text.secondary">
                          シミュレーション実行中のKPI（稼働率、スループット等）をリアルタイムで監視します。
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          在庫分析
                        </Typography>
                        <Typography color="text.secondary">
                          各工程・バッファの在庫レベルと変動を分析します。
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          ボトルネック分析
                        </Typography>
                        <Typography color="text.secondary">
                          生産ライン上のボトルネック箇所を特定・分析します。
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          イベントログ
                        </Typography>
                        <Typography color="text.secondary">
                          シミュレーション中のイベントを時系列で確認できます。
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SimulatorPage;