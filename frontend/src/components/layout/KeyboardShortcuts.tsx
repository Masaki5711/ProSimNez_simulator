import React, { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenSidebarConfig: () => void;
  onNewProject: () => void;
}

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  onToggleSidebar,
  onOpenSettings,
  onOpenSidebarConfig,
  onNewProject,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl + B: サイドバー表示/非表示
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault();
        onToggleSidebar();
      }
      
      // Ctrl + Shift + S: 設定パネル
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        onOpenSettings();
      }
      
      // Ctrl + Shift + C: サイドバー設定
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        onOpenSidebarConfig();
      }
      
      // Ctrl + Shift + N: 新規プロジェクト
      if (event.ctrlKey && event.shiftKey && event.key === 'N') {
        event.preventDefault();
        onNewProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToggleSidebar, onOpenSettings, onOpenSidebarConfig, onNewProject]);

  // このコンポーネントはUIを表示しない
  return null;
};

export default KeyboardShortcuts; 