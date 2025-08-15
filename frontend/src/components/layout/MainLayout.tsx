import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  AccountTree as NetworkIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Folder as ProjectIcon,
  Help as HelpIcon,
  Build as ComponentIcon,
  DragIndicator as DragIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import ConnectionStatus from '../status/ConnectionStatus';
import SettingsPanel from './SettingsPanel';
import SidebarConfig from './SidebarConfig';
import KeyboardShortcuts from './KeyboardShortcuts';
import { useLanguage } from '../../contexts/LanguageContext';

const drawerWidth = 240;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [sidebarConfigOpen, setSidebarConfigOpen] = React.useState(false);
  const [currentDrawerWidth, setCurrentDrawerWidth] = React.useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved) : drawerWidth;
  });
  const [sidebarVisible, setSidebarVisible] = React.useState(() => {
    const saved = localStorage.getItem('sidebar-visible');
    return saved ? JSON.parse(saved) : true;
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerWidthChange = (width: number) => {
    setCurrentDrawerWidth(width);
    localStorage.setItem('sidebar-width', width.toString());
  };

  const handleSidebarVisibilityChange = (visible: boolean) => {
    setSidebarVisible(visible);
    localStorage.setItem('sidebar-visible', JSON.stringify(visible));
  };

  const menuItems = [
    { text: t('sidebar.projects'), icon: <ProjectIcon />, path: '/projects' },
    { text: t('sidebar.simulator'), icon: <DashboardIcon />, path: '/' },
    { text: t('sidebar.networkEditor'), icon: <NetworkIcon />, path: '/network-editor' },
    { text: t('sidebar.componentEditor'), icon: <ComponentIcon />, path: '/component-editor' },
    { text: t('sidebar.analytics'), icon: <AnalyticsIcon />, path: '/analytics' },
    { text: 'フェーズ2テスト', icon: <TestIcon />, path: '/phase2-test' },
    { text: t('sidebar.help'), icon: <HelpIcon />, path: '/help' },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <img 
            src="/logo.png" 
            alt="生産シミュレーター" 
            style={{ 
              height: '120px', 
              width: 'auto',
              maxWidth: '540px'
            }} 
          />
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setSettingsOpen(true)}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary={t('sidebar.settings')} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setSidebarConfigOpen(true)}>
            <ListItemIcon>
              <DragIcon />
            </ListItemIcon>
            <ListItemText primary={t('sidebar.sidebarConfig')} />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${sidebarVisible ? currentDrawerWidth : 0}px)` },
          ml: { sm: `${sidebarVisible ? currentDrawerWidth : 0}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>
          <ConnectionStatus />
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ 
          width: { sm: sidebarVisible ? currentDrawerWidth : 0 }, 
          flexShrink: { sm: 0 },
          display: { sm: sidebarVisible ? 'block' : 'none' }
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${sidebarVisible ? currentDrawerWidth : 0}px)` },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto', overflowX: 'hidden' }}>
            {children}
        </Box>
      </Box>
      
      <SettingsPanel 
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      
      <SidebarConfig
        open={sidebarConfigOpen}
        onClose={() => setSidebarConfigOpen(false)}
        drawerWidth={currentDrawerWidth}
        onDrawerWidthChange={handleDrawerWidthChange}
        sidebarVisible={sidebarVisible}
        onSidebarVisibilityChange={handleSidebarVisibilityChange}
      />
      
      <KeyboardShortcuts
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSidebarConfig={() => setSidebarConfigOpen(true)}
        onNewProject={() => {
          // 新規プロジェクト作成の処理
          console.log('新規プロジェクト作成');
        }}
      />
    </Box>
  );
};

export default MainLayout;