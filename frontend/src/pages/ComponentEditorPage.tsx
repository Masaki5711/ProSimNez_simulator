import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Build as BuildIcon,
  Inventory as InventoryIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Category as CategoryIcon,
  Description as DescriptionIcon,
  LocalOffer as LocalOfferIcon,
  Receipt as ReceiptIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { Component, ComponentCategory, ComponentBOMItem } from '../types/productionTypes';
import {
  fetchComponents,
  saveComponent,
  deleteComponent,
  saveCategory,
  deleteCategory,
  saveBOMItem,
  deleteBOMItem,
} from '../store/slices/componentSlice';



const ComponentEditorPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { components, categories, loading, error } = useSelector((state: RootState) => state.components);
  const { currentProject } = useSelector((state: RootState) => state.project);
  
  const [activeTab, setActiveTab] = useState(0);
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Partial<Component>>({});
  const [editingCategory, setEditingCategory] = useState<Partial<ComponentCategory>>({});
  const [editingBomItem, setEditingBomItem] = useState<Partial<ComponentBOMItem>>({});
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // プロジェクトが変更されたときに部品データを再取得
  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchComponents(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  const handleSaveComponent = () => {
    if (!currentProject?.id) {
      showSnackbar('プロジェクトが選択されていません。部品の追加・編集を行うには、左サイドバーでプロジェクトを選択してください。');
      return;
    }
    
    // 必須フィールドのバリデーション
    if (!editingComponent.name || !editingComponent.code) {
      showSnackbar('部品名と部品コードは必須です');
      return;
    }
    
    // 新規作成か編集かを判定
    const isNewComponent = !editingComponent.id;
    console.log('部品保存開始:', { 
      editingComponent, 
      projectId: currentProject.id, 
      isNewComponent 
    });
    
    dispatch(saveComponent({ component: editingComponent, projectId: currentProject.id })).then((result) => {
      console.log('部品保存結果:', result);
      setComponentDialogOpen(false);
      setEditingComponent({});
      showSnackbar(isNewComponent ? '部品を追加しました' : '部品を更新しました');
    }).catch((error) => {
      console.error('部品保存エラー:', error);
      showSnackbar('部品の保存に失敗しました');
    });
  };

  const handleSaveCategory = () => {
    if (!currentProject?.id) {
      showSnackbar('プロジェクトが選択されていません');
      return;
    }
    dispatch(saveCategory({ category: editingCategory, projectId: currentProject.id })).then(() => {
      setCategoryDialogOpen(false);
      setEditingCategory({});
      showSnackbar('カテゴリを保存しました');
    });
  };

  const handleSaveBOMItem = () => {
    if (!selectedComponent || !currentProject?.id) return;
    dispatch(saveBOMItem({ 
      componentId: selectedComponent.id, 
      bomItem: editingBomItem,
      projectId: currentProject.id 
    })).then(() => {
      setBomDialogOpen(false);
      setEditingBomItem({});
      showSnackbar('BOM項目を保存しました');
    });
  };

  const handleDeleteComponent = (id: string) => {
    dispatch(deleteComponent(id)).then(() => {
      showSnackbar('部品を削除しました');
    });
  };

  const handleDeleteCategory = (id: string) => {
    dispatch(deleteCategory(id)).then(() => {
      showSnackbar('カテゴリを削除しました');
    });
  };

  const handleDeleteBOMItem = (componentId: string, bomItemId: string) => {
    dispatch(deleteBOMItem({ componentId, bomItemId })).then(() => {
      showSnackbar('BOM項目を削除しました');
    });
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : '未分類';
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  // プロジェクトが選択されていない場合でもデフォルトデータを表示
  useEffect(() => {
    if (!currentProject?.id) {
      // プロジェクトが選択されていない場合はデフォルトデータを取得
      dispatch(fetchComponents());
    }
  }, [currentProject?.id, dispatch]);

  // エラーがある場合は表示
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => {
            if (currentProject?.id) {
              dispatch(fetchComponents(currentProject.id));
            } else {
              dispatch(fetchComponents());
            }
          }}
        >
          再試行
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">
            部品編集
          </Typography>
          {currentProject?.id && (
            <Chip 
              label={`プロジェクト: ${currentProject.name}`} 
              color="primary" 
              variant="outlined"
            />
          )}
        </Box>

                 {/* プロジェクト選択メッセージ */}
         {!currentProject?.id && (
           <Alert severity="warning" sx={{ mb: 2 }}>
             <Typography variant="body1" sx={{ mb: 1 }}>
               <strong>プロジェクトが選択されていません</strong>
             </Typography>
             <Typography variant="body2" sx={{ mb: 1 }}>
               部品の追加・編集を行うには、左サイドバーでプロジェクトを選択してください。
             </Typography>
             <Typography variant="body2" color="textSecondary">
               現在はデフォルトの部品データが表示されています。
             </Typography>
           </Alert>
         )}

         {/* タブナビゲーション */}
         <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
           <Tab icon={<InventoryIcon />} label="部品一覧" />
           <Tab icon={<CategoryIcon />} label="カテゴリ管理" />
           <Tab icon={<ReceiptIcon />} label="BOM構成" />
         </Tabs>

                 {/* 部品一覧タブ */}
         {activeTab === 0 && (
           <Box>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
               <Typography variant="h6">部品一覧</Typography>
                               <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingComponent({
                      id: undefined, // 新規作成のためIDを明示的にundefinedに
                      name: '',
                      code: '',
                      type: 'component',
                      version: '1.0',
                      description: '',
                      unitCost: 0,
                      leadTime: 7,
                      supplier: '',
                      storageConditions: '常温',
                      isDefective: false,
                      qualityGrade: 'standard',
                      category: '',
                      unit: '個',
                      specifications: {},
                      bomItems: [],
                      transportLotSize: 1
                    });
                    setComponentDialogOpen(true);
                  }}
                  disabled={!currentProject?.id}
                  title={!currentProject?.id ? 'プロジェクトを選択してください' : ''}
                >
                  部品追加
                </Button>
             </Box>

             {loading ? (
               <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                 <CircularProgress />
               </Box>
             ) : (

             <TableContainer component={Paper}>
               <Table>
                 <TableHead>
                   <TableRow>
                     <TableCell>部品名</TableCell>
                     <TableCell>コード</TableCell>
                     <TableCell>カテゴリ</TableCell>
                                           <TableCell>単価</TableCell>
                      <TableCell>リードタイム</TableCell>
                     <TableCell>単位</TableCell>
                     <TableCell>搬送ロットサイズ</TableCell>
                     <TableCell>サプライヤー</TableCell>
                     <TableCell>説明</TableCell>
                     <TableCell>操作</TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {components.map((component) => (
                     <TableRow key={component.id} hover>
                       <TableCell>
                         <Typography variant="body1" fontWeight="medium">
                           {component.name}
                         </Typography>
                       </TableCell>
                       <TableCell>
                         <Chip label={component.code} size="small" color="primary" variant="outlined" />
                       </TableCell>
                       <TableCell>
                         <Chip 
                           label={getCategoryName(component.category)} 
                           size="small" 
                           color="secondary" 
                           variant="outlined" 
                         />
                       </TableCell>
                                               <TableCell>
                          <Typography variant="body2">
                            ¥{component.unitCost.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {component.leadTime}日
                          </Typography>
                        </TableCell>
                       <TableCell>
                         <Typography variant="body2">
                           {component.unit}
                         </Typography>
                       </TableCell>
                       <TableCell>
                         <Typography variant="body2">
                           {component.transportLotSize || 1}
                         </Typography>
                       </TableCell>
                       <TableCell>
                         <Typography variant="body2" color="textSecondary">
                           {component.supplier}
                         </Typography>
                       </TableCell>
                       <TableCell>
                         <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 200 }}>
                           {component.description}
                         </Typography>
                       </TableCell>
                       <TableCell>
                         <Box sx={{ display: 'flex', gap: 1 }}>
                           <IconButton
                             size="small"
                             color="primary"
                             onClick={() => {
                               setEditingComponent({
                                 ...component,
                                 // 編集時は既存のデータをコピー
                               });
                               setComponentDialogOpen(true);
                             }}
                           >
                             <EditIcon />
                           </IconButton>
                           <IconButton
                             size="small"
                             color="secondary"
                             onClick={() => {
                               setSelectedComponent(component);
                               setBomDialogOpen(true);
                             }}
                           >
                             <ReceiptIcon />
                           </IconButton>
                           <IconButton
                             size="small"
                             color="error"
                             onClick={() => handleDeleteComponent(component.id)}
                           >
                             <DeleteIcon />
                           </IconButton>
                         </Box>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </TableContainer>
             )}
           </Box>
         )}

        {/* カテゴリ管理タブ */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">カテゴリ管理</Typography>
                             <Button
                 variant="contained"
                 startIcon={<AddIcon />}
                 onClick={() => {
                   setEditingCategory({});
                   setCategoryDialogOpen(true);
                 }}
                 disabled={!currentProject?.id}
               >
                 カテゴリ追加
               </Button>
            </Box>

            <Grid container spacing={2}>
              {categories.map((category) => (
                <Grid item xs={12} sm={6} md={4} key={category.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {category.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {category.description}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryDialogOpen(true);
                        }}
                      >
                        編集
                      </Button>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* BOM構成タブ */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              BOM構成管理
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              部品一覧から部品を選択してBOM構成を編集してください
            </Typography>

            {components.map((component) => (
              <Accordion key={component.id} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {component.name} ({component.code})
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedComponent(component);
                        setEditingBomItem({});
                        setBomDialogOpen(true);
                      }}
                    >
                      BOM追加
                    </Button>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {component.bomItems.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>部品名</TableCell>
                            <TableCell>数量</TableCell>
                            <TableCell>単位</TableCell>
                            <TableCell>備考</TableCell>
                            <TableCell>操作</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                                                     {component.bomItems.map((bomItem) => {
                             const bomComponent = components.find(c => c.id === bomItem.childProductId);
                             return (
                               <TableRow key={bomItem.id}>
                                 <TableCell>{bomComponent?.name || '不明'}</TableCell>
                                 <TableCell>{bomItem.quantity}</TableCell>
                                 <TableCell>{bomItem.unit}</TableCell>
                                 <TableCell>{bomItem.notes || ''}</TableCell>
                                <TableCell>
                                                                     <IconButton
                                     size="small"
                                     onClick={() => {
                                       setSelectedComponent(component);
                                       setEditingBomItem(bomItem);
                                       setBomDialogOpen(true);
                                     }}
                                   >
                                     <EditIcon />
                                   </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteBOMItem(component.id, bomItem.id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                      BOM項目がありません
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </Paper>

      {/* 部品編集ダイアログ */}
      <Dialog open={componentDialogOpen} onClose={() => setComponentDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingComponent.id ? '部品編集' : '部品追加'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="部品名"
                value={editingComponent.name || ''}
                onChange={(e) => setEditingComponent(prev => ({ ...prev, name: e.target.value }))}
                margin="normal"
              />
            </Grid>
                         <Grid item xs={12} sm={6}>
               <TextField
                 fullWidth
                 label="部品コード"
                 value={editingComponent.code || ''}
                 onChange={(e) => setEditingComponent(prev => ({ ...prev, code: e.target.value }))}
                 margin="normal"
               />
             </Grid>
             <Grid item xs={12} sm={6}>
               <FormControl fullWidth margin="normal">
                 <InputLabel>部品タイプ</InputLabel>
                                   <Select
                    value={editingComponent.type || 'component'}
                    onChange={(e) => setEditingComponent(prev => ({ 
                      ...prev, 
                      type: e.target.value as 'raw_material' | 'component' | 'sub_assembly' | 'finished_product' | 'defective_product'
                    }))}
                  >
                   <MenuItem value="raw_material">原材料</MenuItem>
                   <MenuItem value="component">部品</MenuItem>
                   <MenuItem value="sub_assembly">サブアセンブリ</MenuItem>
                   <MenuItem value="finished_product">完成品</MenuItem>
                   <MenuItem value="defective_product">不良品</MenuItem>
                 </Select>
               </FormControl>
             </Grid>
             <Grid item xs={12} sm={6}>
               <TextField
                 fullWidth
                 label="バージョン"
                 value={editingComponent.version || '1.0'}
                 onChange={(e) => setEditingComponent(prev => ({ ...prev, version: e.target.value }))}
                 margin="normal"
               />
             </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={editingComponent.category || ''}
                  onChange={(e) => setEditingComponent(prev => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
                         <Grid item xs={12} sm={6}>
               <TextField
                 fullWidth
                 label="単価"
                 type="number"
                 value={editingComponent.unitCost || ''}
                 onChange={(e) => setEditingComponent(prev => ({ ...prev, unitCost: Number(e.target.value) }))}
                 margin="normal"
               />
             </Grid>
             <Grid item xs={12} sm={6}>
               <TextField
                 fullWidth
                 label="リードタイム（日）"
                 type="number"
                 value={editingComponent.leadTime || ''}
                 onChange={(e) => setEditingComponent(prev => ({ ...prev, leadTime: Number(e.target.value) }))}
                 margin="normal"
               />
             </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="単位"
                value={editingComponent.unit || ''}
                onChange={(e) => setEditingComponent(prev => ({ ...prev, unit: e.target.value }))}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="搬送ロットサイズ"
                type="number"
                value={editingComponent.transportLotSize || ''}
                onChange={(e) => setEditingComponent(prev => ({ ...prev, transportLotSize: Number(e.target.value) }))}
                margin="normal"
                inputProps={{ min: 1 }}
                helperText="部品の搬送時の標準ロットサイズ"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="サプライヤー"
                value={editingComponent.supplier || ''}
                onChange={(e) => setEditingComponent(prev => ({ ...prev, supplier: e.target.value }))}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="説明"
                multiline
                rows={3}
                value={editingComponent.description || ''}
                onChange={(e) => setEditingComponent(prev => ({ ...prev, description: e.target.value }))}
                margin="normal"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComponentDialogOpen(false)}>キャンセル</Button>
          <Button 
            onClick={handleSaveComponent} 
            variant="contained"
            disabled={!editingComponent.name || !editingComponent.code}
            title={!editingComponent.name || !editingComponent.code ? '部品名と部品コードは必須です' : ''}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* カテゴリ編集ダイアログ */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategory.id ? 'カテゴリ編集' : 'カテゴリ追加'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="カテゴリ名"
            value={editingCategory.name || ''}
            onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="説明"
            multiline
            rows={3}
            value={editingCategory.description || ''}
            onChange={(e) => setEditingCategory(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveCategory} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* BOM項目編集ダイアログ */}
      <Dialog open={bomDialogOpen} onClose={() => setBomDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBomItem.id ? 'BOM項目編集' : 'BOM項目追加'}
        </DialogTitle>
        <DialogContent>
                     <FormControl fullWidth margin="normal">
             <InputLabel>部品</InputLabel>
             <Select
               value={editingBomItem.childProductId || ''}
                              onChange={(e) => setEditingBomItem(prev => ({ ...prev, childProductId: e.target.value }))}
             >
               {components.map((component) => (
                 <MenuItem key={component.id} value={component.id}>
                   {component.name} ({component.code})
                 </MenuItem>
               ))}
             </Select>
           </FormControl>
          <TextField
            fullWidth
            label="数量"
            type="number"
            value={editingBomItem.quantity || ''}
                         onChange={(e) => setEditingBomItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="単位"
            value={editingBomItem.unit || ''}
                         onChange={(e) => setEditingBomItem(prev => ({ ...prev, unit: e.target.value }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="備考"
            multiline
            rows={2}
            value={editingBomItem.notes || ''}
                         onChange={(e) => setEditingBomItem(prev => ({ ...prev, notes: e.target.value }))}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBomDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveBOMItem} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ComponentEditorPage; 