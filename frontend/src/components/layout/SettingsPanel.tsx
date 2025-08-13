import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Divider,
  Alert,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette as ThemeIcon,
  Language as LanguageIcon,
  Notifications as NotificationIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useLanguage } from '../../contexts/LanguageContext';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onClose }) => {
  const { t, language, setLanguage, getAvailableLanguages } = useLanguage();
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    theme: 'light',
    language: language,
    notifications: true,
    autoSave: true,
    simulationSpeed: 1,
    maxIterations: 1000,
    dataRetention: 30,
    securityLevel: 'medium',
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // 言語が変更された場合、LanguageContextも更新
    if (key === 'language') {
      setLanguage(value);
    }
  };

  // 言語が変更された場合、設定も更新
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      language: language
    }));
  }, [language]);

  const handleSave = () => {
    // 設定を保存する処理
    localStorage.setItem('simulator-settings', JSON.stringify(settings));
    onClose();
  };

  const handleReset = () => {
    // デフォルト設定にリセット
    setSettings({
      theme: 'light',
      language: 'ja',
      notifications: true,
      autoSave: true,
      simulationSpeed: 1,
      maxIterations: 1000,
      dataRetention: 30,
      securityLevel: 'medium',
    });
    setLanguage('ja');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        {t('settings.title')}
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="設定タブ">
            <Tab icon={<ThemeIcon />} label={t('settings.appearance')} />
            <Tab icon={<LanguageIcon />} label={t('settings.language')} />
            <Tab icon={<NotificationIcon />} label={t('settings.notifications')} />
            <Tab icon={<StorageIcon />} label={t('settings.dataStorage')} />
            <Tab icon={<SecurityIcon />} label={t('settings.security')} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>{t('settings.appearance')}</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('settings.theme')}</InputLabel>
            <Select
              value={settings.theme}
              label={t('settings.theme')}
              onChange={(e) => handleSettingChange('theme', e.target.value)}
            >
              <MenuItem value="light">{t('settings.theme.light')}</MenuItem>
              <MenuItem value="dark">{t('settings.theme.dark')}</MenuItem>
              <MenuItem value="auto">{t('settings.theme.auto')}</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoSave}
                onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
              />
            }
            label={t('settings.autoSave')}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>{t('settings.language')}</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('settings.language.label')}</InputLabel>
            <Select
              value={settings.language}
              label={t('settings.language.label')}
              onChange={(e) => handleSettingChange('language', e.target.value)}
            >
              {getAvailableLanguages().map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>{t('settings.notifications')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              />
            }
            label={t('settings.notifications.enable')}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>{t('settings.dataStorage')}</Typography>
          
          <Typography gutterBottom>{t('settings.simulationSpeed')}</Typography>
          <Slider
            value={settings.simulationSpeed}
            onChange={(_, value) => handleSettingChange('simulationSpeed', value)}
            min={0.1}
            max={10}
            step={0.1}
            marks={[
              { value: 0.1, label: '0.1x' },
              { value: 1, label: '1x' },
              { value: 10, label: '10x' }
            ]}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label={t('settings.maxIterations')}
            type="number"
            value={settings.maxIterations}
            onChange={(e) => handleSettingChange('maxIterations', parseInt(e.target.value))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('settings.dataRetention')}
            type="number"
            value={settings.dataRetention}
            onChange={(e) => handleSettingChange('dataRetention', parseInt(e.target.value))}
            sx={{ mb: 2 }}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>{t('settings.security')}</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('settings.securityLevel')}</InputLabel>
            <Select
              value={settings.securityLevel}
              label={t('settings.securityLevel')}
              onChange={(e) => handleSettingChange('securityLevel', e.target.value)}
            >
              <MenuItem value="low">{t('settings.securityLevel.low')}</MenuItem>
              <MenuItem value="medium">{t('settings.securityLevel.medium')}</MenuItem>
              <MenuItem value="high">{t('settings.securityLevel.high')}</MenuItem>
            </Select>
          </FormControl>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('settings.securityLevel.info')}
          </Alert>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleReset} color="secondary">
          {t('common.reset')}
        </Button>
        <Button onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsPanel; 