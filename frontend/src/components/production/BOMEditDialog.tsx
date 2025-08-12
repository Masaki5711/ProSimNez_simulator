import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Product, BOMItem } from '../../types/productionTypes';

interface BOMEditDialogProps {
  open: boolean;
  product: Product | null;
  bomItems: BOMItem[];
  products: Product[];
  onClose: () => void;
  onSave: (productId: string, bomItems: BOMItem[]) => void;
}

const BOMEditDialog: React.FC<BOMEditDialogProps> = ({
  open,
  product,
  bomItems,
  products,
  onClose,
  onSave,
}) => {
  const [editingBOM, setEditingBOM] = useState<BOMItem[]>([]);
  const [newBOMItem, setNewBOMItem] = useState<Partial<BOMItem>>({
    quantity: 1,
    unit: '個',
    isOptional: false,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 現在の製品のBOM項目を取得
  useEffect(() => {
    if (product) {
      const productBOMItems = bomItems.filter(item => item.parentProductId === product.id);
      setEditingBOM([...productBOMItems]);
    }
  }, [product, bomItems]);

  // バリデーション
  const validateBOM = (bomList: BOMItem[]): string[] => {
    const errors: string[] = [];
    
    // 循環参照チェック
    const checkCircularReference = (productId: string, visited = new Set<string>()): boolean => {
      if (visited.has(productId)) return true;
      
      const newVisited = new Set(visited);
      newVisited.add(productId);
      
      const children = bomList.filter(item => item.parentProductId === productId);
      return children.some(child => checkCircularReference(child.childProductId, newVisited));
    };

    if (product && checkCircularReference(product.id)) {
      errors.push('循環参照が検出されました。製品が自身の部品として設定されています。');
    }

    // 重複チェック
    const duplicates = bomList.filter((item, index) => 
      bomList.findIndex(other => 
        other.childProductId === item.childProductId && 
        other.parentProductId === item.parentProductId
      ) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push('重複する部品が設定されています。');
    }

    // 必須フィールドチェック
    const missingFields = bomList.filter(item => 
      !item.childProductId || !item.quantity || !item.unit
    );
    
    if (missingFields.length > 0) {
      errors.push('必須フィールドが入力されていない項目があります。');
    }

    return errors;
  };

  // BOM項目追加
  const handleAddBOMItem = () => {
    if (!newBOMItem.childProductId || !product) return;

    const bomItem: BOMItem = {
      id: `bom_${Date.now()}`,
      parentProductId: product.id,
      childProductId: newBOMItem.childProductId!,
      quantity: newBOMItem.quantity || 1,
      unit: newBOMItem.unit || '個',
      isOptional: newBOMItem.isOptional || false,
      effectiveDate: new Date().toISOString(),
      position: newBOMItem.position,
      notes: newBOMItem.notes,
    };

    setEditingBOM([...editingBOM, bomItem]);
    setNewBOMItem({
      quantity: 1,
      unit: '個',
      isOptional: false,
    });
  };

  // BOM項目編集
  const handleEditBOMItem = (index: number) => {
    setEditingIndex(index);
    setNewBOMItem({ ...editingBOM[index] });
  };

  // BOM項目更新
  const handleUpdateBOMItem = () => {
    if (editingIndex === null) return;

    const updatedBOM = [...editingBOM];
    updatedBOM[editingIndex] = {
      ...updatedBOM[editingIndex],
      ...newBOMItem,
    } as BOMItem;

    setEditingBOM(updatedBOM);
    setEditingIndex(null);
    setNewBOMItem({
      quantity: 1,
      unit: '個',
      isOptional: false,
    });
  };

  // BOM項目削除
  const handleDeleteBOMItem = (index: number) => {
    const updatedBOM = editingBOM.filter((_, i) => i !== index);
    setEditingBOM(updatedBOM);
  };

  // 保存
  const handleSave = () => {
    const errors = validateBOM(editingBOM);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (product) {
      onSave(product.id, editingBOM);
      onClose();
    }
  };

  // 利用可能な部品（自分自身を除く）
  const availableProducts = products.filter(p => p.id !== product?.id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            BOM編集: {product?.name}
          </Typography>
          <Chip 
            label={product?.type} 
            color={product?.type === 'finished_product' ? 'primary' : 'default'}
            size="small"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* バリデーションエラー表示 */}
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              以下のエラーを修正してください:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* BOM項目追加フォーム */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {editingIndex !== null ? 'BOM項目編集' : 'BOM項目追加'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 2, mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>部品・材料</InputLabel>
                <Select
                  value={newBOMItem.childProductId || ''}
                  onChange={(e) => setNewBOMItem({ ...newBOMItem, childProductId: e.target.value })}
                >
                  {availableProducts.map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography>{product.name}</Typography>
                        <Chip label={product.type} size="small" />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="使用数量"
                type="number"
                value={newBOMItem.quantity || ''}
                onChange={(e) => setNewBOMItem({ ...newBOMItem, quantity: Number(e.target.value) })}
                inputProps={{ min: 0, step: 0.1 }}
              />

              <TextField
                label="単位"
                value={newBOMItem.unit || ''}
                onChange={(e) => setNewBOMItem({ ...newBOMItem, unit: e.target.value })}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={newBOMItem.isOptional || false}
                    onChange={(e) => setNewBOMItem({ ...newBOMItem, isOptional: e.target.checked })}
                  />
                }
                label="オプション"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2, mb: 2 }}>
              <TextField
                label="取り付け位置"
                value={newBOMItem.position || ''}
                onChange={(e) => setNewBOMItem({ ...newBOMItem, position: e.target.value })}
              />

              <TextField
                label="備考"
                value={newBOMItem.notes || ''}
                onChange={(e) => setNewBOMItem({ ...newBOMItem, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {editingIndex !== null ? (
                <>
                  <Button
                    startIcon={<SaveIcon />}
                    variant="contained"
                    onClick={handleUpdateBOMItem}
                    disabled={!newBOMItem.childProductId}
                  >
                    更新
                  </Button>
                  <Button
                    startIcon={<CancelIcon />}
                    onClick={() => {
                      setEditingIndex(null);
                      setNewBOMItem({
                        quantity: 1,
                        unit: '個',
                        isOptional: false,
                      });
                    }}
                  >
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button
                  startIcon={<AddIcon />}
                  variant="contained"
                  onClick={handleAddBOMItem}
                  disabled={!newBOMItem.childProductId}
                >
                  追加
                </Button>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 現在のBOM一覧 */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            現在のBOM構成 ({editingBOM.length}項目)
          </Typography>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>部品・材料名</TableCell>
                  <TableCell>タイプ</TableCell>
                  <TableCell align="right">数量</TableCell>
                  <TableCell>単位</TableCell>
                  <TableCell>取り付け位置</TableCell>
                  <TableCell>オプション</TableCell>
                  <TableCell>備考</TableCell>
                  <TableCell align="center">アクション</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editingBOM.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="textSecondary">
                        BOM項目がありません
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  editingBOM.map((item, index) => {
                    const childProduct = products.find(p => p.id === item.childProductId);
                    return (
                      <TableRow key={item.id || index}>
                        <TableCell>
                          <Typography variant="body2">
                            {childProduct?.name || '不明な製品'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {childProduct?.code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={childProduct?.type || 'unknown'} 
                            size="small"
                            color={childProduct?.type === 'raw_material' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.position || '-'}</TableCell>
                        <TableCell>
                          {item.isOptional && (
                            <Chip label="オプション" size="small" color="warning" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {item.notes || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEditBOMItem(index)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteBOMItem(index)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* BOM統計情報 */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            BOM統計
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="textSecondary">総部品数</Typography>
              <Typography variant="h6">{editingBOM.length}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">原材料</Typography>
              <Typography variant="h6">
                {editingBOM.filter(item => {
                  const product = products.find(p => p.id === item.childProductId);
                  return product?.type === 'raw_material';
                }).length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">購入部品</Typography>
              <Typography variant="h6">
                {editingBOM.filter(item => {
                  const product = products.find(p => p.id === item.childProductId);
                  return product?.type === 'component';
                }).length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary">オプション部品</Typography>
              <Typography variant="h6">
                {editingBOM.filter(item => item.isOptional).length}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={validationErrors.length > 0}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BOMEditDialog;