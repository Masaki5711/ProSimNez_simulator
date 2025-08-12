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
  const [editingBomItem, setEditingBomItem] = useState<Partial<ComponentBOMItem>>({
    childProductId: '',
    quantity: 1,
    unit: '個',
    isOptional: false,
    position: '1',
    notes: '',
    alternativeProducts: [],
  });
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // プロジェクトが変更されたときに部品データを再取得
  useEffect(() => {
    if (currentProject?.id) {
      console.log('プロジェクト変更により部品データを再取得:', currentProject.id);
      dispatch(fetchComponents(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  // 部品データが更新されたときに選択中の部品も更新
  useEffect(() => {
    if (selectedComponent?.id && components.length > 0) {
      const updatedComponent = components.find(c => c.id === selectedComponent.id);
      if (updatedComponent) {
        // 実際に変更があった場合のみ更新（無限ループを防ぐ）
        const hasChanges = 
          updatedComponent.name !== selectedComponent.name ||
          updatedComponent.code !== selectedComponent.code ||
          updatedComponent.type !== selectedComponent.type ||
          updatedComponent.unit !== selectedComponent.unit ||
          (updatedComponent.bomItems?.length || 0) !== (selectedComponent.bomItems?.length || 0);
        
        console.log('選択中部品の更新チェック:', {
          selectedComponentId: selectedComponent.id,
          hasChanges,
          currentBomItemsCount: selectedComponent.bomItems?.length || 0,
          updatedBomItemsCount: updatedComponent.bomItems?.length || 0,
          currentBomItems: selectedComponent.bomItems,
          updatedBomItems: updatedComponent.bomItems
        });
        
        if (hasChanges) {
          console.log('選択中部品に変更を検出、更新します:', {
            id: updatedComponent.id,
            name: updatedComponent.name,
            bomItemsCount: updatedComponent.bomItems?.length || 0
          });
          
          setSelectedComponent(prev => {
            const newState = {
              ...prev,
              ...updatedComponent,
              bomItems: updatedComponent.bomItems || []
            };
            console.log('選択中部品の状態更新:', {
              prev: prev,
              new: newState
            });
            return newState;
          });
        }
      }
    }
  }, [components, selectedComponent?.id]); // selectedComponent.idのみを依存関係に含める

  // 部品データの変更を監視（デバッグ用）
  useEffect(() => {
    if (components.length > 0) {
      console.log('部品データが更新されました:', {
        componentsCount: components.length,
        selectedComponentId: selectedComponent?.id,
        selectedComponentBomItemsCount: selectedComponent?.bomItems?.length || 0
      });
    }
  }, [components.length]); // components.lengthのみを依存関係に含める

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
    
    // 必須フィールドのバリデーション
    if (!editingBomItem.childProductId || !editingBomItem.quantity) {
      showSnackbar('部品と数量は必須です');
      return;
    }
    
    // 自分自身をBOM項目として追加しようとしている場合のチェック
    if (editingBomItem.childProductId === selectedComponent.id) {
      showSnackbar('自分自身をBOM項目として追加することはできません');
      return;
    }
    
    // 既存のBOM項目との重複チェック
    const existingBOMItem = selectedComponent.bomItems.find(
      item => item.childProductId === editingBomItem.childProductId
    );
    
    if (existingBOMItem && !editingBomItem.id) {
      showSnackbar('この部品は既にBOM項目として登録されています');
      return;
    }
    
    // BOM項目のデータを準備（ISO文字列として保存）
    const bomItemData: ComponentBOMItem = {
      id: editingBomItem.id || `bom_${Date.now()}`,
      parentProductId: selectedComponent.id,
      childProductId: editingBomItem.childProductId!,
      quantity: editingBomItem.quantity!,
      unit: editingBomItem.unit!,
      effectiveDate: new Date().toISOString(), // ISO文字列として保存
      position: editingBomItem.position?.toString() || '1',
      isOptional: editingBomItem.isOptional || false,
      expiryDate: editingBomItem.expiryDate || undefined,
      alternativeProducts: editingBomItem.alternativeProducts || [],
      notes: editingBomItem.notes || '',
    };
    
    console.log('BOM項目保存開始:', { 
      selectedComponent: selectedComponent.id, 
      bomItemData, 
      projectId: currentProject.id 
    });
    
    // ダイアログを閉じてフォームをリセット
    setBomDialogOpen(false);
    setEditingBomItem({
      childProductId: '',
      quantity: 1,
      unit: '個',
      isOptional: false,
      position: '1',
      notes: '',
      alternativeProducts: [],
    });
    
    dispatch(saveBOMItem({ 
      componentId: selectedComponent.id, 
      bomItem: bomItemData,
      projectId: currentProject.id 
    })).then((result) => {
      console.log('BOM項目保存結果:', result);
      console.log('保存されたBOM項目の詳細:', result.payload);
      console.log('現在の選択中部品の状態:', selectedComponent);
      console.log('現在の全部品データ:', components);
      
      // 保存成功後の処理
      if (result.payload) {
        // 成功メッセージを表示
        showSnackbar(editingBomItem.id ? 'BOM項目を更新しました' : 'BOM項目を追加しました');
        
        // 部品データを再取得して最新の状態を保つ
        if (currentProject?.id) {
          // 少し遅延を入れてReduxの状態が安定してから再取得
          setTimeout(() => {
            console.log('部品データ再取得開始');
            dispatch(fetchComponents(currentProject.id)).then((fetchResult) => {
              console.log('部品データ再取得完了:', fetchResult);
              console.log('再取得後の部品データ:', fetchResult.payload);
            });
          }, 100);
        }
      }
    }).catch((error) => {
      console.error('BOM項目保存エラー:', error);
      showSnackbar('BOM項目の保存に失敗しました');
      
      // エラー時はダイアログを再開
      setBomDialogOpen(true);
      setEditingBomItem({
        ...editingBomItem, // 既存の編集データを保持
      });
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
    if (!currentProject?.id) {
      showSnackbar('プロジェクトが選択されていません');
      return;
    }
    
    // 削除確認
    const bomItem = components.find(c => c.id === componentId)?.bomItems.find(b => b.id === bomItemId);
    if (!bomItem) {
      showSnackbar('削除対象のBOM項目が見つかりません');
      return;
    }
    
    const childComponent = components.find(c => c.id === bomItem.childProductId);
    const component = components.find(c => c.id === componentId);
    
    if (window.confirm(
      `以下のBOM項目を削除しますか？\n\n` +
      `対象部品: ${component?.name} (${component?.code})\n` +
      `削除項目: ${childComponent?.name || '不明'} (${childComponent?.code || 'N/A'}) × ${bomItem.quantity} ${bomItem.unit}\n\n` +
      `この操作は取り消せません。`
    )) {
      dispatch(deleteBOMItem({ componentId, bomItemId })).then(() => {
        showSnackbar('BOM項目を削除しました');
        
        // 部品データを再取得して最新の状態を保つ
        if (currentProject?.id) {
          // 少し遅延を入れてReduxの状態が安定してから再取得
          setTimeout(() => {
            console.log('削除後の部品データ再取得開始');
            dispatch(fetchComponents(currentProject.id)).then((fetchResult) => {
              console.log('削除後の部品データ再取得完了:', fetchResult);
              console.log('削除後の部品データ:', fetchResult.payload);
            });
          }, 100);
        }
      }).catch((error) => {
        console.error('BOM項目削除エラー:', error);
        showSnackbar('BOM項目の削除に失敗しました');
      });
    }
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
              部品を選択してBOM構成を作成・編集してください
            </Typography>

            {components.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                部品が登録されていません。まず「部品一覧」タブで部品を追加してください。
              </Alert>
            ) : (
              <Box>
                {/* 部品選択セクション */}
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    対象部品の選択
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    構成を作成・編集したい部品を選択してください
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>部品を選択</InputLabel>
                    <Select
                      value={selectedComponent?.id || ''}
                      onChange={(e) => {
                        const component = components.find(c => c.id === e.target.value);
                        setSelectedComponent(component || null);
                      }}
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        <em>部品を選択してください</em>
                      </MenuItem>
                      {components.map((component) => (
                        <MenuItem key={component.id} value={component.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InventoryIcon fontSize="small" />
                            <Typography variant="body2">
                              {component.name} ({component.code})
                            </Typography>
                            <Chip label={component.type} size="small" color="secondary" />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedComponent && (
                    <Box sx={{ p: 2, backgroundColor: 'primary.light', borderRadius: 1, color: 'white' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        📋 選択された部品: {selectedComponent.name} ({selectedComponent.code})
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2">
                            <strong>タイプ:</strong> {selectedComponent.type}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2">
                            <strong>単価:</strong> ¥{selectedComponent.unitCost.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2">
                            <strong>単位:</strong> {selectedComponent.unit}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2">
                            <strong>BOM項目数:</strong> {selectedComponent.bomItems.length}項目
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Paper>

                {/* BOM構成管理セクション */}
                {selectedComponent && (
                  <Paper sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        BOM構成: {selectedComponent.name}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setEditingBomItem({
                            childProductId: '',
                            quantity: 1,
                            unit: selectedComponent.unit || '個',
                            isOptional: false,
                            position: (selectedComponent.bomItems.length + 1).toString(),
                            notes: '',
                            alternativeProducts: [],
                          });
                          setBomDialogOpen(true);
                        }}
                        disabled={!currentProject?.id}
                        title={!currentProject?.id ? 'プロジェクトを選択してください' : ''}
                      >
                        BOM項目追加
                      </Button>
                    </Box>

                    {/* デバッグ情報 */}
                    <Box sx={{ mb: 2, p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        デバッグ情報: BOM項目数: {selectedComponent.bomItems?.length || 0} | 
                        部品ID: {selectedComponent.id} | 
                        最終更新: {new Date().toLocaleTimeString()} | 
                        全部品数: {components.length}
                      </Typography>
                      {selectedComponent.bomItems && selectedComponent.bomItems.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            登録済みBOM項目: {selectedComponent.bomItems.map(item => 
                              `${item.childProductId}(${item.quantity}${item.unit})`
                            ).join(', ')}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          選択中部品の詳細: {JSON.stringify({
                            id: selectedComponent.id,
                            name: selectedComponent.name,
                            bomItemsCount: selectedComponent.bomItems?.length || 0,
                            bomItems: selectedComponent.bomItems
                          }, null, 2)}
                        </Typography>
                      </Box>
                    </Box>

                    {selectedComponent.bomItems && selectedComponent.bomItems.length > 0 ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>部品名</TableCell>
                              <TableCell>コード</TableCell>
                              <TableCell>タイプ</TableCell>
                              <TableCell align="right">数量</TableCell>
                              <TableCell>単位</TableCell>
                              <TableCell>位置</TableCell>
                              <TableCell>オプション</TableCell>
                              <TableCell>備考</TableCell>
                              <TableCell align="center">操作</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedComponent.bomItems.map((bomItem) => {
                              const bomComponent = components.find(c => c.id === bomItem.childProductId);
                              console.log('BOM項目表示:', { bomItem, bomComponent });
                              return (
                                <TableRow key={`${selectedComponent.id}-${bomItem.id}`} hover>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      <InventoryIcon sx={{ mr: 1, fontSize: 'small', color: 'action.active' }} />
                                      <Typography variant="body2" fontWeight="medium">
                                        {bomComponent?.name || `不明 (ID: ${bomItem.childProductId || 'undefined'})`}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={bomComponent?.code || `N/A (ID: ${bomItem.childProductId || 'undefined'})`} 
                                      size="small" 
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={bomComponent?.type || 'N/A'} 
                                      size="small" 
                                      color="secondary"
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="medium">
                                      {bomItem.quantity || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{bomItem.unit || '-'}</TableCell>
                                  <TableCell>{bomItem.position || '-'}</TableCell>
                                  <TableCell>
                                    {bomItem.isOptional ? (
                                      <Chip label="オプション" size="small" color="warning" />
                                    ) : (
                                      <Chip label="必須" size="small" color="success" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 150 }}>
                                      {bomItem.notes || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => {
                                          setEditingBomItem({
                                            ...bomItem,
                                            // 既存データをコピー
                                          });
                                          setBomDialogOpen(true);
                                        }}
                                        title="編集"
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteBOMItem(selectedComponent.id, bomItem.id)}
                                        title="削除"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 3 }}>
                        <InventoryIcon sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          BOM項目がありません
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          この部品の構成部品・材料を追加してください
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                )}

                {/* 部品が選択されていない場合の案内 */}
                {!selectedComponent && (
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <InventoryIcon sx={{ fontSize: 60, color: 'action.disabled', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                      部品を選択してください
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      上記の部品選択から、BOM構成を作成・編集したい部品を選択してください
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}
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
      <Dialog 
        open={bomDialogOpen} 
        onClose={() => {
          setBomDialogOpen(false);
          setEditingBomItem({
            childProductId: '',
            quantity: 1,
            unit: '個',
            isOptional: false,
            position: '1',
            notes: '',
            alternativeProducts: [],
          });
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {editingBomItem.id ? 'BOM項目編集' : 'BOM項目追加'}
            </Typography>
          </Box>
          {selectedComponent && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              対象部品: {selectedComponent.name} ({selectedComponent.code})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" required>
                <InputLabel>部品・材料</InputLabel>
                <Select
                  value={editingBomItem.childProductId || ''}
                  onChange={(e) => setEditingBomItem(prev => ({ ...prev, childProductId: e.target.value }))}
                  error={!editingBomItem.childProductId}
                >
                  {components
                    .filter(c => c.id !== selectedComponent?.id) // 自分自身を除外
                    .map((component) => (
                      <MenuItem key={component.id} value={component.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InventoryIcon fontSize="small" />
                          <Typography>{component.name}</Typography>
                          <Chip label={component.code} size="small" variant="outlined" />
                          <Chip label={component.type} size="small" color="secondary" />
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
                {!editingBomItem.childProductId && (
                  <Typography variant="caption" color="error">
                    部品・材料を選択してください
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="数量"
                type="number"
                value={editingBomItem.quantity || ''}
                onChange={(e) => setEditingBomItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                margin="normal"
                required
                inputProps={{ min: 0.1, step: 0.1 }}
                error={!editingBomItem.quantity}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="単位"
                value={editingBomItem.unit || ''}
                onChange={(e) => setEditingBomItem(prev => ({ ...prev, unit: e.target.value }))}
                margin="normal"
                required
                error={!editingBomItem.unit}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="取り付け位置"
                type="number"
                value={editingBomItem.position || ''}
                onChange={(e) => setEditingBomItem(prev => ({ ...prev, position: e.target.value }))}
                margin="normal"
                inputProps={{ min: 1 }}
                helperText="部品の取り付け順序"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>オプション設定</InputLabel>
                <Select
                  value={editingBomItem.isOptional || false}
                  onChange={(e) => setEditingBomItem(prev => ({ ...prev, isOptional: e.target.value === 'true' }))}
                >
                  <MenuItem value="false">必須部品</MenuItem>
                  <MenuItem value="true">オプション部品</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="備考・特記事項"
                multiline
                rows={3}
                value={editingBomItem.notes || ''}
                onChange={(e) => setEditingBomItem(prev => ({ ...prev, notes: e.target.value }))}
                margin="normal"
                placeholder="部品の取り付け方法、注意事項、品質要求などを記入してください"
              />
            </Grid>
          </Grid>
          
          {/* 選択された部品の情報表示 */}
          {editingBomItem.childProductId && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'info.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="info.dark" gutterBottom>
                📋 選択された部品情報
              </Typography>
              {(() => {
                const selectedBomComponent = components.find(c => c.id === editingBomItem.childProductId);
                if (selectedBomComponent) {
                  return (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="info.dark">
                          <strong>部品名:</strong> {selectedBomComponent.name}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="info.dark">
                          <strong>コード:</strong> {selectedBomComponent.code}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="info.dark">
                          <strong>タイプ:</strong> {selectedBomComponent.type}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="info.dark">
                          <strong>単価:</strong> ¥{selectedBomComponent.unitCost.toLocaleString()}
                        </Typography>
                      </Grid>
                    </Grid>
                  );
                }
                return null;
              })()}
            </Box>
          )}

          {/* 既に登録済みのBOM項目一覧 */}
          {selectedComponent && selectedComponent.bomItems.length > 0 && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                ⚠️ 既に登録済みのBOM項目
              </Typography>
              <Typography variant="body2" color="warning.dark" sx={{ mb: 2 }}>
                以下の部品は既にBOM項目として登録されています。重複登録はできません。
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedComponent.bomItems.map((bomItem) => {
                  const bomComponent = components.find(c => c.id === bomItem.childProductId);
                  return (
                    <Chip
                      key={`existing-${bomItem.id}`}
                      label={`${bomComponent?.name || '不明'} (${bomComponent?.code || 'N/A'}) × ${bomItem.quantity} ${bomItem.unit}`}
                      size="small"
                      color="warning"
                      variant="outlined"
                      icon={<InventoryIcon fontSize="small" />}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBomDialogOpen(false);
            setEditingBomItem({
              childProductId: '',
              quantity: 1,
              unit: '個',
              isOptional: false,
              position: '1',
              notes: '',
              alternativeProducts: [],
            });
          }}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSaveBOMItem} 
            variant="contained"
            disabled={!editingBomItem.childProductId || !editingBomItem.quantity || !editingBomItem.unit}
            startIcon={editingBomItem.id ? <EditIcon /> : <AddIcon />}
          >
            {editingBomItem.id ? '更新' : '追加'}
          </Button>
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