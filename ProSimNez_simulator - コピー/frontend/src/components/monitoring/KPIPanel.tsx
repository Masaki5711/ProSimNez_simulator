import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import {
  Factory as FactoryIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';

interface KPICardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, unit, icon, color = 'primary.main' }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color, mr: 1 }}>
            {icon}
          </Box>
          <Typography color="text.secondary" variant="body2">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {unit && (
            <Typography variant="body1" component="span" sx={{ ml: 1 }}>
              {unit}
            </Typography>
          )}
        </Typography>
      </CardContent>
    </Card>
  );
};

const KPIPanel: React.FC = () => {
  const kpiData = useSelector((state: RootState) => state.monitoring.kpiData);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard
          title="スループット"
          value={kpiData.throughput}
          unit="個/時"
          icon={<FactoryIcon />}
          color="primary.main"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard
          title="サイクルタイム"
          value={kpiData.cycleTime}
          unit="分"
          icon={<TimerIcon />}
          color="secondary.main"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard
          title="OEE"
          value={kpiData.oee}
          unit="%"
          icon={<SpeedIcon />}
          color="success.main"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard
          title="品質率"
          value={kpiData.quality}
          unit="%"
          icon={<InventoryIcon />}
          color="warning.main"
        />
      </Grid>
    </Grid>
  );
};

export default KPIPanel;