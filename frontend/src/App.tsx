import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import { useDispatch } from 'react-redux';
import MainLayout from './components/layout/MainLayout';
import WebSocketProvider from './components/websocket/WebSocketProvider';
import { LanguageProvider } from './contexts/LanguageContext';
import SimulatorPage from './pages/SimulatorPage';
import NetworkEditorPage from './pages/NetworkEditorPage';
import ComponentEditorPage from './pages/ComponentEditorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProjectsPage from './pages/ProjectsPage';
import HelpPage from './pages/HelpPage';
// Phase2TestPage removed
import { setCurrentProject, setNetworkData } from './store/projectSlice';
import { initializeSimpleTest } from './data/simpleTest';
import { initializePushPullTest } from './data/pushPullTest';

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    // プロジェクト初期化
    const existing = JSON.parse(localStorage.getItem('projects') || '[]');
    if (!existing.some((p: any) => p.id === 'test_pushpull')) {
      const { project, networkData } = initializePushPullTest();
      dispatch(setCurrentProject(project as any));
      dispatch(setNetworkData(networkData));
      return;
    }

    // 前回選択したプロジェクトを復元
    const lastProjectId = localStorage.getItem('lastSelectedProjectId');
    if (lastProjectId) {
      const projects = JSON.parse(localStorage.getItem('projects') || '[]');
      const proj = projects.find((p: any) => p.id === lastProjectId);
      if (proj) {
        dispatch(setCurrentProject(proj));
        const nd = localStorage.getItem(`project_${lastProjectId}_network`);
        if (nd) dispatch(setNetworkData(JSON.parse(nd)));
      }
    }
  }, [dispatch]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <MainLayout>
        <Routes>
          <Route path="/" element={<SimulatorPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/editor" element={<NetworkEditorPage />} />
          <Route path="/network-editor" element={<NetworkEditorPage />} />
          <Route path="/component-editor" element={<ComponentEditorPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </MainLayout>
    </Box>
  );
}

function App() {
  return (
    <LanguageProvider>
      <WebSocketProvider>
        <AppContent />
      </WebSocketProvider>
    </LanguageProvider>
  );
}

export default App;
