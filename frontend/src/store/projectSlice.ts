import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Project, ProjectFilter } from '../types/projectTypes';

// プロジェクト管理の状態
interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  filter: ProjectFilter;
  searchTerm: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'category';
  sortOrder: 'asc' | 'desc';
  activeTab: number;
  // リアルタイム協調編集
  connectedUsers: string[];
  userActivities: Record<string, any>;
  networkData: {
    nodes: any[];
    edges: any[];
    products: any[];
    bom_items: any[];
    variants: any[];
    process_advanced_data: Record<string, any>;
  } | null;
}

const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
  filter: {},
  searchTerm: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  activeTab: 0,
  connectedUsers: [],
  userActivities: {},
  networkData: null,
};

// 非同期アクション
export const fetchProjects = createAsyncThunk(
  'project/fetchProjects',
  async (params?: { category?: string; status?: string; search?: string }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.category) queryParams.append('category', params.category);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);

      const response = await fetch(`/api/projects?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return await response.json();
    } catch (error) {
      // APIが利用できない場合はlocalStorageを使用
      console.warn('API not available, using localStorage:', error);
      
      const projects = JSON.parse(localStorage.getItem('projects') || '[]');
      
      // デフォルトプロジェクトがない場合は作成
      if (projects.length === 0) {
        const defaultProject: Project = {
          id: '1',
          name: 'サンプルプロジェクト',
          description: '生産ライン設計のサンプルプロジェクトです',
          category: 'manufacturing',
          tags: ['サンプル', '生産ライン'],
          status: 'active',
          version: '1.0.0',
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        projects.push(defaultProject);
        localStorage.setItem('projects', JSON.stringify(projects));
      }
      
      return projects;
    }
  }
);

export const createProject = createAsyncThunk(
  'project/createProject',
  async (projectData: Partial<Project>) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projectData,
          created_by: 'current_user', // 実際のユーザーID
        }),
      });
      if (!response.ok) throw new Error('Failed to create project');
      return await response.json();
    } catch (error) {
      // APIが利用できない場合はlocalStorageを使用
      console.warn('API not available, using localStorage:', error);
      
      const newProject: Project = {
        id: Date.now().toString(),
        name: projectData.name || '',
        description: projectData.description || '',
        category: projectData.category || 'manufacturing',
        tags: projectData.tags || [],
        status: 'active',
        version: '1.0.0',
        createdBy: 'current_user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // localStorageに保存
      const existingProjects = JSON.parse(localStorage.getItem('projects') || '[]');
      existingProjects.push(newProject);
      localStorage.setItem('projects', JSON.stringify(existingProjects));
      
      return newProject;
    }
  }
);

export const updateProject = createAsyncThunk(
  'project/updateProject',
  async ({ projectId, updates }: { projectId: string; updates: Partial<Project> }) => {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        updated_by: 'current_user', // 実際のユーザーID
      }),
    });
    if (!response.ok) throw new Error('Failed to update project');
    return await response.json();
  }
);

export const deleteProject = createAsyncThunk(
  'project/deleteProject',
  async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}?user_id=current_user`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete project');
    return projectId;
  }
);

export const fetchProjectNetwork = createAsyncThunk(
  'project/fetchProjectNetwork',
  async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/network`);
      if (!response.ok) throw new Error('Failed to fetch project network');
      return await response.json();
    } catch (error) {
      // APIが利用できない場合はlocalStorageを使用
      console.warn('API not available, using localStorage for network data:', error);
      
      const networkData = JSON.parse(localStorage.getItem(`project_${projectId}_network`) || 'null');
      
      // デフォルトネットワークデータ
      const defaultNetwork = {
        nodes: [],
        edges: [],
        products: [],
        bom_items: [],
        variants: [],
        process_advanced_data: {},
        last_modified_by: 'current_user',
        updated_at: new Date().toISOString()
      };
      
      return networkData || defaultNetwork;
    }
  }
);

export const updateProjectNetwork = createAsyncThunk(
  'project/updateProjectNetwork',
  async ({ projectId, networkData }: { projectId: string; networkData: any }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/network`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...networkData,
          modified_by: 'current_user', // 実際のユーザーID
        }),
      });
      if (!response.ok) throw new Error('Failed to update project network');
      return await response.json();
    } catch (error) {
      // APIが利用できない場合はlocalStorageを使用
      console.warn('API not available, using localStorage for network data:', error);
      
      const updatedData = {
        ...networkData,
        last_modified_by: 'current_user',
        updated_at: new Date().toISOString()
      };
      
      // localStorageに保存
      localStorage.setItem(`project_${projectId}_network`, JSON.stringify(updatedData));
      
      return { message: 'Network data updated successfully', updated_at: updatedData.updated_at };
    }
  }
);

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
    setFilter: (state, action: PayloadAction<ProjectFilter>) => {
      state.filter = action.payload;
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    setSortBy: (state, action: PayloadAction<'name' | 'createdAt' | 'updatedAt' | 'category'>) => {
      state.sortBy = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.sortOrder = action.payload;
    },
    setActiveTab: (state, action: PayloadAction<number>) => {
      state.activeTab = action.payload;
    },
    // リアルタイム協調編集
    setConnectedUsers: (state, action: PayloadAction<string[]>) => {
      state.connectedUsers = action.payload;
    },
    addConnectedUser: (state, action: PayloadAction<string>) => {
      if (!state.connectedUsers.includes(action.payload)) {
        state.connectedUsers.push(action.payload);
      }
    },
    removeConnectedUser: (state, action: PayloadAction<string>) => {
      state.connectedUsers = state.connectedUsers.filter(user => user !== action.payload);
    },
    setUserActivity: (state, action: PayloadAction<{ userId: string; activity: any }>) => {
      state.userActivities[action.payload.userId] = action.payload.activity;
    },
    updateNetworkData: (state, action: PayloadAction<any>) => {
      if (state.networkData) {
        state.networkData = { ...state.networkData, ...action.payload };
      }
    },
    setNetworkData: (state, action: PayloadAction<any>) => {
      state.networkData = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProjects
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch projects';
      })
      // createProject
      .addCase(createProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.push(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create project';
      })
      // updateProject
      .addCase(updateProject.fulfilled, (state, action) => {
        const index = state.projects.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      // deleteProject
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.projects = state.projects.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      // fetchProjectNetwork
      .addCase(fetchProjectNetwork.fulfilled, (state, action) => {
        state.networkData = action.payload;
      })
      // updateProjectNetwork
      .addCase(updateProjectNetwork.fulfilled, (state, action) => {
        // ネットワークデータはリアルタイムで更新されるため、
        // ここでは成功通知のみ
      });
  },
});

export const {
  setCurrentProject,
  setFilter,
  setSearchTerm,
  setSortBy,
  setSortOrder,
  setActiveTab,
  setConnectedUsers,
  addConnectedUser,
  removeConnectedUser,
  setUserActivity,
  updateNetworkData,
  setNetworkData,
} = projectSlice.actions;

export default projectSlice.reducer; 