import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,

  Tooltip,
  Card,
  CardContent,
  CardActions,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ListAlt as ListIcon,
  Inventory as MaterialIcon,
  Settings as VariantIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { Product, BOMItem, ProductVariant, MaterialInput, ProductOutput } from '../../types/productionTypes';
import BOMEditDialog from './BOMEditDialog';

interface BOMManagerProps {
  products: Product[];
  bomItems: BOMItem[];
  variants: ProductVariant[];
  onProductAdd: (product: Product) => void;
  onProductUpdate: (product: Product) => void;
  onProductDelete: (productId: string) => void;
  onBOMUpdate: (bomItems: BOMItem[]) => void;
  onVariantUpdate: (variants: ProductVariant[]) => void;
}

const BOMManager: React.FC<BOMManagerProps> = ({
  products,
  bomItems,
  variants,
  onProductAdd,
  onProductUpdate,
  onProductDelete,
  onBOMUpdate,
  onVariantUpdate,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({});
  const [editingBomItem, setEditingBomItem] = useState<Partial<BOMItem>>({});
  const [editingVariant, setEditingVariant] = useState<Partial<ProductVariant>>({});
  const [bomEditDialogOpen, setBomEditDialogOpen] = useState(false);
  const [selectedProductForBOM, setSelectedProductForBOM] = useState<Product | null>(null);

  // 製品の階層構造を構築（循環参照チェック付き）
  const buildProductHierarchy = (productId: string, visited = new Set<string>()): any => {
    const product = products.find(p => p.id === productId);
    if (!product) return null;

    // 循環参照チェック
    if (visited.has(productId)) {
      return {
        product,
        children: [], // 循環参照の場合は子を空にする
        isCircular: true,
      };
    }

    const newVisited = new Set(visited);
    newVisited.add(productId);

    const children = bomItems
      .filter(item => item.parentProductId === productId)
      .map(item => ({
        ...item,
        child: buildProductHierarchy(item.childProductId, newVisited),
      }));

    return {
      product,
      children,
      isCircular: false,
    };
  };

  // 完成品（最上位製品）を取得
  const getFinishedProducts = () => {
    const parentIds = new Set(bomItems.map(item => item.parentProductId));
    const childIds = new Set(bomItems.map(item => item.childProductId));
    
    return products.filter(product => 
      parentIds.has(product.id) && !childIds.has(product.id)
    );
  };

  // 製品追加/編集ダイアログ
  const handleProductSave = () => {
    if (editingProduct.id) {
      onProductUpdate(editingProduct as Product);
    } else {
      const newProduct: Product = {
        id: `product_${Date.now()}`,
        ...editingProduct,
      } as Product;
      onProductAdd(newProduct);
    }
    setProductDialogOpen(false);
    setEditingProduct({});
  };

  // BOM項目追加/編集（旧機能）
  const handleLegacyBOMSave = () => {
    const newBomItem: BOMItem = {
      id: `bom_${Date.now()}`,
      effectiveDate: new Date(),
      isOptional: false,
      ...editingBomItem,
    } as BOMItem;

    const updatedBomItems = editingBomItem.id
      ? bomItems.map(item => item.id === editingBomItem.id ? newBomItem : item)
      : [...bomItems, newBomItem];

    onBOMUpdate(updatedBomItems);
    setBomDialogOpen(false);
    setEditingBomItem({});
  };

  // 製品バリエーション管理
  const handleVariantSave = () => {
    const newVariant: ProductVariant = {
      id: `variant_${Date.now()}`,
      bom: [],
      setupRequirements: [],
      demand: {
        dailyDemand: 0,
        weeklyPattern: [1, 1, 1, 1, 1, 0, 0],
        seasonality: 1,
        priority: 'medium',
        customerOrders: [],
      },
      ...editingVariant,
    } as ProductVariant;

    const updatedVariants = editingVariant.id
      ? variants.map(v => v.id === editingVariant.id ? newVariant : v)
      : [...variants, newVariant];

    onVariantUpdate(updatedVariants);
    setVariantDialogOpen(false);
    setEditingVariant({});
  };

  // BOM編集保存
  const handleBOMSave = (productId: string, newBomItems: BOMItem[]) => {
    // 既存のBOM項目を削除し、新しい項目に置き換え
    const otherBomItems = bomItems.filter(item => item.parentProductId !== productId);
    const updatedBomItems = [...otherBomItems, ...newBomItems];
    onBOMUpdate(updatedBomItems);
    setBomEditDialogOpen(false);
    setSelectedProductForBOM(null);
  };

  // BOM編集ダイアログを開く
  const openBOMEdit = (product: Product) => {
    setSelectedProductForBOM(product);
    setBomEditDialogOpen(true);
  };

  // 製品ツリー表示コンポーネント（メモ化）
  const ProductTree: React.FC<{ hierarchy: any; level: number }> = React.memo(({ hierarchy, level }) => {
    if (!hierarchy) return null;

    const indent = level * 20;

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: `${indent}px`, p: 1 }}>
          <MaterialIcon color={hierarchy.product.type === 'finished_product' ? 'primary' : 'action'} />
          <Typography variant="body2">
            {hierarchy.product.name} ({hierarchy.product.code})
          </Typography>
          <Chip
            label={hierarchy.product.type}
            size="small"
            color={hierarchy.product.type === 'finished_product' ? 'primary' : 'default'}
          />
          <IconButton
            size="small"
            onClick={() => openBOMEdit(hierarchy.product)}
            sx={{ ml: 1 }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
        {hierarchy.children?.map((child: any) => {
          const childProduct = products.find(p => p.id === child.childProductId);
          return (
            <Box key={child.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: `${indent + 40}px`, p: 1 }}>
                <MaterialIcon color="action" />
                <Typography variant="body2">
                  {childProduct?.name} × {child.quantity} {child.unit}
                </Typography>
                {child.isOptional && <Chip label="オプション" size="small" color="warning" />}
              </Box>
              {child.child && <ProductTree hierarchy={child.child} level={level + 1} />}
            </Box>
          );
        })}
      </Box>
    );
  });

  // React DevToolsでの表示名を設定
  ProductTree.displayName = 'ProductTree';

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          BOM・製品管理
        </Typography>

        {/* タブナビゲーション */}
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab icon={<MaterialIcon />} label="BOM構造" />
          <Tab icon={<ListIcon />} label="製品一覧" />
          <Tab icon={<VariantIcon />} label="製品バリエーション" />
          <Tab icon={<MaterialIcon />} label="材料・部品" />
        </Tabs>

        {/* BOM構造表示タブ */}
        {activeTab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">製品構造ツリー</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingBomItem({});
                  setBomDialogOpen(true);
                }}
              >
                BOM項目追加
              </Button>
            </Box>

            <Paper sx={{ p: 2, minHeight: 300 }}>
              {getFinishedProducts().length > 0 ? (
                getFinishedProducts().map(product => (
                  <ProductTree
                    key={product.id}
                    hierarchy={buildProductHierarchy(product.id)}
                    level={0}
                  />
                ))
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>
                  まだ製品が登録されていません。「製品追加」ボタンから製品を登録してください。
                </Typography>
              )}
            </Paper>
          </Box>
        )}

        {/* 製品一覧タブ */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">製品一覧</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingProduct({});
                  setProductDialogOpen(true);
                }}
              >
                製品追加
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>製品名</TableCell>
                    <TableCell>製品コード</TableCell>
                    <TableCell>タイプ</TableCell>
                    <TableCell>単価</TableCell>
                    <TableCell>リードタイム</TableCell>
                    <TableCell>アクション</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.code}</TableCell>
                      <TableCell>
                        <Chip label={product.type} size="small" />
                      </TableCell>
                      <TableCell>¥{product.unitCost.toLocaleString()}</TableCell>
                      <TableCell>{product.leadTime}日</TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => {
                            setEditingProduct(product);
                            setProductDialogOpen(true);
                          }}
                          title="製品編集"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => openBOMEdit(product)}
                          color="primary"
                          title="BOM編集"
                        >
                          <MaterialIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => onProductDelete(product.id)}
                          color="error"
                          title="削除"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* 製品バリエーションタブ */}
        {activeTab === 2 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">製品バリエーション</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingVariant({});
                  setVariantDialogOpen(true);
                }}
              >
                バリエーション追加
              </Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
              {variants.map((variant) => (
                <Card key={variant.id}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {variant.variantName}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      コード: {variant.variantCode}
                    </Typography>
                    <Typography variant="body2">
                      ベース製品: {products.find(p => p.id === variant.baseProductId)?.name}
                    </Typography>
                    <Typography variant="body2">
                      日次需要: {variant.demand.dailyDemand}個
                    </Typography>
                    <Typography variant="body2">
                      優先度: {variant.demand.priority}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => {
                        setEditingVariant(variant);
                        setVariantDialogOpen(true);
                      }}
                    >
                      編集
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ScheduleIcon />}
                      onClick={() => {
                        // スケジュール機能（今後実装）
                      }}
                    >
                      スケジュール
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* 材料・部品タブ */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              材料・部品一覧
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>部品名</TableCell>
                    <TableCell>部品コード</TableCell>
                    <TableCell>タイプ</TableCell>
                    <TableCell>サプライヤー</TableCell>
                    <TableCell>在庫状況</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products
                    .filter(p => p.type === 'raw_material' || p.type === 'component')
                    .map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.code}</TableCell>
                      <TableCell>
                        <Chip label={product.type} size="small" />
                      </TableCell>
                      <TableCell>{product.supplier || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip label="在庫あり" color="success" size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* 製品追加/編集ダイアログ */}
      <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProduct.id ? '製品編集' : '製品追加'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="製品名"
              value={editingProduct.name || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="製品コード"
              value={editingProduct.code || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>製品タイプ</InputLabel>
              <Select
                value={editingProduct.type || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, type: e.target.value as any })}
              >
                <MenuItem value="raw_material">原材料</MenuItem>
                <MenuItem value="component">部品</MenuItem>
                <MenuItem value="sub_assembly">サブアッセンブリ</MenuItem>
                <MenuItem value="finished_product">完成品</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="単価"
              type="number"
              value={editingProduct.unitCost || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, unitCost: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="リードタイム（日）"
              type="number"
              value={editingProduct.leadTime || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, leadTime: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="サプライヤー"
              value={editingProduct.supplier || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, supplier: e.target.value })}
              fullWidth
            />
            <TextField
              label="説明"
              value={editingProduct.description || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleProductSave} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* BOM項目追加/編集ダイアログ */}
      <Dialog open={bomDialogOpen} onClose={() => setBomDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>BOM項目追加</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>親製品</InputLabel>
              <Select
                value={editingBomItem.parentProductId || ''}
                onChange={(e) => setEditingBomItem({ ...editingBomItem, parentProductId: e.target.value })}
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name} ({product.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>子部品</InputLabel>
              <Select
                value={editingBomItem.childProductId || ''}
                onChange={(e) => setEditingBomItem({ ...editingBomItem, childProductId: e.target.value })}
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name} ({product.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="使用数量"
              type="number"
              value={editingBomItem.quantity || ''}
              onChange={(e) => setEditingBomItem({ ...editingBomItem, quantity: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="単位"
              value={editingBomItem.unit || ''}
              onChange={(e) => setEditingBomItem({ ...editingBomItem, unit: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBomDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleLegacyBOMSave} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* バリエーション追加/編集ダイアログ */}
      <Dialog open={variantDialogOpen} onClose={() => setVariantDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>製品バリエーション追加</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="バリエーション名"
              value={editingVariant.variantName || ''}
              onChange={(e) => setEditingVariant({ ...editingVariant, variantName: e.target.value })}
              fullWidth
            />
            <TextField
              label="バリエーションコード"
              value={editingVariant.variantCode || ''}
              onChange={(e) => setEditingVariant({ ...editingVariant, variantCode: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>ベース製品</InputLabel>
              <Select
                value={editingVariant.baseProductId || ''}
                onChange={(e) => setEditingVariant({ ...editingVariant, baseProductId: e.target.value })}
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name} ({product.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="日次需要"
              type="number"
              value={editingVariant.demand?.dailyDemand || ''}
              onChange={(e) => setEditingVariant({
                ...editingVariant,
                demand: { ...editingVariant.demand, dailyDemand: Number(e.target.value) } as any
              })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariantDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleVariantSave} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* BOM編集ダイアログ */}
      <BOMEditDialog
        open={bomEditDialogOpen}
        product={selectedProductForBOM}
        bomItems={bomItems}
        products={products}
        onClose={() => {
          setBomEditDialogOpen(false);
          setSelectedProductForBOM(null);
        }}
        onSave={handleBOMSave}
      />
    </Box>
  );
};

export default BOMManager;