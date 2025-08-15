/**
 * プロジェクトデータリセット用ユーティリティ
 */
import { Project } from '../types/projectTypes';

export const resetProjectData = async (): Promise<void> => {
  console.log('=== プロジェクトデータリセット開始 ===');
  
  // localStorageを完全にクリア
  localStorage.removeItem('projects');
  console.log('localStorage cleared');
  
  // デモプロジェクトを作成
  const demoProject: Project = {
    id: '1',
    name: 'デモファクトリー',
    description: '完全な生産ラインを含むデモンストレーション用ファクトリーです。原材料から出荷まで7つの工程を含みます。',
    category: 'manufacturing',
    tags: ['デモ', '完全な生産ライン', 'シミュレーション対応'],
    status: 'active',
    version: '2.0.0',
    createdBy: 'system',
    createdAt: new Date('2025-01-15T12:00:00.000Z'),
    updatedAt: new Date('2025-01-15T12:00:00.000Z'),
  };
  
  console.log('Demo project created:', demoProject);
  
  // localStorageに強制保存
  try {
    localStorage.setItem('projects', JSON.stringify([demoProject]));
    console.log('Project saved to localStorage');
    
    // デモファクトリーのネットワークデータも保存
    const demoNetworkData = {
      nodes: [
        {
          id: "raw_material_store",
          type: "store",
          label: "原材料倉庫",
          name: "原材料倉庫",
          capacity: 1000,
          initialQuantity: 500,
          bufferType: "input",
          position: { x: 100, y: 200 }
        },
        {
          id: "cutting_process",
          type: "process",
          label: "切断工程",
          name: "切断工程",
          processingTime: 30,
          equipmentCount: 1,
          quality: { defect_rate: 0.02 },
          position: { x: 300, y: 200 }
        },
        {
          id: "semi_finished_store",
          type: "store",
          label: "仕掛品倉庫",
          name: "仕掛品倉庫",
          capacity: 200,
          initialQuantity: 50,
          bufferType: "intermediate",
          position: { x: 500, y: 200 }
        },
        {
          id: "assembly_process",
          type: "process",
          label: "組立工程",
          name: "組立工程",
          processingTime: 45,
          equipmentCount: 2,
          quality: { defect_rate: 0.01 },
          position: { x: 700, y: 200 }
        },
        {
          id: "finished_goods_store",
          type: "store",
          label: "完成品倉庫",
          name: "完成品倉庫",
          capacity: 300,
          initialQuantity: 20,
          bufferType: "output",
          position: { x: 900, y: 200 }
        },
        {
          id: "inspection_process",
          type: "process",
          label: "検査工程",
          name: "検査工程",
          processingTime: 15,
          equipmentCount: 1,
          quality: { defect_detection_rate: 0.95 },
          position: { x: 1100, y: 200 }
        },
        {
          id: "shipping_store",
          type: "store",
          label: "出荷エリア",
          name: "出荷エリア",
          capacity: 100,
          initialQuantity: 0,
          bufferType: "output",
          position: { x: 1300, y: 200 }
        }
      ],
      edges: [
        {
          id: "edge_1",
          source: "raw_material_store",
          target: "cutting_process",
          type: "material_flow"
        },
        {
          id: "edge_2",
          source: "cutting_process",
          target: "semi_finished_store",
          type: "material_flow"
        },
        {
          id: "edge_3",
          source: "semi_finished_store",
          target: "assembly_process",
          type: "material_flow"
        },
        {
          id: "edge_4",
          source: "assembly_process",
          target: "finished_goods_store",
          type: "material_flow"
        },
        {
          id: "edge_5",
          source: "finished_goods_store",
          target: "inspection_process",
          type: "material_flow"
        },
        {
          id: "edge_6",
          source: "inspection_process",
          target: "shipping_store",
          type: "material_flow"
        }
      ],
      products: [
        {
          id: "product_a",
          name: "製品A",
          properties: {
            type: "main_product",
            priority: 1,
            cycle_time: 90
          }
        }
      ],
      bom_items: [
        {
          id: "bom_1",
          product_id: "product_a",
          material_id: "raw_material",
          quantity: 1,
          unit: "piece"
        }
      ],
      variants: [],
      process_advanced_data: {
        cutting_process: {
          setup_time: 5,
          changeover_time: 10,
          efficiency: 0.95
        },
        assembly_process: {
          setup_time: 8,
          changeover_time: 15,
          efficiency: 0.90
        },
        inspection_process: {
          setup_time: 2,
          changeover_time: 5,
          efficiency: 0.98
        }
      }
    };
    
    // ネットワークデータをlocalStorageに保存
    localStorage.setItem('project_1_network', JSON.stringify(demoNetworkData));
    console.log('Demo network data saved to localStorage');
    
    // 保存確認
    const saved = localStorage.getItem('projects');
    console.log('Saved data verification:', saved);
  } catch (error) {
    console.error('localStorage save error:', error);
  }
  
  // APIが利用可能な場合はサーバーにも送信を試行
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
  console.log('=== プロジェクトデータ確認 ===');
  console.log('localStorage projects:', projects);
  
  if (projects) {
    try {
      const parsed = JSON.parse(projects);
      console.log('Parsed projects:', parsed);
      console.log('Projects count:', Array.isArray(parsed) ? parsed.length : 'Not an array');
    } catch (error) {
      console.error('Parse error:', error);
    }
  } else {
    console.log('No projects found in localStorage');
  }
};
