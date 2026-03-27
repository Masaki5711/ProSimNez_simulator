import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Component, ComponentCategory, ComponentBOMItem } from '../../types/productionTypes';

// 非同期アクション
export const fetchComponents = createAsyncThunk(
  'components/fetchComponents',
  async (projectId?: string) => {
    // プロジェクトIDが指定されている場合は、そのプロジェクトの部品データを取得
    if (projectId) {
      // 実際のAPI呼び出しに置き換える
      // 開発環境ではローカルストレージまたはメモリ内データを使用
      // 本番環境ではPostgreSQLから取得
      const storedData = localStorage.getItem(`project_${projectId}_components`);
      if (storedData) {
        return JSON.parse(storedData);
      }
      
      // プロジェクトのnetworkDataから部品データを生成して保存
      const generated = getDefaultComponents(projectId);
      if (generated.components.length > 0) {
        localStorage.setItem(`project_${projectId}_components`, JSON.stringify(generated));
      }
      return generated;
    }

    // プロジェクトIDが指定されていない場合は空のデータを返す
    return { components: [], categories: [] };
  }
 );

// デフォルトの部品データ: プロジェクトのnetworkDataから生成
const getDefaultComponents = (projectId?: string) => {
  const defaultCategories: ComponentCategory[] = [
    { id: 'cat_1', name: '原材料', description: '購入素材' },
    { id: 'cat_2', name: '部品', description: '加工部品' },
    { id: 'cat_3', name: 'サブアセンブリ', description: '中間組立品' },
    { id: 'cat_4', name: '完成品', description: '最終製品' },
  ];

  // プロジェクトのnetworkDataからproductsとbom_itemsを読み込む
  let products: any[] = [];
  let bomItems: any[] = [];

  if (projectId) {
    try {
      const nd = localStorage.getItem(`project_${projectId}_network`);
      if (nd) {
        const parsed = JSON.parse(nd);
        products = parsed.products || [];
        bomItems = parsed.bom_items || [];
      }
    } catch (e) { /* ignore */ }
  }

  // productsがなければ空を返す
  if (products.length === 0) {
    return { components: [], categories: defaultCategories };
  }

  // productsからComponentに変換
  const typeToCategory: Record<string, string> = {
    'component': 'cat_2', 'raw_material': 'cat_1',
    'sub_assembly': 'cat_3', 'finished_product': 'cat_4',
  };

  const now = new Date().toISOString();
  const components: Component[] = products.map((p: any) => {
    // BOMからこの製品の子部品を取得
    const childBom: ComponentBOMItem[] = bomItems
      .filter((b: any) => b.parent_product === p.id)
      .map((b: any) => ({
        id: b.id || `bom_${p.id}_${b.child_product}`,
        parentProductId: p.id,
        childProductId: b.child_product,
        quantity: b.quantity,
        unit: '個',
        isOptional: false,
        effectiveDate: now,
        alternativeProducts: [],
        notes: '',
      }));

    return {
      id: p.id,
      name: p.name,
      code: p.code || p.id.toUpperCase(),
      type: p.type || 'component',
      version: '1.0',
      description: p.name,
      unitCost: p.unitCost || 0,
      leadTime: 0,
      supplier: p.type === 'component' ? '外部調達' : '自社製造',
      storageConditions: '常温',
      isDefective: false,
      originalProductId: undefined,
      qualityGrade: 'standard',
      category: typeToCategory[p.type] || 'cat_2',
      unit: '個',
      specifications: {},
      bomItems: childBom,
      transportLotSize: 10,
      createdAt: now,
      updatedAt: now,
    };
  });

  return { components, categories: defaultCategories };
};

