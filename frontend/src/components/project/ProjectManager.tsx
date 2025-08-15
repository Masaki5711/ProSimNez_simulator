import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../store';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Tooltip,
  Fab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Share as ShareIcon,
  Archive as ArchiveIcon,
  RestoreFromTrash as RestoreIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as ViewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  MoreVert as MoreIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { Project, ProjectFilter, ProjectTemplate } from '../../types/projectTypes';
import { resetProjectData, checkProjectData } from '../../utils/projectDataReset';
import { RootState } from '../../store';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  setCurrentProject,
  setFilter,
  setSearchTerm,
  setSortBy,
  setSortOrder,
  setActiveTab,
} from '../../store/projectSlice';

interface ProjectManagerProps {
  onProjectSelect: (project: Project) => void;
  onProjectCreate: (project: Partial<Project>) => void;
  onProjectUpdate: (projectId: string, updates: Partial<Project>) => void;
  onProjectDelete: (projectId: string) => void;
  onProjectArchive: (projectId: string) => void;
  onProjectRestore: (projectId: string) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({
  onProjectSelect,
  onProjectCreate,
  onProjectUpdate,
  onProjectDelete,
  onProjectArchive,
  onProjectRestore,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  // Redux状態
  const {
    projects,
    loading,
    error,
    filter,
    searchTerm,
    sortBy,
    sortOrder,
    activeTab,
    connectedUsers,
  } = useSelector((state: RootState) => state.project);
  
  // ローカル状態
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // ダイアログ状態
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // フォーム状態
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    description: '',
    category: 'manufacturing',
    tags: [],
    status: 'active',
  });

