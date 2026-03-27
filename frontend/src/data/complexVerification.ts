/**
 * 検証D: 複雑工程 - 自動車ECU製造ライン
 *
 * 4つの材料供給ライン → 複数の合流点 → 最終組立 → 検査2段 → 出荷
 *
 * ┌─[材料A]→[プレス4台CT8]→[バリ取2台CT12]─┐
 * │                                          ├→[溶接2台CT25]→[塗装1台CT35,不良5%]─┐
 * ├─[材料B]→[旋盤2台CT20]→[研磨3台CT10]───┘                                      │
 * │                                                                                 ├→[最終組立3台CT90]
 * ├─[材料C]→[SMT1台CT40]→[基板検査2台CT15]→[ﾌｧｰﾑ書込1台CT30]─────────────────┤
 * │                                                                                 │
 * └─[材料D]→[樹脂成形2台CT18]→[印刷1台CT25,不良3%]────────────────────────────┘
 *                                                                                    ↓
 *                                                          [機能検査2台CT45]→[外観検査1台CT20]
 *                                                                                    ↓
 *                                                                    [梱包2台CT30]→[出荷倉庫]
 *
 * 検証ポイント:
 * - 4ライン並列供給 → 最終組立への合流
 * - 2段階の合流（溶接で2ライン合流、最終組立で4ライン合流）
 * - 不良率: 塗装5%, 印刷3%
 * - ボトルネック候補: SMT(1台CT40), 塗装(1台CT35), ファーム書込(1台CT30)
 * - 12工程、4倉庫、16接続
 * - 最大直列深さ: 6工程
 */

