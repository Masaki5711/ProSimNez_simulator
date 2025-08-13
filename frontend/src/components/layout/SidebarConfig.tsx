import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarConfigProps {
  open: boolean;
  onClose: () => void;
  drawerWidth: number;
  onDrawerWidthChange: (width: number) => void;
  sidebarVisible: boolean;
  onSidebarVisibilityChange: (visible: boolean) => void;
}

const SidebarConfig: React.FC<SidebarConfigProps> = ({
  open,
  onClose,
  drawerWidth,
  onDrawerWidthChange,
  sidebarVisible,
  onSidebarVisibilityChange,
}) => {
  const { t } = useLanguage();
  const [expandedSections, setExpandedSections] = React.useState({
    appearance: true,
    behavior: false,
    shortcuts: false,
  });

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  const handleWidthChange = (event: Event, newValue: number | number[]) => {
    onDrawerWidthChange(newValue as number);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: 320 }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">{t('sidebarConfig.title')}</Typography>
          <IconButton onClick={onClose}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 外観設定 */}
        <Box sx={{ mb: 2 }}>
          <ListItemButton onClick={() => handleSectionToggle('appearance')}>
            <ListItemIcon>
              <VisibilityIcon />
            </ListItemIcon>
            <ListItemText primary={t('sidebarConfig.appearance')} />
            {expandedSections.appearance ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSections.appearance}>
            <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={sidebarVisible}
                    onChange={(e) => onSidebarVisibilityChange(e.target.checked)}
                  />
                }
                label={t('sidebarConfig.showSidebar')}
                sx={{ mb: 2 }}
              />
              
              <Typography gutterBottom>{t('sidebarConfig.sidebarWidth')}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DragIcon color="action" />
                <Slider
                  value={drawerWidth}
                  onChange={handleWidthChange}
                  min={200}
                  max={400}
                  step={10}
                  marks={[
                    { value: 200, label: '200px' },
                    { value: 300, label: '300px' },
                    { value: 400, label: '400px' }
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('sidebarConfig.currentWidth').replace('{width}', drawerWidth.toString())}
              </Typography>
            </Box>
          </Collapse>
        </Box>

        {/* 動作設定 */}
        <Box sx={{ mb: 2 }}>
          <ListItemButton onClick={() => handleSectionToggle('behavior')}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary={t('sidebarConfig.behavior')} />
            {expandedSections.behavior ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSections.behavior}>
            <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label={t('sidebarConfig.hoverHighlight')}
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label={t('sidebarConfig.activeItemHighlight')}
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={<Switch />}
                label={t('sidebarConfig.animationEffects')}
                sx={{ mb: 1 }}
              />
            </Box>
          </Collapse>
        </Box>

        {/* ショートカット設定 */}
        <Box sx={{ mb: 2 }}>
          <ListItemButton onClick={() => handleSectionToggle('shortcuts')}>
            <ListItemIcon>
              <DragIcon />
            </ListItemIcon>
            <ListItemText primary={t('sidebarConfig.shortcuts')} />
            {expandedSections.shortcuts ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSections.shortcuts}>
            <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('sidebarConfig.keyboardShortcuts')}
              </Typography>
              <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                <Box>{t('shortcuts.sidebarToggle')}</Box>
                <Box>{t('shortcuts.settingsPanel')}</Box>
                <Box>{t('shortcuts.newProject')}</Box>
              </Box>
            </Box>
          </Collapse>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* クイックアクション */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t('sidebarConfig.quickActions')}
          </Typography>
          <List dense>
            <ListItem disablePadding>
              <ListItemButton onClick={() => {
                onDrawerWidthChange(240);
                onSidebarVisibilityChange(true);
              }}>
                <ListItemText primary={t('sidebarConfig.resetSettings')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => {
                const config = {
                  drawerWidth,
                  sidebarVisible,
                  timestamp: new Date().toISOString()
                };
                const dataStr = JSON.stringify(config, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'sidebar-config.json';
                link.click();
                URL.revokeObjectURL(url);
              }}>
                <ListItemText primary={t('sidebarConfig.exportSettings')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      try {
                        const config = JSON.parse(e.target?.result as string);
                        if (config.drawerWidth) onDrawerWidthChange(config.drawerWidth);
                        if (typeof config.sidebarVisible === 'boolean') onSidebarVisibilityChange(config.sidebarVisible);
                      } catch (error) {
                        console.error('設定ファイルの読み込みに失敗しました:', error);
                      }
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}>
                <ListItemText primary={t('sidebarConfig.importSettings')} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SidebarConfig; 