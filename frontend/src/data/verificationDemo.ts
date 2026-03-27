/**
 * 検証用プロジェクト: シミュレーションパターン検証
 *
 * 検証対象パターン:
 * 1. 分岐フロー: 塗装工程 → 製品Aライン / 製品Bライン
 * 2. 高不良率: 塗装工程 defectRate=8%
 * 3. 極端なライン不均衡: CT=10秒(高速) vs CT=180秒(低速)
 * 4. 搬送ロットサイズ影響: 1個搬送 vs 20個搬送
 * 5. 単一障害点: 塗装1台 → 2ライン分岐
 * 6. 合流フロー: A+B → 梱包
 *
 * ネットワーク構成:
 *
 *   [材料倉庫] → [切断(3台,CT10)] → [塗装(1台,CT30,不良8%)]
 *                                          ↓ 分岐
 *                          [組立A(2台,CT60)] → [検査A(1台,CT15)]
 *                          [加工B(1台,CT180)] → [検査B(1台,CT20)]
 *                                                    ↓ 合流
 *                                              [梱包(2台,CT40)] → [出荷倉庫]
 */

import { Project } from '../types/projectTypes';

const VERIFY_PROJECT: Project = {
  id: 'verify_1',
  name: '検証用: 分岐・合流・不良率テスト',
  description:
    '分岐フロー、高不良率(8%)、ライン不均衡、搬送ロットサイズ差異、' +
    '単一障害点(塗装1台→2ライン)、合流フローを検証するプロジェクト',
  category: 'manufacturing',
  tags: ['検証', '分岐', '合流', '不良率', 'ボトルネック'],
  status: 'active',
  version: '1.0.0',
  createdBy: 'system',
  createdAt: new Date().toISOString() as any,
  updatedAt: new Date().toISOString() as any,
};

const PRODUCTS = [
  { id: 'raw_steel', name: '鋼材', code: 'RAW-01', type: 'component', unitCost: 300, processing_time: 0 },
  { id: 'cut_part', name: '切断部品', code: 'CUT-01', type: 'component', unitCost: 500, processing_time: 10 },
  { id: 'painted', name: '塗装品', code: 'PNT-01', type: 'component', unitCost: 800, processing_time: 30 },
  { id: 'assy_a', name: '組立品A（量産型）', code: 'ASY-A', type: 'sub_assembly', unitCost: 1500, processing_time: 60 },
  { id: 'part_b', name: '加工品B（精密型）', code: 'PRT-B', type: 'sub_assembly', unitCost: 3000, processing_time: 180 },
  { id: 'product_final', name: '最終製品', code: 'FIN-01', type: 'finished_product', unitCost: 5000, processing_time: 40 },
];

const BOM_ITEMS = [
  { id: 'bom_1', parent_product: 'cut_part', child_product: 'raw_steel', quantity: 1 },
  { id: 'bom_2', parent_product: 'painted', child_product: 'cut_part', quantity: 1 },
  { id: 'bom_3', parent_product: 'assy_a', child_product: 'painted', quantity: 2 },
  { id: 'bom_4', parent_product: 'part_b', child_product: 'painted', quantity: 1 },
  { id: 'bom_5', parent_product: 'product_final', child_product: 'assy_a', quantity: 1 },
  { id: 'bom_6', parent_product: 'product_final', child_product: 'part_b', quantity: 1 },
];

