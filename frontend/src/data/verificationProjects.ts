/**
 * 検証用プロジェクト群（工程材料設定付き）
 */

// ============================================================
// 検証A: 分岐・合流・不良率
// ============================================================
export const VERIFY_A = {
  project: {
    id: 'verify_a', name: '検証A: 分岐・合流・不良率',
    description: '分岐フロー、高不良率8%、ライン速度差(CT10~180)、合流の検証',
    category: 'manufacturing', tags: ['検証','分岐','合流','不良率'],
    status: 'active', version: '1.0.0', createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  networkData: {
    nodes: [
      { id: 's_mat', type: 'store', position: { x: 50, y: 250 },
        data: { label: '材料倉庫', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 10000,
          inputs: [], outputs: ['raw_steel'] }},
      { id: 'p_cut', type: 'machining', position: { x: 250, y: 250 },
        data: { label: '切断(3台,CT10)', cycleTime: 10, setupTime: 30, equipmentCount: 3, operatorCount: 2, defectRate: 1.0,
          inputs: ['raw_steel'], outputs: ['cut_part'],
          productSettings: [{ id: 'ps1', productId: 'cut_part', productName: '切断部品', cycleTime: 10, setupTime: 30, qualityRate: 99.0, isActive: true }] }},
      { id: 'p_paint', type: 'machining', position: { x: 480, y: 250 },
        data: { label: '塗装(1台,不良8%)', cycleTime: 30, setupTime: 60, equipmentCount: 1, operatorCount: 1, defectRate: 8.0,
          inputs: ['cut_part'], outputs: ['painted_part'],
          productSettings: [{ id: 'ps2', productId: 'painted_part', productName: '塗装品', cycleTime: 30, setupTime: 60, qualityRate: 92.0, isActive: true }] }},
      { id: 'p_assy_a', type: 'assembly', position: { x: 730, y: 120 },
        data: { label: '組立A(2台,CT60)', cycleTime: 60, setupTime: 20, equipmentCount: 2, operatorCount: 3, defectRate: 0.5,
          inputs: ['painted_part'], outputs: ['assy_a'],
          productSettings: [{ id: 'ps3', productId: 'assy_a', productName: '組立品A(量産型)', cycleTime: 60, setupTime: 20, qualityRate: 99.5, isActive: true }] }},
      { id: 'p_prec_b', type: 'machining', position: { x: 730, y: 380 },
        data: { label: '精密B(1台,CT180)', cycleTime: 180, setupTime: 0, equipmentCount: 1, operatorCount: 1, defectRate: 2.0,
          inputs: ['painted_part'], outputs: ['prec_b'],
          productSettings: [{ id: 'ps4', productId: 'prec_b', productName: '精密加工品B', cycleTime: 180, setupTime: 0, qualityRate: 98.0, isActive: true }] }},
      { id: 'p_insp_a', type: 'inspection', position: { x: 980, y: 120 },
        data: { label: '検査A(CT15)', cycleTime: 15, setupTime: 5, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['assy_a'], outputs: ['assy_a'],
          productSettings: [{ id: 'ps5', productId: 'assy_a', productName: '組立品A(検査済)', cycleTime: 15, setupTime: 5, qualityRate: 100, isActive: true }] }},
      { id: 'p_insp_b', type: 'inspection', position: { x: 980, y: 380 },
        data: { label: '検査B(CT20)', cycleTime: 20, setupTime: 5, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['prec_b'], outputs: ['prec_b'],
          productSettings: [{ id: 'ps6', productId: 'prec_b', productName: '精密品B(検査済)', cycleTime: 20, setupTime: 5, qualityRate: 100, isActive: true }] }},
      { id: 'p_pack', type: 'assembly', position: { x: 1230, y: 250 },
        data: { label: '梱包(2台,CT40)', cycleTime: 40, setupTime: 10, equipmentCount: 2, operatorCount: 2, defectRate: 0,
          inputs: ['assy_a', 'prec_b'], outputs: ['packed_product'],
          productSettings: [{ id: 'ps7', productId: 'packed_product', productName: '梱包品', cycleTime: 40, setupTime: 10, qualityRate: 100, isActive: true }] }},
      { id: 's_ship', type: 'store', position: { x: 1480, y: 250 },
        data: { label: '出荷倉庫', type: 'store', storeType: 'finished_product', cycleTime: 5, equipmentCount: 1, capacity: 1000,
          inputs: ['packed_product'], outputs: [] }},
    ],
    edges: [
      { id: 'a_e1', source: 's_mat', target: 'p_cut', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 20, transportType: 'agv', distance: 15 }},
      { id: 'a_e2', source: 'p_cut', target: 'p_paint', type: 'smoothstep', animated: true, data: { transportTime: 10, transportLotSize: 5, transportType: 'conveyor', distance: 10 }},
      { id: 'a_e3', source: 'p_paint', target: 'p_assy_a', type: 'smoothstep', animated: true, data: { transportTime: 8, transportLotSize: 1, transportType: 'agv', distance: 12 }},
      { id: 'a_e4', source: 'p_paint', target: 'p_prec_b', type: 'smoothstep', animated: true, data: { transportTime: 15, transportLotSize: 1, transportType: 'manual', distance: 20 }},
      { id: 'a_e5', source: 'p_assy_a', target: 'p_insp_a', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 8 }},
      { id: 'a_e6', source: 'p_prec_b', target: 'p_insp_b', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'manual', distance: 8 }},
      { id: 'a_e7', source: 'p_insp_a', target: 'p_pack', type: 'smoothstep', animated: true, data: { transportTime: 8, transportLotSize: 1, transportType: 'conveyor', distance: 10 }},
      { id: 'a_e8', source: 'p_insp_b', target: 'p_pack', type: 'smoothstep', animated: true, data: { transportTime: 8, transportLotSize: 1, transportType: 'agv', distance: 10 }},
      { id: 'a_e9', source: 'p_pack', target: 's_ship', type: 'smoothstep', animated: true, data: { transportTime: 10, transportLotSize: 1, transportType: 'manual', distance: 12 }},
    ],
    products: [
      { id: 'raw_steel', name: '鋼材', type: 'component', processing_time: 0 },
      { id: 'cut_part', name: '切断部品', type: 'component', processing_time: 10 },
      { id: 'painted_part', name: '塗装品', type: 'component', processing_time: 30 },
      { id: 'assy_a', name: '組立品A(量産型)', type: 'sub_assembly', processing_time: 60 },
      { id: 'prec_b', name: '精密加工品B', type: 'sub_assembly', processing_time: 180 },
      { id: 'packed_product', name: '梱包品', type: 'finished_product', processing_time: 40 },
    ],
    bom_items: [
      { id: 'ab1', parent_product: 'cut_part', child_product: 'raw_steel', quantity: 1 },
      { id: 'ab2', parent_product: 'painted_part', child_product: 'cut_part', quantity: 1 },
      { id: 'ab3', parent_product: 'assy_a', child_product: 'painted_part', quantity: 2 },
      { id: 'ab4', parent_product: 'prec_b', child_product: 'painted_part', quantity: 1 },
      { id: 'ab5', parent_product: 'packed_product', child_product: 'assy_a', quantity: 1 },
      { id: 'ab6', parent_product: 'packed_product', child_product: 'prec_b', quantity: 1 },
    ],
    variants: [], process_advanced_data: {},
  },
};

