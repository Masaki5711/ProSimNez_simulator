import React, { useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import ProjectManager from '../components/project/ProjectManager';
import { Project } from '../types/projectTypes';

const ProjectsPage: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project);
    console.log('プロジェクトが選択されました:', project.name);
    // ここでプロジェクトの詳細ページに遷移するか、
    // プロジェクトのデータを読み込む処理を実装
  };

  const handleProjectCreate = (project: Partial<Project>) => {
    console.log('プロジェクトを作成しました:', project);
  };

  const handleProjectUpdate = (projectId: string, updates: Partial<Project>) => {
    console.log('プロジェクトを更新しました:', projectId, updates);
  };

  const handleProjectDelete = (projectId: string) => {
    console.log('プロジェクトを削除しました:', projectId);
  };

  const handleProjectArchive = (projectId: string) => {
    console.log('プロジェクトをアーカイブしました:', projectId);
  };

  const handleProjectRestore = (projectId: string) => {
    console.log('プロジェクトを復元しました:', projectId);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          プロジェクト管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          製造ラインの設計・シミュレーション・分析プロジェクトを管理します
        </Typography>
      </Paper>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <ProjectManager
          onProjectSelect={handleProjectSelect}
          onProjectCreate={handleProjectCreate}
          onProjectUpdate={handleProjectUpdate}
          onProjectDelete={handleProjectDelete}
          onProjectArchive={handleProjectArchive}
          onProjectRestore={handleProjectRestore}
        />
      </Box>
    </Box>
  );
};

export default ProjectsPage; 