export const VERIFY_D = {
  project: {
    id: 'verify_d',
    name: '検証D: 自動車ECU製造ライン（12工程4ライン合流）',
    description:
      '4つの並列ラインが最終組立に合流する複雑な製造ライン。' +
      'プレス+旋盤→溶接→塗装、SMT→基板検査→FW書込、樹脂成形→印刷 の4系統。' +
      '12工程、16搬送、不良率2箇所(塗装5%,印刷3%)',
    category: 'manufacturing',
    tags: ['検証', '複雑', '4ライン合流', 'ECU', '12工程'],
    status: 'active', version: '1.0.0', createdBy: 'system',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  networkData: {
    nodes: [
      // ═══ 材料倉庫 ═══
      { id: 'mat_a', type: 'store', position: { x: 30, y: 80 },
        data: { label: '材料A(金属板)', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 10000 }},
      { id: 'mat_b', type: 'store', position: { x: 30, y: 220 },
        data: { label: '材料B(丸棒)', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 10000 }},
      { id: 'mat_c', type: 'store', position: { x: 30, y: 420 },
        data: { label: '材料C(基板)', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 5000 }},
      { id: 'mat_d', type: 'store', position: { x: 30, y: 580 },
        data: { label: '材料D(樹脂)', type: 'store', storeType: 'component', cycleTime: 5, equipmentCount: 1, capacity: 8000 }},

      // ═══ ラインA: 金属板加工 ═══
      { id: 'press', type: 'machining', position: { x: 230, y: 80 },
        data: { label: 'プレス(4台,CT8)', cycleTime: 8, setupTime: 45, equipmentCount: 4, operatorCount: 2, defectRate: 0.5 }},
      { id: 'deburr', type: 'machining', position: { x: 430, y: 80 },
        data: { label: 'バリ取り(2台,CT12)', cycleTime: 12, setupTime: 10, equipmentCount: 2, operatorCount: 2, defectRate: 0.3 }},

      // ═══ ラインB: 丸棒加工 ═══
      { id: 'lathe', type: 'machining', position: { x: 230, y: 220 },
        data: { label: '旋盤(2台,CT20)', cycleTime: 20, setupTime: 60, equipmentCount: 2, operatorCount: 2, defectRate: 1.0 }},
      { id: 'grind', type: 'machining', position: { x: 430, y: 220 },
        data: { label: '研磨(3台,CT10)', cycleTime: 10, setupTime: 15, equipmentCount: 3, operatorCount: 2, defectRate: 0.5 }},

      // ═══ A+B合流 → 溶接 → 塗装 ═══
      { id: 'weld', type: 'assembly', position: { x: 650, y: 150 },
        data: { label: '溶接(2台,CT25)', cycleTime: 25, setupTime: 30, equipmentCount: 2, operatorCount: 2, defectRate: 1.5 }},
      { id: 'paint', type: 'machining', position: { x: 870, y: 150 },
        data: { label: '塗装(1台,CT35,不良5%)', cycleTime: 35, setupTime: 90, equipmentCount: 1, operatorCount: 1, defectRate: 5.0 }},

      // ═══ ラインC: 基板実装 ═══
      { id: 'smt', type: 'machining', position: { x: 230, y: 420 },
        data: { label: 'SMT実装(1台,CT40)', cycleTime: 40, setupTime: 180, equipmentCount: 1, operatorCount: 1, defectRate: 0.8 }},
      { id: 'pcb_test', type: 'inspection', position: { x: 460, y: 420 },
        data: { label: '基板検査(2台,CT15)', cycleTime: 15, setupTime: 10, equipmentCount: 2, operatorCount: 1, defectRate: 0 }},
      { id: 'firmware', type: 'machining', position: { x: 690, y: 420 },
        data: { label: 'FW書込(1台,CT30)', cycleTime: 30, setupTime: 20, equipmentCount: 1, operatorCount: 1, defectRate: 0.2 }},

      // ═══ ラインD: 樹脂加工 ═══
      { id: 'mold', type: 'machining', position: { x: 230, y: 580 },
        data: { label: '樹脂成形(2台,CT18)', cycleTime: 18, setupTime: 120, equipmentCount: 2, operatorCount: 1, defectRate: 2.0 }},
      { id: 'print', type: 'machining', position: { x: 460, y: 580 },
        data: { label: '印刷(1台,CT25,不良3%)', cycleTime: 25, setupTime: 45, equipmentCount: 1, operatorCount: 1, defectRate: 3.0 }},

      // ═══ 最終工程 ═══
      { id: 'final_assy', type: 'assembly', position: { x: 1100, y: 350 },
        data: { label: '最終組立(3台,CT90)', cycleTime: 90, setupTime: 60, equipmentCount: 3, operatorCount: 5, defectRate: 0.5 }},
      { id: 'func_test', type: 'inspection', position: { x: 1330, y: 350 },
        data: { label: '機能検査(2台,CT45)', cycleTime: 45, setupTime: 15, equipmentCount: 2, operatorCount: 2, defectRate: 0 }},
      { id: 'visual', type: 'inspection', position: { x: 1530, y: 350 },
        data: { label: '外観検査(1台,CT20)', cycleTime: 20, setupTime: 5, equipmentCount: 1, operatorCount: 1, defectRate: 0 }},
      { id: 'pack', type: 'assembly', position: { x: 1730, y: 350 },
        data: { label: '梱包(2台,CT30)', cycleTime: 30, setupTime: 10, equipmentCount: 2, operatorCount: 2, defectRate: 0 }},

      // ═══ 出荷倉庫 ═══
      { id: 'ship', type: 'store', position: { x: 1930, y: 350 },
        data: { label: '出荷倉庫', type: 'store', storeType: 'finished_product', cycleTime: 5, equipmentCount: 1, capacity: 2000 }},
    ],

    edges: [
      // ── 材料供給 ──
      { id: 'd_e01', source: 'mat_a', target: 'press', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 10, transportType: 'agv', distance: 10 }},
      { id: 'd_e02', source: 'mat_b', target: 'lathe', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 5, transportType: 'agv', distance: 10 }},
      { id: 'd_e03', source: 'mat_c', target: 'smt', type: 'smoothstep', animated: true,
        data: { transportTime: 8, transportLotSize: 5, transportType: 'agv', distance: 15 }},
      { id: 'd_e04', source: 'mat_d', target: 'mold', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 10, transportType: 'agv', distance: 10 }},

      // ── ラインA: プレス → バリ取り ──
      { id: 'd_e05', source: 'press', target: 'deburr', type: 'smoothstep', animated: true,
        data: { transportTime: 3, transportLotSize: 2, transportType: 'conveyor', distance: 3 }},

      // ── ラインB: 旋盤 → 研磨 ──
      { id: 'd_e06', source: 'lathe', target: 'grind', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 2, transportType: 'conveyor', distance: 5 }},

      // ── A+B合流 → 溶接 ──
      { id: 'd_e07', source: 'deburr', target: 'weld', type: 'smoothstep', animated: true,
        data: { transportTime: 8, transportLotSize: 1, transportType: 'agv', distance: 10 }},
      { id: 'd_e08', source: 'grind', target: 'weld', type: 'smoothstep', animated: true,
        data: { transportTime: 8, transportLotSize: 1, transportType: 'agv', distance: 10 }},

      // ── 溶接 → 塗装 ──
      { id: 'd_e09', source: 'weld', target: 'paint', type: 'smoothstep', animated: true,
        data: { transportTime: 10, transportLotSize: 1, transportType: 'conveyor', distance: 8 }},

      // ── ラインC: SMT → 基板検査 → FW書込 ──
      { id: 'd_e10', source: 'smt', target: 'pcb_test', type: 'smoothstep', animated: true,
        data: { transportTime: 3, transportLotSize: 1, transportType: 'conveyor', distance: 3 }},
      { id: 'd_e11', source: 'pcb_test', target: 'firmware', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},

      // ── ラインD: 樹脂成形 → 印刷 ──
      { id: 'd_e12', source: 'mold', target: 'print', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 2, transportType: 'conveyor', distance: 5 }},

      // ── 4ライン合流 → 最終組立 ──
      { id: 'd_e13', source: 'paint', target: 'final_assy', type: 'smoothstep', animated: true,
        data: { transportTime: 12, transportLotSize: 1, transportType: 'agv', distance: 15 }},
      { id: 'd_e14', source: 'firmware', target: 'final_assy', type: 'smoothstep', animated: true,
        data: { transportTime: 10, transportLotSize: 1, transportType: 'agv', distance: 12 }},
      { id: 'd_e15', source: 'print', target: 'final_assy', type: 'smoothstep', animated: true,
        data: { transportTime: 15, transportLotSize: 1, transportType: 'agv', distance: 20 }},

      // ── 最終組立 → 機能検査 → 外観検査 → 梱包 → 出荷 ──
      { id: 'd_e16', source: 'final_assy', target: 'func_test', type: 'smoothstep', animated: true,
        data: { transportTime: 5, transportLotSize: 1, transportType: 'conveyor', distance: 5 }},
      { id: 'd_e17', source: 'func_test', target: 'visual', type: 'smoothstep', animated: true,
        data: { transportTime: 3, transportLotSize: 1, transportType: 'conveyor', distance: 3 }},
      { id: 'd_e18', source: 'visual', target: 'pack', type: 'smoothstep', animated: true,
        data: { transportTime: 3, transportLotSize: 1, transportType: 'conveyor', distance: 3 }},
      { id: 'd_e19', source: 'pack', target: 'ship', type: 'smoothstep', animated: true,
        data: { transportTime: 8, transportLotSize: 1, transportType: 'manual', distance: 8 }},
    ],

    products: [
      { id: 'steel_plate', name: '金属板', type: 'component', processing_time: 0 },
      { id: 'rod', name: '丸棒', type: 'component', processing_time: 0 },
      { id: 'pcb_raw', name: 'プリント基板', type: 'component', processing_time: 0 },
      { id: 'resin', name: '樹脂ペレット', type: 'component', processing_time: 0 },
      { id: 'pressed', name: 'プレス品', type: 'component', processing_time: 8 },
      { id: 'deburred', name: 'バリ取り品', type: 'component', processing_time: 12 },
      { id: 'turned', name: '旋盤品', type: 'component', processing_time: 20 },
      { id: 'ground', name: '研磨品', type: 'component', processing_time: 10 },
      { id: 'welded', name: '溶接品', type: 'sub_assembly', processing_time: 25 },
      { id: 'painted', name: '塗装品', type: 'sub_assembly', processing_time: 35 },
      { id: 'pcb_assy', name: '実装基板', type: 'sub_assembly', processing_time: 40 },
      { id: 'pcb_tested', name: '検査済基板', type: 'sub_assembly', processing_time: 15 },
      { id: 'pcb_fw', name: 'FW書込済基板', type: 'sub_assembly', processing_time: 30 },
      { id: 'molded', name: '成形品', type: 'component', processing_time: 18 },
      { id: 'printed_case', name: '印刷済ケース', type: 'component', processing_time: 25 },
      { id: 'ecu_unit', name: 'ECUユニット', type: 'finished_product', processing_time: 90 },
    ],

    bom_items: [
      { id: 'db1', parent_product: 'welded', child_product: 'deburred', quantity: 1 },
      { id: 'db2', parent_product: 'welded', child_product: 'ground', quantity: 1 },
      { id: 'db3', parent_product: 'painted', child_product: 'welded', quantity: 1 },
      { id: 'db4', parent_product: 'pcb_fw', child_product: 'pcb_tested', quantity: 1 },
      { id: 'db5', parent_product: 'ecu_unit', child_product: 'painted', quantity: 1 },
      { id: 'db6', parent_product: 'ecu_unit', child_product: 'pcb_fw', quantity: 1 },
      { id: 'db7', parent_product: 'ecu_unit', child_product: 'printed_case', quantity: 1 },
    ],

    variants: [],
    process_advanced_data: {},
  },
};

// 初期化
export function initializeComplexVerification() {
  const existing = JSON.parse(localStorage.getItem('projects') || '[]');
  const idx = existing.findIndex((p: any) => p.id === VERIFY_D.project.id);
  if (idx >= 0) {
    existing[idx] = VERIFY_D.project;
  } else {
    existing.push(VERIFY_D.project);
  }
  localStorage.setItem('projects', JSON.stringify(existing));
  localStorage.setItem(`project_${VERIFY_D.project.id}_network`, JSON.stringify(VERIFY_D.networkData));
  return VERIFY_D;
}
