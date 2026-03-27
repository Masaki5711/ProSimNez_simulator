import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, Divider, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Dashboard as DashboardIcon,
  AccountTree as NetworkIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Folder as ProjectIcon,
  Help as HelpIcon,
  Build as ComponentIcon,
} from '@mui/icons-material';
import ConnectionStatus from '../status/ConnectionStatus';
import SettingsPanel from './SettingsPanel';
import SidebarConfig from './SidebarConfig';
import KeyboardShortcuts from './KeyboardShortcuts';
import { useLanguage } from '../../contexts/LanguageContext';

const DRAWER_WIDTH = 220;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [sidebarConfigOpen, setSidebarConfigOpen] = React.useState(false);
  const [sidebarVisible, setSidebarVisible] = React.useState(() => {
    const saved = localStorage.getItem('sidebar-visible');
    return saved ? JSON.parse(saved) : true;
  });

  const toggleSidebar = () => {
    const next = !sidebarVisible;
    setSidebarVisible(next);
    localStorage.setItem('sidebar-visible', JSON.stringify(next));
  };

  const menuItems = [
    { text: t('sidebar.projects'), icon: <ProjectIcon />, path: '/projects' },
    { text: t('sidebar.simulator'), icon: <DashboardIcon />, path: '/' },
    { text: t('sidebar.networkEditor'), icon: <NetworkIcon />, path: '/network-editor' },
    { text: t('sidebar.componentEditor'), icon: <ComponentIcon />, path: '/component-editor' },
    { text: t('sidebar.analytics'), icon: <AnalyticsIcon />, path: '/analytics' },
    { text: t('sidebar.help'), icon: <HelpIcon />, path: '/help' },
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ color: 'primary.main' }}>
          ProSimNez
        </Typography>
        <Tooltip title="サイドバーを閉じる (Ctrl+B)">
          <IconButton size="small" onClick={toggleSidebar}>
            <CollapseIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
              sx={{ py: 0.8, borderRadius: 1, mx: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List dense>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setSettingsOpen(true)} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={t('sidebar.settings')} primaryTypographyProps={{ fontSize: 13 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const w = sidebarVisible ? DRAWER_WIDTH : 0;

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh' }}>
      {/* AppBar */}
      <AppBar position="fixed" elevation={1}
        sx={{ width: `calc(100% - ${w}px)`, ml: `${w}px`, bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar variant="dense" sx={{ minHeight: 48 }}>
          {!sidebarVisible && (
            <Tooltip title="サイドバーを開く (Ctrl+B)">
              <IconButton edge="start" onClick={toggleSidebar} sx={{ mr: 1 }}>
                <ExpandIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 1, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ flexGrow: 1 }}>
            {menuItems.find(m => m.path === location.pathname)?.text || t('app.title')}
          </Typography>
          <ConnectionStatus />
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {sidebarVisible && (
        <Box component="nav" sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
          <Drawer variant="permanent" sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }} open>
            {drawer}
          </Drawer>
        </Box>
      )}

      {/* Mobile drawer */}
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: `calc(100% - ${w}px)` }}>
        <Toolbar variant="dense" sx={{ minHeight: 48 }} />
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SidebarConfig open={sidebarConfigOpen} onClose={() => setSidebarConfigOpen(false)}
        drawerWidth={DRAWER_WIDTH} onDrawerWidthChange={() => {}}
        sidebarVisible={sidebarVisible} onSidebarVisibilityChange={toggleSidebar} />
      <KeyboardShortcuts
        onToggleSidebar={toggleSidebar}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSidebarConfig={() => setSidebarConfigOpen(true)}
        onNewProject={() => {}}
      />
    </Box>
  );
};

export default MainLayout;