const NODES = [
  // ── 材料倉庫 ──
  {
    id: 'store_material',
    type: 'store',
    position: { x: 50, y: 250 },
    data: {
      label: '材料倉庫',
      name: '材料倉庫',
      type: 'store',
      storeType: 'component',
      cycleTime: 5,
      equipmentCount: 1,
      capacity: 10000,
    },
  },

  // ── 切断工程: 高速(CT=10秒, 3台) ──
  // 検証: 高速工程が下流のボトルネックにどう影響するか
  {
    id: 'proc_cut',
    type: 'machining',
    position: { x: 250, y: 250 },
    data: {
      label: '切断（高速3台）',
      name: '切断（高速3台）',
      cycleTime: 10,
      setupTime: 30,
      equipmentCount: 3,
      operatorCount: 2,
      defectRate: 1.0,
      schedulingMode: 'push',
      batchSize: 10,
    },
  },

  // ── 塗装工程: 単一障害点(CT=30秒, 1台, 不良率8%) ──
  // 検証: 1台で2ライン供給 + 高不良率の影響
  {
    id: 'proc_paint',
    type: 'machining',
    position: { x: 500, y: 250 },
    data: {
      label: '塗装（1台,不良8%）',
      name: '塗装（1台,不良8%）',
      cycleTime: 30,
      setupTime: 60,
      equipmentCount: 1,
      operatorCount: 1,
      defectRate: 8.0, // 高不良率
      schedulingMode: 'push',
      batchSize: 5,
    },
  },

  // ── 分岐ライン A: 量産型組立(CT=60秒, 2台) ──
  // 検証: 分岐フロー上側
  {
    id: 'proc_assy_a',
    type: 'assembly',
    position: { x: 750, y: 120 },
    data: {
      label: '組立A（量産型）',
      name: '組立A（量産型）',
      cycleTime: 60,
      setupTime: 20,
      equipmentCount: 2,
      operatorCount: 3,
      defectRate: 0.5,
      schedulingMode: 'pull',
      batchSize: 5,
    },
  },

  // ── 分岐ライン B: 精密加工(CT=180秒, 1台) ──
  // 検証: 極端に遅い工程(CT=180秒)の影響
  {
    id: 'proc_precision_b',
    type: 'machining',
    position: { x: 750, y: 380 },
    data: {
      label: '精密加工B（低速1台）',
      name: '精密加工B（低速1台）',
      cycleTime: 180,
      setupTime: 300, // 長い段取り
      equipmentCount: 1,
      operatorCount: 1,
      defectRate: 2.0,
      schedulingMode: 'pull',
      batchSize: 1,
    },
  },

  // ── 検査A(CT=15秒, 1台) ──
  {
    id: 'proc_inspect_a',
    type: 'inspection',
    position: { x: 1000, y: 120 },
    data: {
      label: '検査A（高速）',
      name: '検査A（高速）',
      cycleTime: 15,
      setupTime: 5,
      equipmentCount: 1,
      operatorCount: 1,
      defectRate: 0,
      schedulingMode: 'push',
      batchSize: 5,
    },
  },

  // ── 検査B(CT=20秒, 1台) ──
  {
    id: 'proc_inspect_b',
    type: 'inspection',
    position: { x: 1000, y: 380 },
    data: {
      label: '検査B',
      name: '検査B',
      cycleTime: 20,
      setupTime: 5,
      equipmentCount: 1,
      operatorCount: 1,
      defectRate: 0,
      schedulingMode: 'push',
      batchSize: 1,
    },
  },

  // ── 梱包: 合流工程(CT=40秒, 2台) ──
  // 検証: A+Bの合流、異なる速度のライン合流の影響
  {
    id: 'proc_pack',
    type: 'assembly',
    position: { x: 1250, y: 250 },
    data: {
      label: '梱包（合流2台）',
      name: '梱包（合流2台）',
      cycleTime: 40,
      setupTime: 10,
      equipmentCount: 2,
      operatorCount: 2,
      defectRate: 0,
      schedulingMode: 'push',
      batchSize: 1,
    },
  },

  // ── 出荷倉庫 ──
  {
    id: 'store_ship',
    type: 'store',
    position: { x: 1500, y: 250 },
    data: {
      label: '出荷倉庫',
      name: '出荷倉庫',
      type: 'store',
      storeType: 'finished_product',
      cycleTime: 5,
      equipmentCount: 1,
      capacity: 1000,
    },
  },
];

