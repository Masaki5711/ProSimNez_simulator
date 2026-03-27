/**
 * プロジェクトデータリセット用ユーティリティ
 * BOM構成付きデモプロジェクトを生成
 */
import { Project } from '../types/projectTypes';
import { getFactoryDemoData } from '../data/factoryDemo';

export const resetProjectData = async (): Promise<void> => {
  console.log('=== プロジェクトデータリセット開始 ===');

  // localStorageを完全にクリア
  localStorage.removeItem('projects');
  localStorage.removeItem('project_1_network');
  console.log('localStorage cleared');

  // デモプロジェクトを作成
  const demoProject: Project = {
    id: '1',
    name: 'BOM付き工場デモ',
    description:
      'プレス→切削→サブ組立A / 射出成形→SMT→サブ組立B → 最終組立→検査 の混流生産ライン。' +
      '完成品PROD-001はサブアセンブリA、サブアセンブリB、外装パネルから構成されます。',
    category: 'manufacturing',
    tags: ['デモ', 'BOM', '混流生産', 'シミュレーション対応'],
    status: 'active',
    version: '2.0.0',
    createdBy: 'system',
    createdAt: new Date('2025-01-15T12:00:00.000Z'),
    updatedAt: new Date(),
  };

  console.log('Demo project created:', demoProject.name);

  // BOM付きデモネットワークデータを取得
  const demoNetworkData = getFactoryDemoData();

  // process_advanced_data を追加（各工程の詳細設定）
  const networkDataWithAdvanced = {
    ...demoNetworkData,
    variants: [],
    process_advanced_data: {
      proc_press: { setup_time: 60, changeover_time: 120, efficiency: 0.92, mtbf: 480, mttr: 30 },
      proc_cutting: { setup_time: 120, changeover_time: 180, efficiency: 0.88, mtbf: 360, mttr: 45 },
      proc_sub_a: { setup_time: 90, changeover_time: 90, efficiency: 0.95, mtbf: 600, mttr: 20 },
      proc_molding: { setup_time: 180, changeover_time: 240, efficiency: 0.90, mtbf: 300, mttr: 60 },
      proc_smt: { setup_time: 300, changeover_time: 360, efficiency: 0.97, mtbf: 720, mttr: 90 },
      proc_sub_b: { setup_time: 90, changeover_time: 90, efficiency: 0.94, mtbf: 600, mttr: 25 },
      proc_final: { setup_time: 120, changeover_time: 150, efficiency: 0.93, mtbf: 480, mttr: 30 },
      proc_inspect: { setup_time: 30, changeover_time: 30, efficiency: 0.99, mtbf: 1000, mttr: 10 },
    },
  };

  try {
    // localStorageに保存
    localStorage.setItem('projects', JSON.stringify([demoProject]));
    localStorage.setItem('project_1_network', JSON.stringify(networkDataWithAdvanced));
    console.log('Demo project + network data saved to localStorage');

    // 保存確認
    const savedProjects = JSON.parse(localStorage.getItem('projects') || '[]');
    const savedNetwork = JSON.parse(localStorage.getItem('project_1_network') || '{}');
    console.log(`Verification: ${savedProjects.length} projects, ${savedNetwork.nodes?.length || 0} nodes, ${savedNetwork.edges?.length || 0} edges`);
  } catch (error) {
    console.error('localStorage save error:', error);
  }

  // APIにも送信を試行
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demoProject),
    });
    if (response.ok) {
      console.log('Demo project created via API');
    }
  } catch (error) {
    console.log('API not available, using localStorage only');
  }

  console.log('=== プロジェクトデータリセット完了 ===');
};

export const checkProjectData = (): void => {
  const projects = localStorage.getItem('projects');
  const network = localStorage.getItem('project_1_network');
  console.log('=== プロジェクトデータ確認 ===');

  if (projects) {
    try {
      const parsed = JSON.parse(projects);
      console.log('Projects count:', Array.isArray(parsed) ? parsed.length : 'Not an array');
      parsed.forEach((p: any) => console.log(`  - ${p.name} (${p.id})`));
    } catch (error) {
      console.error('Parse error:', error);
    }
  } else {
    console.log('No projects found in localStorage');
  }

  if (network) {
    try {
      const parsed = JSON.parse(network);
      console.log(`Network: ${parsed.nodes?.length || 0} nodes, ${parsed.edges?.length || 0} edges, ${parsed.products?.length || 0} products`);
    } catch (error) {
      console.error('Network parse error:', error);
    }
  } else {
    console.log('No network data found');
  }
};
