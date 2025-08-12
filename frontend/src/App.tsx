import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import MainLayout from './components/layout/MainLayout';
import WebSocketProvider from './components/websocket/WebSocketProvider';
import SimulatorPage from './pages/SimulatorPage';
import NetworkEditorPage from './pages/NetworkEditorPage';
import ComponentEditorPage from './pages/ComponentEditorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProjectsPage from './pages/ProjectsPage';
import HelpPage from './pages/HelpPage';

function App() {
  return (
    <WebSocketProvider>
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
    </WebSocketProvider>
  );
}

export default App;