const EDGES = [
  // 材料倉庫 → 切断（大ロット搬送: 20個）
  { id: 'v_e1', source: 'store_material', target: 'proc_cut',
    type: 'smoothstep', animated: true,
    data: { transportTime: 5, transportLotSize: 20, transportType: 'agv', distance: 15 } },

  // 切断 → 塗装（中ロット: 5個）
  { id: 'v_e2', source: 'proc_cut', target: 'proc_paint',
    type: 'smoothstep', animated: true,
    data: { transportTime: 10, transportLotSize: 5, transportType: 'conveyor', distance: 10 } },

  // ── 分岐: 塗装 → 組立A（小ロット: 2個）──
  { id: 'v_e3', source: 'proc_paint', target: 'proc_assy_a',
    type: 'smoothstep', animated: true,
    data: { transportTime: 8, transportLotSize: 2, transportType: 'agv', distance: 12 } },

  // ── 分岐: 塗装 → 精密加工B（1個搬送）──
  { id: 'v_e4', source: 'proc_paint', target: 'proc_precision_b',
    type: 'smoothstep', animated: true,
    data: { transportTime: 15, transportLotSize: 1, transportType: 'manual', distance: 20 } },

  // 組立A → 検査A（5個搬送）
  { id: 'v_e5', source: 'proc_assy_a', target: 'proc_inspect_a',
    type: 'smoothstep', animated: true,
    data: { transportTime: 5, transportLotSize: 5, transportType: 'conveyor', distance: 8 } },

  // 精密加工B → 検査B（1個搬送）
  { id: 'v_e6', source: 'proc_precision_b', target: 'proc_inspect_b',
    type: 'smoothstep', animated: true,
    data: { transportTime: 5, transportLotSize: 1, transportType: 'manual', distance: 8 } },

  // ── 合流: 検査A → 梱包 ──
  { id: 'v_e7', source: 'proc_inspect_a', target: 'proc_pack',
    type: 'smoothstep', animated: true,
    data: { transportTime: 8, transportLotSize: 1, transportType: 'conveyor', distance: 10 } },

  // ── 合流: 検査B → 梱包 ──
  { id: 'v_e8', source: 'proc_inspect_b', target: 'proc_pack',
    type: 'smoothstep', animated: true,
    data: { transportTime: 8, transportLotSize: 1, transportType: 'agv', distance: 10 } },

  // 梱包 → 出荷倉庫（1個搬送）
  { id: 'v_e9', source: 'proc_pack', target: 'store_ship',
    type: 'smoothstep', animated: true,
    data: { transportTime: 10, transportLotSize: 1, transportType: 'manual', distance: 12 } },
];

// ========== 初期化関数 ==========
export function initializeVerificationProject() {
  const networkData = {
    nodes: NODES,
    edges: EDGES,
    products: PRODUCTS,
    bom_items: BOM_ITEMS,
    variants: [],
    process_advanced_data: {},
  };

  // localStorageに保存
  const existingProjects = JSON.parse(localStorage.getItem('projects') || '[]');
  const filtered = existingProjects.filter((p: any) => p.id !== VERIFY_PROJECT.id);
  filtered.push(VERIFY_PROJECT);
  localStorage.setItem('projects', JSON.stringify(filtered));
  localStorage.setItem(`project_${VERIFY_PROJECT.id}_network`, JSON.stringify(networkData));

  return { project: VERIFY_PROJECT, networkData };
}

// ========== 期待される検証結果 ==========
export const EXPECTED_RESULTS = `
検証ポイントと期待値（1時間シミュレーション）:

1. 【切断工程】CT=10秒, 3台 → 理論最大: 1080個/h
   ・下流の塗装(120個/h)がボトルネックのため、大幅に余剰
   ・稼働率は低くなるはず（材料はあるが出力バッファが溜まる）

2. 【塗装工程】CT=30秒, 1台, 不良率8%
   ・理論最大: 120個/h（ただし8%不良 → 有効110個/h）
   ・ここがシステム全体のボトルネック
   ・稼働率100%近くになるはず
   ・不良数: 約9〜10個/h

3. 【分岐フロー】塗装出力が2ラインに分配
   ・搬送ロットサイズ: A=2個, B=1個
   ・Aラインに多く、Bラインに少なく流れるはず
   ・塗装OUT在庫の蓄積パターンを確認

4. 【組立A】CT=60秒, 2台 → 理論最大: 120個/h
   ・塗装から供給される量に依存
   ・稼働率は中程度のはず

5. 【精密加工B】CT=180秒, 1台 → 理論最大: 20個/h
   ・非常に遅い工程、前に在庫が溜まるはず
   ・稼働率は高くなるはず（常に材料あり）

6. 【合流→梱包】A検査+B検査 → 梱包(CT=40秒, 2台)
   ・2ラインの速度差がある合流
   ・Aラインからの供給が主、Bラインはたまに
   ・梱包の稼働率で合流効率を確認

7. 【不良率の影響】塗装8%不良
   ・total_defects > 0 を確認
   ・品質率 < 100% を確認
   ・最終的な完成品数への影響を確認
`;