  // プロジェクトデータの初期化
  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  // 型ガード関数
  const isProject = (item: unknown): item is Project => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.status === 'string' &&
      typeof obj.category === 'string' &&
      Array.isArray(obj.tags)
    );
  };

  // プロジェクトデータを配列に変換（型安全性を確保）
  const projectsArray: Project[] = React.useMemo(() => {
    if (Array.isArray(projects)) {
      return projects;
    }
    // オブジェクト形式の場合は配列に変換
    const values = Object.values(projects || {});
    return values.filter(isProject);
  }, [projects]);

  // フィルタリングとソート
  const filteredProjects = projectsArray.filter((project: Project) => {
    // 検索語によるフィルタリング
    if (searchTerm && !project.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !project.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // カテゴリフィルタリング
    if (filter.category && project.category !== filter.category) {
      return false;
    }

    // ステータスフィルタリング
    if (filter.status && project.status !== filter.status) {
      return false;
    }

    // タグフィルタリング
    if (filter.tags && filter.tags.length > 0) {
      const hasMatchingTag = filter.tags.some(tag => project.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    return true;
  }).sort((a: Project, b: Project) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
        break;
      case 'category':
        aValue = a.category;
        bValue = b.category;
        break;
      default:
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // プロジェクト作成
  const handleCreateProject = async () => {
    // バリデーション
    if (!formData.name?.trim()) {
      showSnackbar('プロジェクト名を入力してください');
      return;
    }

    try {
      await dispatch(createProject({
        name: formData.name.trim(),
        description: formData.description || '',
        category: formData.category || 'manufacturing',
        tags: formData.tags || [],
      })).unwrap();
      
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '', category: 'manufacturing', tags: [], status: 'active' });
      showSnackbar('プロジェクトを作成しました');
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      showSnackbar(`プロジェクト作成に失敗しました: ${error}`);
    }
  };

  // プロジェクト編集
  const handleEditProject = () => {
    if (!selectedProject) return;

    dispatch(updateProject({
      projectId: selectedProject.id,
      updates: formData
    }));
    setEditDialogOpen(false);
    setSelectedProject(null);
    showSnackbar('プロジェクトを更新しました');
  };

  // プロジェクト削除
  const handleDeleteProject = () => {
    if (!selectedProject) return;

    dispatch(deleteProject(selectedProject.id));
    setDeleteDialogOpen(false);
    setSelectedProject(null);
    showSnackbar('プロジェクトを削除しました');
  };

  // プロジェクトアーカイブ
  const handleArchiveProject = () => {
    if (!selectedProject) return;

    dispatch(updateProject({
      projectId: selectedProject.id,
      updates: { status: 'archived' }
    }));
    setArchiveDialogOpen(false);
    setSelectedProject(null);
    showSnackbar('プロジェクトをアーカイブしました');
  };

  // プロジェクト復元
  const handleRestoreProject = (projectId: string) => {
    dispatch(updateProject({
      projectId,
      updates: { status: 'active' }
    }));
    showSnackbar('プロジェクトを復元しました');
  };

  // スナックバー表示
  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  // デバッグ用：プロジェクトデータリセット
  const handleResetProjectData = async () => {
    try {
      await resetProjectData();
      // 少し待ってからfetchを実行
      setTimeout(() => {
        dispatch(fetchProjects());
      }, 500);
      showSnackbar('プロジェクトデータをリセットしました - コンソールログを確認してください');
    } catch (error) {
      console.error('Reset error:', error);
      showSnackbar('リセットエラーが発生しました');
    }
  };

  // デバッグ用：プロジェクトデータ確認
  const handleCheckProjectData = () => {
    checkProjectData();
    showSnackbar('コンソールでプロジェクトデータを確認してください');
  };

  // プロジェクト選択時の処理
  const handleProjectSelect = (project: Project) => {
    dispatch(setCurrentProject(project));
    // ネットワーク編集ページに遷移
    navigate('/network-editor');
  };

  // カテゴリの表示名
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      manufacturing: '製造',
      logistics: '物流',
      quality: '品質管理',
      maintenance: '保守',
      research: '研究開発',
    };
    return labels[category] || category;
  };

  // ステータスの表示名
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'アクティブ',
      archived: 'アーカイブ',
      deleted: '削除済み',
    };
    return labels[status] || status;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            プロジェクト管理
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              新規プロジェクト
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={handleResetProjectData}
              size="small"
            >
              データリセット
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={handleCheckProjectData}
              size="small"
            >
              データ確認
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                // 強制的にlocalStorageから読み込み
                const stored = localStorage.getItem('projects');
                if (stored) {
                  try {
                    const projects = JSON.parse(stored);
                    console.log('🔧 Force loading from localStorage:', projects);
                    // Redux storeを直接更新
                    // これは緊急手段です
                    window.location.reload();
                  } catch (error) {
                    console.error('Parse error:', error);
                  }
                }
              }}
              size="small"
            >
              強制更新
            </Button>
          </Box>
        </Box>

        {/* 検索・フィルター */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="プロジェクトを検索..."
            value={searchTerm}
            onChange={(e) => dispatch(setSearchTerm(e.target.value))}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={filter.category || ''}
              onChange={(e) => dispatch(setFilter({ ...filter, category: e.target.value }))}
              label="カテゴリ"
            >
              <MenuItem value="">すべて</MenuItem>
              <MenuItem value="manufacturing">製造</MenuItem>
              <MenuItem value="logistics">物流</MenuItem>
              <MenuItem value="quality">品質管理</MenuItem>
              <MenuItem value="maintenance">保守</MenuItem>
              <MenuItem value="research">研究開発</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>ステータス</InputLabel>
            <Select
              value={filter.status || ''}
              onChange={(e) => dispatch(setFilter({ ...filter, status: e.target.value }))}
              label="ステータス"
            >
              <MenuItem value="">すべて</MenuItem>
              <MenuItem value="active">アクティブ</MenuItem>
              <MenuItem value="archived">アーカイブ</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>並び順</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => dispatch(setSortBy(e.target.value as any))}
              label="並び順"
            >
              <MenuItem value="updatedAt">更新日時</MenuItem>
              <MenuItem value="createdAt">作成日時</MenuItem>
              <MenuItem value="name">名前</MenuItem>
              <MenuItem value="category">カテゴリ</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* タブ */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => dispatch(setActiveTab(newValue))}>
          <Tab label="アクティブ" />
          <Tab label="アーカイブ" />
          <Tab label="テンプレート" />
        </Tabs>
      </Paper>

      {/* デバッグ情報 */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>🔍 デバッグ情報</Typography>
        <Typography variant="body2" component="div">
          <strong>プロジェクト数:</strong> {projectsArray.length}<br/>
          <strong>フィルター済み:</strong> {filteredProjects.length}<br/>
          <strong>ローディング:</strong> {loading ? 'Yes' : 'No'}<br/>
          <strong>エラー:</strong> {error || 'None'}<br/>
          <strong>Redux projects:</strong> {Array.isArray(projects) ? `配列[${projects.length}]` : `オブジェクト[${Object.keys(projects || {}).length}]`}<br/>
          <strong>localStorage:</strong> {localStorage.getItem('projects') ? 'あり' : 'なし'}
        </Typography>
      </Paper>

      {/* プロジェクト一覧 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : filteredProjects.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              📋 プロジェクトが見つかりません
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              デモファクトリーを復元するには「データリセット」ボタンをクリックしてください
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleResetProjectData}
              sx={{ mr: 1 }}
            >
              デモファクトリーを復元
            </Button>
            <Button
              variant="outlined"
              onClick={handleCheckProjectData}
            >
              データ状況確認
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {filteredProjects
              .filter((project: Project) => {
                if (activeTab === 0) return project.status === 'active';
                if (activeTab === 1) return project.status === 'archived';
                return true; // テンプレートタブ
              })
              .map((project: Project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                                  <Card 
                    sx={{ 
                      height: '100%',
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 3 }
                    }}
                    onClick={() => handleProjectSelect(project)}
                  >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" component="h3" noWrap>
                        {project.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                          setFormData(project);
                          setEditDialogOpen(true);
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                      {project.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={getCategoryLabel(project.category)} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={getStatusLabel(project.status)} 
                        size="small" 
                        color={project.status === 'active' ? 'success' : 'default'}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                      {project.tags.slice(0, 3).map((tag: string, index: number) => (
                        <Chip key={index} label={tag} size="small" />
                      ))}
                      {project.tags.length > 3 && (
                        <Chip label={`+${project.tags.length - 3}`} size="small" />
                      )}
                    </Box>

                                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'text.secondary' }}>
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                         <CalendarIcon fontSize="small" />
                         {new Date(project.updatedAt).toLocaleDateString()}
                       </Box>
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                         <PersonIcon fontSize="small" />
                         {project.createdBy}
                       </Box>
                       {connectedUsers.length > 0 && (
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                           <GroupIcon fontSize="small" />
                           {connectedUsers.length}
                         </Box>
                       )}
                     </Box>
                   </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <IconButton size="small" onClick={(e) => e.stopPropagation()}>
                        <ViewIcon />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => e.stopPropagation()}>
                        <ShareIcon />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => e.stopPropagation()}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <Box>
                      {project.status === 'archived' ? (
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreProject(project.id);
                          }}
                        >
                          <RestoreIcon />
                        </IconButton>
                      ) : (
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(project);
                            setArchiveDialogOpen(true);
                          }}
                        >
                          <ArchiveIcon />
                        </IconButton>
                      )}
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
                         ))}
           </Grid>
         )}
       </Box>

      {/* 新規プロジェクト作成ダイアログ */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新規プロジェクト作成</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="プロジェクト名"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="説明"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              label="カテゴリ"
            >
              <MenuItem value="manufacturing">製造</MenuItem>
              <MenuItem value="logistics">物流</MenuItem>
              <MenuItem value="quality">品質管理</MenuItem>
              <MenuItem value="maintenance">保守</MenuItem>
              <MenuItem value="research">研究開発</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={!formData.name || loading}>
            {loading ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* プロジェクト編集ダイアログ */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>プロジェクト編集</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="プロジェクト名"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="説明"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              label="カテゴリ"
            >
              <MenuItem value="manufacturing">製造</MenuItem>
              <MenuItem value="logistics">物流</MenuItem>
              <MenuItem value="quality">品質管理</MenuItem>
              <MenuItem value="maintenance">保守</MenuItem>
              <MenuItem value="research">研究開発</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleEditProject} variant="contained" disabled={!formData.name}>
            更新
          </Button>
        </DialogActions>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>プロジェクト削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedProject?.name}」を削除しますか？この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* アーカイブ確認ダイアログ */}
      <Dialog open={archiveDialogOpen} onClose={() => setArchiveDialogOpen(false)}>
        <DialogTitle>プロジェクトアーカイブ</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedProject?.name}」をアーカイブしますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleArchiveProject} variant="contained">
            アーカイブ
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default ProjectManager; 