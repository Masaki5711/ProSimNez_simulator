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
      
      // 新規プロジェクトの場合はデフォルトの部品データを返す
      return getDefaultComponents();
    }
    
    // プロジェクトIDが指定されていない場合は空のデータを返す
    return { components: [], categories: [] };
  }
 );

// デフォルトの部品データを取得する関数
const getDefaultComponents = () => {
  const defaultCategories: ComponentCategory[] = [
    { id: 'cat_1', name: '原材料', description: '加工前の素材' },
    { id: 'cat_2', name: '部品', description: '基本的な部品' },
    { id: 'cat_3', name: 'サブアセンブリ', description: '複数の部品から構成されるサブアセンブリ' },
    { id: 'cat_4', name: '完成品', description: '最終製品' },
    { id: 'cat_5', name: '不良品', description: '品質基準を満たさない製品' },
  ];

  const defaultComponents: Component[] = [
    {
      id: 'prod_steel',
      name: '鋼材',
      code: 'STEEL-001',
      type: 'raw_material',
      version: '1.0',
      description: '高品質鋼材',
      unitCost: 500,
      leadTime: 7,
      supplier: '鋼材商事',
      storageConditions: '常温',
      isDefective: false,
      originalProductId: undefined,
      qualityGrade: 'standard',
      category: 'cat_1',
      unit: 'kg',
      specifications: { material: '鋼材', grade: '高品質' },
      bomItems: [],
      transportLotSize: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod_bolt',
      name: 'ボルト',
      code: 'BOLT-M8',
      type: 'component',
      version: '1.0',
      description: 'M8 六角ボルト',
      unitCost: 50,
      leadTime: 3,
      supplier: 'ファスナー工業',
      storageConditions: '常温',
      isDefective: false,
      originalProductId: undefined,
      qualityGrade: 'standard',
      category: 'cat_2',
      unit: '個',
      specifications: { diameter: 'M8', type: '六角' },
      bomItems: [],
      transportLotSize: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod_bracket',
      name: 'ブラケット',
      code: 'BRKT-001',
      type: 'sub_assembly',
      version: '1.0',
      description: '鋼材製ブラケット',
      unitCost: 800,
      leadTime: 5,
      supplier: '鋼材商事',
      storageConditions: '常温',
      isDefective: false,
      originalProductId: undefined,
      qualityGrade: 'standard',
      category: 'cat_3',
      unit: '個',
      specifications: { material: '鋼材', type: 'ブラケット' },
      bomItems: [],
      transportLotSize: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod_final',
      name: '完成品A',
      code: 'PROD-A',
      type: 'finished_product',
      version: '1.0',
      description: '最終製品A',
      unitCost: 2000,
      leadTime: 10,
      supplier: '自社製造',
      storageConditions: '常温',
      isDefective: false,
      originalProductId: undefined,
      qualityGrade: 'standard',
      category: 'cat_4',
      unit: '個',
      specifications: { type: '完成品', model: 'A' },
      bomItems: [],
      transportLotSize: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return { components: defaultComponents, categories: defaultCategories };
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
    // 実際のAPI呼び出しに置き換える
    if (!bomItem.id) {
      // 新規作成の場合はIDを生成
      return {
        componentId,
        bomItem: {
          ...bomItem,
          id: Date.now().toString(),
        },
        projectId,
      };
    }
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
        const { componentId, bomItem, projectId } = action.payload;
        const component = state.components.find(c => c.id === componentId);
        if (component) {
          if (bomItem.id) {
            // 更新
            const bomItemIndex = component.bomItems.findIndex(item => item.id === bomItem.id);
            if (bomItemIndex !== -1) {
              component.bomItems[bomItemIndex] = { ...component.bomItems[bomItemIndex], ...bomItem };
            }
          } else {
            // 新規作成
            const newBOMItem: ComponentBOMItem = {
              id: Date.now().toString(),
              parentProductId: componentId,
              childProductId: bomItem.childProductId || '',
              quantity: bomItem.quantity || 1,
              unit: bomItem.unit || '個',
              position: bomItem.position || '',
              isOptional: bomItem.isOptional || false,
              effectiveDate: bomItem.effectiveDate || new Date(),
              expiryDate: bomItem.expiryDate,
              alternativeProducts: bomItem.alternativeProducts || [],
              notes: bomItem.notes || '',
            };
            component.bomItems.push(newBOMItem);
          }
          component.updatedAt = new Date().toISOString();
        }
        
        // ローカルストレージに保存（開発環境用）
        if (projectId) {
          localStorage.setItem(`project_${projectId}_components`, JSON.stringify({
            components: state.components,
            categories: state.categories
          }));
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