// ============================================================
// 検証B: 直列5工程ライン均衡
// ============================================================
export const VERIFY_B = {
  project: {
    id: 'verify_b', name: '検証B: 直列5工程ライン均衡',
    description: '5工程直列。工程2(CT50s,1台)がボトルネック。他工程の待ち時間・稼働率差を検証',
    category: 'manufacturing', tags: ['検証','直列','ライン均衡','ボトルネック'],
    status: 'active', version: '1.0.0', createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  networkData: {
    nodes: [
      { id: 's_in', type: 'store', position: { x: 50, y: 200 },
        data: { label: '材料倉庫', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 10000,
          inputs: [], outputs: ['raw_material'] }},
      { id: 'p1', type: 'machining', position: { x: 250, y: 200 },
        data: { label: '工程1:切断(2台,CT20)', cycleTime: 20, setupTime: 10, equipmentCount: 2, operatorCount: 2, defectRate: 0.5,
          inputs: ['raw_material'], outputs: ['cut_piece'],
          productSettings: [{ id: 'b_ps1', productId: 'cut_piece', productName: '切断品', cycleTime: 20, setupTime: 10, qualityRate: 99.5, isActive: true }] }},
      { id: 'p2', type: 'machining', position: { x: 480, y: 200 },
        data: { label: '工程2:旋盤(1台,CT50)★BN', cycleTime: 50, setupTime: 0, equipmentCount: 1, operatorCount: 1, defectRate: 1.0,
          inputs: ['cut_piece'], outputs: ['turned_piece'],
          productSettings: [{ id: 'b_ps2', productId: 'turned_piece', productName: '旋盤加工品', cycleTime: 50, setupTime: 0, qualityRate: 99.0, isActive: true }] }},
      { id: 'p3', type: 'assembly', position: { x: 710, y: 200 },
        data: { label: '工程3:組付(3台,CT30)', cycleTime: 30, setupTime: 15, equipmentCount: 3, operatorCount: 3, defectRate: 0.3,
          inputs: ['turned_piece'], outputs: ['assembled'],
          productSettings: [{ id: 'b_ps3', productId: 'assembled', productName: '組付品', cycleTime: 30, setupTime: 15, qualityRate: 99.7, isActive: true }] }},
      { id: 'p4', type: 'machining', position: { x: 940, y: 200 },
        data: { label: '工程4:仕上(2台,CT40)', cycleTime: 40, setupTime: 20, equipmentCount: 2, operatorCount: 2, defectRate: 0.5,
          inputs: ['assembled'], outputs: ['finished_piece'],
          productSettings: [{ id: 'b_ps4', productId: 'finished_piece', productName: '仕上品', cycleTime: 40, setupTime: 20, qualityRate: 99.5, isActive: true }] }},
      { id: 'p5', type: 'inspection', position: { x: 1170, y: 200 },
        data: { label: '工程5:検査(1台,CT15)', cycleTime: 15, setupTime: 5, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['finished_piece'], outputs: ['inspected'],
          productSettings: [{ id: 'b_ps5', productId: 'inspected', productName: '検査済完成品', cycleTime: 15, setupTime: 5, qualityRate: 100, isActive: true }] }},
      { id: 's_out', type: 'store', position: { x: 1400, y: 200 },
        data: { label: '完成品倉庫', type: 'store', storeType: 'finished_product', cycleTime: 5, equipmentCount: 1, capacity: 1000,
          inputs: ['inspected'], outputs: [] }},
    ],
    edges: [
      { id: 'b_e1', source: 's_in', target: 'p1', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 10, transportType: 'agv', distance: 10 }},
      { id: 'b_e2', source: 'p1', target: 'p2', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      { id: 'b_e3', source: 'p2', target: 'p3', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      { id: 'b_e4', source: 'p3', target: 'p4', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      { id: 'b_e5', source: 'p4', target: 'p5', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      { id: 'b_e6', source: 'p5', target: 's_out', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'manual', distance: 5 }},
    ],
    products: [
      { id: 'raw_material', name: '素材', type: 'component', processing_time: 0 },
      { id: 'cut_piece', name: '切断品', type: 'component', processing_time: 20 },
      { id: 'turned_piece', name: '旋盤加工品', type: 'component', processing_time: 50 },
      { id: 'assembled', name: '組付品', type: 'sub_assembly', processing_time: 30 },
      { id: 'finished_piece', name: '仕上品', type: 'sub_assembly', processing_time: 40 },
      { id: 'inspected', name: '検査済完成品', type: 'finished_product', processing_time: 15 },
    ],
    bom_items: [
      { id: 'bb1', parent_product: 'cut_piece', child_product: 'raw_material', quantity: 1 },
      { id: 'bb2', parent_product: 'turned_piece', child_product: 'cut_piece', quantity: 1 },
      { id: 'bb3', parent_product: 'assembled', child_product: 'turned_piece', quantity: 1 },
      { id: 'bb4', parent_product: 'finished_piece', child_product: 'assembled', quantity: 1 },
      { id: 'bb5', parent_product: 'inspected', child_product: 'finished_piece', quantity: 1 },
    ],
    variants: [], process_advanced_data: {},
  },
};

// ============================================================
// 検証C: 搬送ロットサイズ比較（1個 vs 10個）
// ============================================================
export const VERIFY_C = {
  project: {
    id: 'verify_c', name: '検証C: 搬送ロットサイズ比較（1個 vs 10個）',
    description: '同一工程構成の2ラインで搬送ロットサイズだけを変えて比較。ラインX=1個搬送、ラインY=10個搬送',
    category: 'manufacturing', tags: ['検証','搬送','ロットサイズ','比較'],
    status: 'active', version: '1.0.0', createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  networkData: {
    nodes: [
      { id: 's_mat_c', type: 'store', position: { x: 50, y: 250 },
        data: { label: '材料倉庫', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 10000,
          inputs: [], outputs: ['blank_x', 'blank_y'] }},
      // ── ラインX: 1個搬送 ──
      { id: 'px1', type: 'machining', position: { x: 300, y: 100 },
        data: { label: 'X:プレス加工(2台,CT30)', cycleTime: 30, setupTime: 0, equipmentCount: 2, operatorCount: 2, defectRate: 0,
          inputs: ['blank_x'], outputs: ['pressed_x'],
          productSettings: [{ id: 'cx1', productId: 'pressed_x', productName: 'X:プレス品', cycleTime: 30, setupTime: 0, qualityRate: 100, isActive: true }] }},
      { id: 'px2', type: 'assembly', position: { x: 580, y: 100 },
        data: { label: 'X:溶接組立(1台,CT45)', cycleTime: 45, setupTime: 0, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['pressed_x'], outputs: ['welded_x'],
          productSettings: [{ id: 'cx2', productId: 'welded_x', productName: 'X:溶接品', cycleTime: 45, setupTime: 0, qualityRate: 100, isActive: true }] }},
      { id: 'px3', type: 'inspection', position: { x: 860, y: 100 },
        data: { label: 'X:外観検査(1台,CT20)', cycleTime: 20, setupTime: 0, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['welded_x'], outputs: ['checked_x'],
          productSettings: [{ id: 'cx3', productId: 'checked_x', productName: 'X:検査済品', cycleTime: 20, setupTime: 0, qualityRate: 100, isActive: true }] }},
      // ── ラインY: 10個搬送 ──
      { id: 'py1', type: 'machining', position: { x: 300, y: 400 },
        data: { label: 'Y:プレス加工(2台,CT30)', cycleTime: 30, setupTime: 0, equipmentCount: 2, operatorCount: 2, defectRate: 0,
          inputs: ['blank_y'], outputs: ['pressed_y'],
          productSettings: [{ id: 'cy1', productId: 'pressed_y', productName: 'Y:プレス品', cycleTime: 30, setupTime: 0, qualityRate: 100, isActive: true }] }},
      { id: 'py2', type: 'assembly', position: { x: 580, y: 400 },
        data: { label: 'Y:溶接組立(1台,CT45)', cycleTime: 45, setupTime: 0, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['pressed_y'], outputs: ['welded_y'],
          productSettings: [{ id: 'cy2', productId: 'welded_y', productName: 'Y:溶接品', cycleTime: 45, setupTime: 0, qualityRate: 100, isActive: true }] }},
      { id: 'py3', type: 'inspection', position: { x: 860, y: 400 },
        data: { label: 'Y:外観検査(1台,CT20)', cycleTime: 20, setupTime: 0, equipmentCount: 1, operatorCount: 1, defectRate: 0,
          inputs: ['welded_y'], outputs: ['checked_y'],
          productSettings: [{ id: 'cy3', productId: 'checked_y', productName: 'Y:検査済品', cycleTime: 20, setupTime: 0, qualityRate: 100, isActive: true }] }},
      // ── 出荷 ──
      { id: 's_out_c', type: 'store', position: { x: 1140, y: 250 },
        data: { label: '出荷倉庫', type: 'store', storeType: 'finished_product', cycleTime: 5, equipmentCount: 1, capacity: 2000,
          inputs: ['checked_x', 'checked_y'], outputs: [] }},
    ],
    edges: [
      // ラインX: 全て1個搬送(CNV)
      { id: 'c_e1', source: 's_mat_c', target: 'px1', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      { id: 'c_e2', source: 'px1', target: 'px2', type: 'smoothstep', animated: true, data: { transportTime: 3, transportLotSize: 1, transportType: 'conveyor', distance: 3 }},
      { id: 'c_e3', source: 'px2', target: 'px3', type: 'smoothstep', animated: true, data: { transportTime: 3, transportLotSize: 1, transportType: 'conveyor', distance: 3 }},
      { id: 'c_e4', source: 'px3', target: 's_out_c', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      // ラインY: 全て10個搬送(AGV)
      { id: 'c_e5', source: 's_mat_c', target: 'py1', type: 'smoothstep', animated: true, data: { transportTime: 5, transportLotSize: 10, transportType: 'agv', distance: 5 }},
      { id: 'c_e6', source: 'py1', target: 'py2', type: 'smoothstep', animated: true, data: { transportTime: 10, transportLotSize: 10, transportType: 'agv', distance: 8 }},
      { id: 'c_e7', source: 'py2', target: 'py3', type: 'smoothstep', animated: true, data: { transportTime: 10, transportLotSize: 10, transportType: 'agv', distance: 8 }},
      { id: 'c_e8', source: 'py3', target: 's_out_c', type: 'smoothstep', animated: true, data: { transportTime: 10, transportLotSize: 10, transportType: 'agv', distance: 8 }},
    ],
    products: [
      { id: 'blank_x', name: 'X:素材', type: 'component', processing_time: 0 },
      { id: 'blank_y', name: 'Y:素材', type: 'component', processing_time: 0 },
      { id: 'pressed_x', name: 'X:プレス品', type: 'component', processing_time: 30 },
      { id: 'pressed_y', name: 'Y:プレス品', type: 'component', processing_time: 30 },
      { id: 'welded_x', name: 'X:溶接品', type: 'sub_assembly', processing_time: 45 },
      { id: 'welded_y', name: 'Y:溶接品', type: 'sub_assembly', processing_time: 45 },
      { id: 'checked_x', name: 'X:検査済品', type: 'finished_product', processing_time: 20 },
      { id: 'checked_y', name: 'Y:検査済品', type: 'finished_product', processing_time: 20 },
    ],
    bom_items: [
      { id: 'cb1', parent_product: 'pressed_x', child_product: 'blank_x', quantity: 1 },
      { id: 'cb2', parent_product: 'welded_x', child_product: 'pressed_x', quantity: 1 },
      { id: 'cb3', parent_product: 'checked_x', child_product: 'welded_x', quantity: 1 },
      { id: 'cb4', parent_product: 'pressed_y', child_product: 'blank_y', quantity: 1 },
      { id: 'cb5', parent_product: 'welded_y', child_product: 'pressed_y', quantity: 1 },
      { id: 'cb6', parent_product: 'checked_y', child_product: 'welded_y', quantity: 1 },
    ],
    variants: [], process_advanced_data: {},
  },
};

// ============================================================
// 全検証プロジェクトを初期化
// ============================================================
export function initializeAllVerificationProjects() {
  const projects = [VERIFY_A, VERIFY_B, VERIFY_C];
  const existing = JSON.parse(localStorage.getItem('projects') || '[]');
  for (const v of projects) {
    const idx = existing.findIndex((p: any) => p.id === v.project.id);
    if (idx >= 0) { existing[idx] = v.project; } else { existing.push(v.project); }
    localStorage.setItem(`project_${v.project.id}_network`, JSON.stringify(v.networkData));
  }
  localStorage.setItem('projects', JSON.stringify(existing));
  return projects.length;
}
