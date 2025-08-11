import React from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
} from '@mui/material';
import {
  PlayCircle as StartIcon,
  CheckCircle as CompleteIcon,
  LocalShipping as TransportIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import dayjs from 'dayjs';

const EventLog: React.FC = () => {
  const alerts = useSelector((state: RootState) => state.monitoring.alerts);
  
  // 最新のアラート/イベントを上に表示
  const recentEvents = [...alerts].reverse().slice(0, 50);

  const getEventIcon = (alertType: 'info' | 'warning' | 'error') => {
    switch (alertType) {
      case 'info':
        return <InfoIcon color="primary" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <WarningIcon color="error" />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        イベントログ
      </Typography>
      
      {recentEvents.length === 0 ? (
        <Typography color="text.secondary">
          イベントがありません
        </Typography>
      ) : (
        <List dense>
          {recentEvents.map((alert, index) => (
            <ListItem key={alert.id || index}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                {getEventIcon(alert.type)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={alert.type.toUpperCase()}
                      size="small"
                      variant="outlined"
                      color={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'primary'}
                    />
                    <Typography variant="body2">
                      {alert.message}
                    </Typography>
                  </Box>
                }
                secondary={dayjs(alert.timestamp).format('HH:mm:ss')}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default EventLog;