export const saveComponent = createAsyncThunk(
  'components/saveComponent',
  async ({ component, projectId }: { component: Partial<Component>; projectId: string }) => {
    console.log('saveComponent called with:', { component, projectId });
    
    // 実際のAPI呼び出しに置き換える
    if (!component.id || component.id === 'undefined') {
      // 新規作成の場合はIDを生成
      const newId = Date.now().toString();
      const result = {
        ...component,
        id: newId,
        projectId,
      };
      console.log('新規作成 - 生成されたID:', newId, '結果:', result);
      return result;
    }
    
    // 更新の場合は既存のIDを使用
    const result = { ...component, projectId };
    console.log('更新 - 結果:', result);
    return result;
  }
 );

export const deleteComponent = createAsyncThunk(
  'components/deleteComponent',
  async (componentId: string) => {
    // 実際のAPI呼び出しに置き換える
    return componentId;
  }
);

export const saveCategory = createAsyncThunk(
  'components/saveCategory',
  async ({ category, projectId }: { category: Partial<ComponentCategory>; projectId: string }) => {
    // 実際のAPI呼び出しに置き換える
    if (!category.id) {
      // 新規作成の場合はIDを生成
      return {
        ...category,
        id: Date.now().toString(),
        projectId,
      };
    }
    return { ...category, projectId };
  }
 );

export const deleteCategory = createAsyncThunk(
  'components/deleteCategory',
  async (categoryId: string) => {
    // 実際のAPI呼び出しに置き換える
    return categoryId;
  }
);

