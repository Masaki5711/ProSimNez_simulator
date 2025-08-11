import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NetworkState {
  nodes: any[];
  edges: any[];
  selectedNode: string | null;
  selectedEdge: string | null;
}

const initialState: NetworkState = {
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNodes: (state, action: PayloadAction<any[]>) => {
      state.nodes = action.payload;
    },
    setEdges: (state, action: PayloadAction<any[]>) => {
      state.edges = action.payload;
    },
    addNode: (state, action: PayloadAction<any>) => {
      state.nodes.push(action.payload);
    },
    updateNode: (state, action: PayloadAction<{ id: string; data: any }>) => {
      const index = state.nodes.findIndex(node => node.id === action.payload.id);
      if (index !== -1) {
        state.nodes[index] = { ...state.nodes[index], ...action.payload.data };
      }
    },
    removeNode: (state, action: PayloadAction<string>) => {
      state.nodes = state.nodes.filter(node => node.id !== action.payload);
      state.edges = state.edges.filter(edge => 
        edge.source !== action.payload && edge.target !== action.payload
      );
    },
    addEdge: (state, action: PayloadAction<any>) => {
      state.edges.push(action.payload);
    },
    updateEdge: (state, action: PayloadAction<{ id: string; data: any }>) => {
      const index = state.edges.findIndex(edge => edge.id === action.payload.id);
      if (index !== -1) {
        state.edges[index] = { ...state.edges[index], ...action.payload.data };
      }
    },
    removeEdge: (state, action: PayloadAction<string>) => {
      state.edges = state.edges.filter(edge => edge.id !== action.payload);
    },
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNode = action.payload;
    },
    setSelectedEdge: (state, action: PayloadAction<string | null>) => {
      state.selectedEdge = action.payload;
    },
    clearNetwork: (state) => {
      state.nodes = [];
      state.edges = [];
      state.selectedNode = null;
      state.selectedEdge = null;
    },
  },
});

export const {
  setNodes,
  setEdges,
  addNode,
  updateNode,
  removeNode,
  addEdge,
  updateEdge,
  removeEdge,
  setSelectedNode,
  setSelectedEdge,
  clearNetwork,
} = networkSlice.actions;

export default networkSlice.reducer;