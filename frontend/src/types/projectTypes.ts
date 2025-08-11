import { Product, BOMItem, ProductVariant, AdvancedProcessData } from './productionTypes';

// プロジェクト管理用の型定義

/**
 * プロジェクト基本情報
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  status: 'active' | 'archived' | 'deleted';
  tags: string[];
  category: 'manufacturing' | 'logistics' | 'quality' | 'maintenance' | 'research';
  version: string;
  thumbnail?: string; // プロジェクトのサムネイル画像URL
}

/**
 * プロジェクトの詳細設定
 */
export interface ProjectSettings {
  projectId: string;
  simulationSettings: SimulationSettings;
  networkSettings: NetworkSettings;
  analysisSettings: AnalysisSettings;
  exportSettings: ExportSettings;
}

/**
 * シミュレーション設定
 */
export interface SimulationSettings {
  timeUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  simulationDuration: number;
  warmupPeriod: number;
  randomSeed?: number;
  outputLevel: 'basic' | 'detailed' | 'verbose';
  autoSaveInterval: number; // 分単位
}

/**
 * ネットワーク設定
 */
export interface NetworkSettings {
  autoLayout: boolean;
  gridSnap: boolean;
  gridSize: number;
  showLabels: boolean;
  showMetrics: boolean;
  theme: 'light' | 'dark' | 'auto';
}

/**
 * 分析設定
 */
export interface AnalysisSettings {
  enableRealTimeAnalysis: boolean;
  analysisInterval: number; // 秒単位
  kpiThresholds: KPISettings;
  alertSettings: AlertSettings;
}

/**
 * KPI設定
 */
export interface KPISettings {
  targetOEE: number;
  targetThroughput: number;
  targetCycleTime: number;
  targetQuality: number;
  alertThreshold: number; // アラート発動の閾値（%）
}

/**
 * アラート設定
 */
export interface AlertSettings {
  enabled: boolean;
  emailNotifications: boolean;
  slackNotifications: boolean;
  alertLevels: ('info' | 'warning' | 'error' | 'critical')[];
}

/**
 * エクスポート設定
 */
export interface ExportSettings {
  defaultFormat: 'json' | 'xml' | 'csv' | 'pdf';
  includeMetadata: boolean;
  includeSimulationResults: boolean;
  includeAnalysisReports: boolean;
  autoExport: boolean;
  exportPath: string;
}

/**
 * プロジェクトメンバー
 */
export interface ProjectMember {
  userId: string;
  projectId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: Date;
  permissions: string[];
}

/**
 * プロジェクトの変更履歴
 */
export interface ProjectHistory {
  id: string;
  projectId: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'import' | 'share';
  timestamp: Date;
  description: string;
  details?: any;
}

/**
 * プロジェクトテンプレート
 */
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  templateData: {
    nodes: any[];
    edges: any[];
    settings: Partial<ProjectSettings>;
  };
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  createdBy: string;
}

/**
 * プロジェクト統計情報
 */
export interface ProjectStats {
  projectId: string;
  nodeCount: number;
  edgeCount: number;
  simulationCount: number;
  lastSimulationDate?: Date;
  totalSimulationTime: number; // 分単位
  averageSimulationDuration: number; // 分単位
  mostUsedTemplates: string[];
  collaborationStats: {
    memberCount: number;
    activeMembers: number;
    totalEdits: number;
  };
}

/**
 * プロジェクト検索・フィルタリング用
 */
export interface ProjectFilter {
  searchTerm?: string;
  category?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  createdBy?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'category';
  sortOrder?: 'asc' | 'desc';
}

/**
 * プロジェクトネットワークデータ
 */
export interface ProjectNetworkData {
  nodes: any[];
  edges: any[];
  products: Product[];
  bom_items: BOMItem[];
  variants: ProductVariant[];
  process_advanced_data: { [key: string]: AdvancedProcessData };
}