export const saveBOMItem = createAsyncThunk(
  'components/saveBOMItem',
  async ({ componentId, bomItem, projectId }: { componentId: string; bomItem: Partial<ComponentBOMItem>; projectId: string }) => {
    console.log('saveBOMItem - 入力データ:', { componentId, bomItem, projectId });
    
    // 実際のAPI呼び出しに置き換える
    if (!bomItem.id || bomItem.id === '' || bomItem.id === 'undefined') {
      // 新規作成の場合はIDを生成
      const newId = `bom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newBOMItem = {
        ...bomItem,
        id: newId,
        parentProductId: componentId,
        effectiveDate: bomItem.effectiveDate || new Date().toISOString(),
      };
      
      console.log('新規BOM項目を生成:', newBOMItem);
      
      return {
        componentId,
        bomItem: newBOMItem,
        projectId,
      };
    }
    
    // 更新の場合
    console.log('BOM項目を更新:', bomItem);
    return { componentId, bomItem, projectId };
  }
 );

export const deleteBOMItem = createAsyncThunk(
  'components/deleteBOMItem',
  async ({ componentId, bomItemId }: { componentId: string; bomItemId: string }) => {
    // 実際のAPI呼び出しに置き換える
    return { componentId, bomItemId };
  }
);

interface ComponentState {
  components: Component[];
  categories: ComponentCategory[];
  loading: boolean;
  error: string | null;
}

const initialState: ComponentState = {
  components: [],
  categories: [],
  loading: false,
  error: null,
};

const componentSlice = createSlice({
  name: 'components',
  initialState,
  reducers: {
    setComponents: (state, action: PayloadAction<Component[]>) => {
      state.components = action.payload;
    },
    setCategories: (state, action: PayloadAction<ComponentCategory[]>) => {
      state.categories = action.payload;
    },
    addComponent: (state, action: PayloadAction<Component>) => {
      state.components.push(action.payload);
    },
    updateComponent: (state, action: PayloadAction<{ id: string; updates: Partial<Component> }>) => {
      const index = state.components.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.components[index] = { ...state.components[index], ...action.payload.updates };
      }
    },
    removeComponent: (state, action: PayloadAction<string>) => {
      state.components = state.components.filter(c => c.id !== action.payload);
    },
    addCategory: (state, action: PayloadAction<ComponentCategory>) => {
      state.categories.push(action.payload);
    },
    updateCategory: (state, action: PayloadAction<{ id: string; updates: Partial<ComponentCategory> }>) => {
      const index = state.categories.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.categories[index] = { ...state.categories[index], ...action.payload.updates };
      }
    },
    removeCategory: (state, action: PayloadAction<string>) => {
      state.categories = state.categories.filter(c => c.id !== action.payload);
    },
    addBOMItem: (state, action: PayloadAction<{ componentId: string; bomItem: ComponentBOMItem }>) => {
      const component = state.components.find(c => c.id === action.payload.componentId);
      if (component) {
        component.bomItems.push(action.payload.bomItem);
      }
    },
    updateBOMItem: (state, action: PayloadAction<{ componentId: string; bomItemId: string; updates: Partial<ComponentBOMItem> }>) => {
      const component = state.components.find(c => c.id === action.payload.componentId);
      if (component) {
        const bomItem = component.bomItems.find(item => item.id === action.payload.bomItemId);
        if (bomItem) {
          Object.assign(bomItem, action.payload.updates);
        }
      }
    },
    removeBOMItem: (state, action: PayloadAction<{ componentId: string; bomItemId: string }>) => {
      const component = state.components.find(c => c.id === action.payload.componentId);
      if (component) {
        component.bomItems = component.bomItems.filter(item => item.id !== action.payload.bomItemId);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchComponents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchComponents.fulfilled, (state, action) => {
        state.loading = false;
        state.components = action.payload.components;
        state.categories = action.payload.categories;
      })
      .addCase(fetchComponents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '部品の取得に失敗しました';
      })
                    .addCase(saveComponent.fulfilled, (state, action) => {
         console.log('saveComponent.fulfilled called with:', action.payload);
         const { projectId, ...componentData } = action.payload;
         
         // 既存の部品かどうかをチェック
         const existingComponentIndex = state.components.findIndex(c => c.id === componentData.id);
         
         if (existingComponentIndex !== -1) {
           // 更新処理
           console.log('更新処理:', componentData.id);
           state.components[existingComponentIndex] = { 
             ...state.components[existingComponentIndex], 
             ...componentData,
             updatedAt: new Date().toISOString()
           };
           console.log('更新完了:', state.components[existingComponentIndex]);
         } else {
           // 新規作成処理
           console.log('新規作成処理');
           const newComponent: Component = {
             id: componentData.id || Date.now().toString(),
             name: componentData.name || '',
             code: componentData.code || '',
             type: componentData.type || 'component',
             version: componentData.version || '1.0',
             description: componentData.description || '',
             unitCost: componentData.unitCost || 0,
             leadTime: componentData.leadTime || 7,
             supplier: componentData.supplier || '',
             storageConditions: componentData.storageConditions || '常温',
             isDefective: componentData.isDefective || false,
             originalProductId: componentData.originalProductId,
             qualityGrade: componentData.qualityGrade || 'standard',
             category: componentData.category || '',
             unit: componentData.unit || '個',
             specifications: componentData.specifications || {},
             bomItems: componentData.bomItems || [],
             transportLotSize: componentData.transportLotSize || 1,
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString(),
           };
           state.components.push(newComponent);
           console.log('新規作成完了:', newComponent);
         }
         
         console.log('現在の部品数:', state.components.length);
         
         // ローカルストレージに保存（開発環境用）
         if (projectId) {
           localStorage.setItem(`project_${projectId}_components`, JSON.stringify({
             components: state.components,
             categories: state.categories
           }));
           console.log('ローカルストレージに保存完了');
         }
       })
      .addCase(deleteComponent.fulfilled, (state, action) => {
        state.components = state.components.filter(c => c.id !== action.payload);
        
        // 現在のプロジェクトIDを取得してローカルストレージを更新
        // 注: 削除時にはprojectIdが渡されないため、現在のstateから推測する必要がある
        // 実際の実装では、削除アクションにもprojectIdを含めることを推奨
      })
      .addCase(saveCategory.fulfilled, (state, action) => {
        const { projectId, ...categoryData } = action.payload;
        
        if (categoryData.id) {
          // 更新
          const index = state.categories.findIndex(c => c.id === categoryData.id);
          if (index !== -1) {
            state.categories[index] = { ...state.categories[index], ...categoryData };
          }
        } else {
          // 新規作成
          const newCategory: ComponentCategory = {
            id: Date.now().toString(),
            name: categoryData.name || '',
            description: categoryData.description || '',
            parentId: categoryData.parentId,
          };
          state.categories.push(newCategory);
        }
        
        // ローカルストレージに保存（開発環境用）
        if (projectId) {
          localStorage.setItem(`project_${projectId}_components`, JSON.stringify({
            components: state.components,
            categories: state.categories
          }));
        }
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter(c => c.id !== action.payload);
      })
      .addCase(saveBOMItem.fulfilled, (state, action) => {
        console.log('saveBOMItem.fulfilled - action.payload:', action.payload);
        const { componentId, bomItem, projectId } = action.payload;
        const component = state.components.find(c => c.id === componentId);
        
        if (component) {
          console.log('対象部品が見つかりました:', component.id, component.name);
          console.log('現在のBOM項目数:', component.bomItems.length);
          console.log('追加するBOM項目:', bomItem);
          
          // 既存のBOM項目IDと重複しないかチェック
          const existingBOMItem = component.bomItems.find(item => item.id === bomItem.id);
          
          if (existingBOMItem) {
            // 更新処理
            console.log('BOM項目を更新します:', bomItem.id);
            const bomItemIndex = component.bomItems.findIndex(item => item.id === bomItem.id);
            if (bomItemIndex !== -1) {
              component.bomItems[bomItemIndex] = { 
                ...component.bomItems[bomItemIndex], 
                ...bomItem as ComponentBOMItem 
              };
              console.log('BOM項目更新完了:', component.bomItems[bomItemIndex]);
            }
          } else {
            // 新規作成処理
            console.log('新しいBOM項目を追加します');
            const newBOMItem: ComponentBOMItem = {
              id: bomItem.id || `bom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              parentProductId: componentId,
              childProductId: bomItem.childProductId || '',
              quantity: bomItem.quantity || 1,
              unit: bomItem.unit || '個',
              position: bomItem.position || '',
              isOptional: bomItem.isOptional || false,
              effectiveDate: bomItem.effectiveDate || new Date().toISOString(),
              expiryDate: bomItem.expiryDate,
              alternativeProducts: bomItem.alternativeProducts || [],
              notes: bomItem.notes || '',
            };
            
            console.log('新規BOM項目:', newBOMItem);
            component.bomItems.push(newBOMItem);
            console.log('追加後のBOM項目数:', component.bomItems.length);
            console.log('追加後のBOM項目リスト:', component.bomItems);
          }
          
          component.updatedAt = new Date().toISOString();
          console.log('部品の更新時間を設定:', component.updatedAt);
        } else {
          console.error('対象部品が見つかりません:', componentId);
        }
        
        // ローカルストレージに保存（開発環境用）
        if (projectId) {
          const saveData = {
            components: state.components,
            categories: state.categories
          };
          localStorage.setItem(`project_${projectId}_components`, JSON.stringify(saveData));
          console.log('ローカルストレージに保存完了:', saveData);
        }
      })
      .addCase(deleteBOMItem.fulfilled, (state, action) => {
        const { componentId, bomItemId } = action.payload;
        const component = state.components.find(c => c.id === componentId);
        if (component) {
          component.bomItems = component.bomItems.filter(item => item.id !== bomItemId);
          component.updatedAt = new Date().toISOString();
        }
      });
  },
});

export const {
  setComponents,
  setCategories,
  addComponent,
  updateComponent,
  removeComponent,
  addCategory,
  updateCategory,
  removeCategory,
  addBOMItem,
  updateBOMItem,
  removeBOMItem,
} = componentSlice.actions;

export default componentSlice.reducer; 