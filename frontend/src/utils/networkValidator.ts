// ネットワーク構造の検証ユーティリティ

import { ProcessNodeData, ConnectionData } from '../types/networkEditor';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'cycle' | 'disconnected' | 'missing_input' | 'missing_output' | 'invalid_connection' | 'missing_end' | 'invalid_end' | 'multiple_ends';
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  type: 'optimization' | 'performance' | 'layout';
  message: string;
  nodeIds?: string[];
  suggestions?: string[];
}

export interface NetworkNode {
  id: string;
  data: ProcessNodeData;
  position: { x: number; y: number };
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  data: ConnectionData;
}

/**
 * ネットワーク全体の検証を実行
 */
export const validateNetwork = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. 循環参照の検出
  const cycleErrors = detectCycles(nodes, edges);
  errors.push(...cycleErrors);

  // 2. 未接続ノードの検出
  const disconnectedErrors = detectDisconnectedNodes(nodes, edges);
  errors.push(...disconnectedErrors);

  // 3. 入出力の整合性チェック
  const ioErrors = validateInputOutputConsistency(nodes, edges);
  errors.push(...ioErrors);

  // 4. デッドエンドの検出
  const deadEndWarnings = detectDeadEnds(nodes, edges);
  warnings.push(...deadEndWarnings);

  // 5. ボトルネックの検出
  const bottleneckWarnings = detectBottlenecks(nodes, edges);
  warnings.push(...bottleneckWarnings);

  // 6. レイアウトの問題検出
  const layoutWarnings = detectLayoutIssues(nodes, edges);
  warnings.push(...layoutWarnings);

  // 7. ストアが最後にあることの確認
  const storeEndErrors = validateStoreAtEnd(nodes, edges);
  errors.push(...storeEndErrors);

  // 8. シミュレーション設定の検証
  const simErrors = validateSimulationSettings(nodes, edges);
  errors.push(...simErrors);

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    warnings,
  };
};

/**
 * シミュレーション設定の完全性を検証
 */
const validateSimulationSettings = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const processTypes = ['machining', 'assembly', 'inspection', 'kitting', 'shipping', 'process'];

  for (const node of nodes) {
    const d = node.data;
    const effectiveType = d.type || 'process';
    if (!processTypes.includes(effectiveType)) continue;

    // CT チェック
    if (!d.cycleTime || d.cycleTime <= 0) {
      errors.push({ type: 'missing_input', severity: 'error',
        message: `${d.label}: サイクルタイムが未設定です`, nodeIds: [node.id] });
    }
    // 設備台数チェック
    if (!d.equipmentCount || d.equipmentCount <= 0) {
      errors.push({ type: 'missing_input', severity: 'error',
        message: `${d.label}: 設備台数が未設定です`, nodeIds: [node.id] });
    }
    // inputs/outputs チェック
    if (!d.inputs || d.inputs.length === 0) {
      errors.push({ type: 'missing_input', severity: 'warning' as any,
        message: `${d.label}: 投入材料(inputs)が未設定です`, nodeIds: [node.id] });
    }
    if (!d.outputs || d.outputs.length === 0) {
      errors.push({ type: 'missing_output', severity: 'warning' as any,
        message: `${d.label}: 出力製品(outputs)が未設定です`, nodeIds: [node.id] });
    }
    // inputMaterials チェック（詳細材料設定）
    if (!d.inputMaterials || d.inputMaterials.length === 0) {
      errors.push({ type: 'missing_input', severity: 'warning' as any,
        message: `${d.label}: 工程材料設定(inputMaterials)が未設定です。右クリック→材料設定で設定してください`, nodeIds: [node.id] });
    } else {
      // 各材料のバッファ設定チェック
      for (const im of d.inputMaterials) {
        if (!im.bufferSettings) {
          errors.push({ type: 'missing_input', severity: 'warning' as any,
            message: `${d.label}: ${im.materialName || im.materialId}のバッファ設定が未設定です`, nodeIds: [node.id] });
        }
      }
    }
    // outputProducts チェック
    if (!d.outputProducts || d.outputProducts.length === 0) {
      errors.push({ type: 'missing_output', severity: 'warning' as any,
        message: `${d.label}: 出力製品の詳細設定(outputProducts)が未設定です`, nodeIds: [node.id] });
    }
    // バッファ容量チェック
    if (!d.inputBufferCapacity && (!d.inputMaterials || d.inputMaterials.length === 0)) {
      errors.push({ type: 'missing_input', severity: 'warning' as any,
        message: `${d.label}: 入力バッファ容量が未設定（無制限になります）`, nodeIds: [node.id] });
    }
  }

  // 搬送設定チェック
  for (const edge of edges) {
    const ed = edge.data;
    if (!ed) {
      errors.push({ type: 'invalid_connection', severity: 'warning' as any,
        message: `接続 ${edge.source}→${edge.target}: 搬送設定がありません`, edgeIds: [edge.id] });
      continue;
    }
    if (!ed.transportTime || ed.transportTime <= 0) {
      errors.push({ type: 'invalid_connection', severity: 'warning' as any,
        message: `接続 ${edge.source}→${edge.target}: 搬送時間が未設定です`, edgeIds: [edge.id] });
    }
    const methods = (ed as any).transportMethods || [];
    if (methods.length === 0) {
      errors.push({ type: 'invalid_connection', severity: 'warning' as any,
        message: `接続 ${edge.source}→${edge.target}: 搬送手段が未設定です`, edgeIds: [edge.id] });
    } else {
      for (const m of methods) {
        if (!m.transportProducts || m.transportProducts.length === 0) {
          errors.push({ type: 'invalid_connection', severity: 'warning' as any,
            message: `接続 ${edge.source}→${edge.target}: 搬送製品が未設定です（${m.name}）`, edgeIds: [edge.id] });
        }
      }
    }
  }

  return errors;
};

/**
 * 循環参照（サイクル）の検出
 */
export const detectCycles = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const adjacencyList = buildAdjacencyList(nodes, edges);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  const dfs = (nodeId: string, path: string[]): void => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // サイクル発見
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor); // サイクルを閉じる
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(nodeId);
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  // 重複するサイクルを除去
  const uniqueCycles = removeDuplicateCycles(cycles);

  for (const cycle of uniqueCycles) {
    const nodeNames = cycle.map(id => 
      nodes.find(n => n.id === id)?.data.label || id
    ).join(' → ');

    errors.push({
      type: 'cycle',
      severity: 'error',
      message: `循環参照が検出されました: ${nodeNames}`,
      nodeIds: cycle,
    });
  }

  return errors;
};

/**
 * 未接続ノードの検出
 */
export const detectDisconnectedNodes = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const connectedNodes = new Set<string>();

  // エッジで接続されているノードを記録
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }

  // 未接続ノードを検出
  for (const node of nodes) {
    if (!connectedNodes.has(node.id)) {
      errors.push({
        type: 'disconnected',
        severity: 'warning',
        message: `未接続の工程: ${node.data.label}`,
        nodeIds: [node.id],
      });
    }
  }

  return errors;
};

/**
 * 入出力の整合性チェック
 */
export const validateInputOutputConsistency = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  for (const node of nodes) {
    const incomingEdges = edges.filter(e => e.target === node.id);
    const outgoingEdges = edges.filter(e => e.source === node.id);

    // 入力がない工程（開始工程以外）
    if (incomingEdges.length === 0 && node.data.type !== 'storage') {
      if (outgoingEdges.length > 0) { // 出力があるのに入力がない
        errors.push({
          type: 'missing_input',
          severity: 'warning',
          message: `開始工程と思われます: ${node.data.label}（入力接続がありません）`,
          nodeIds: [node.id],
        });
      }
    }

    // 出力がない工程（終了工程以外）
    if (outgoingEdges.length === 0 && node.data.type !== 'store') {
      if (incomingEdges.length > 0) { // 入力があるのに出力がない
        errors.push({
          type: 'missing_output',
          severity: 'warning',
          message: `終了工程と思われます: ${node.data.label}（出力接続がありません）`,
          nodeIds: [node.id],
        });
      }
    }
  }

  return errors;
};

/**
 * デッドエンド（行き止まり）の検出
 */
export const detectDeadEnds = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  const reachableFromStart = new Set<string>();

  // 開始ノード（入力がないノード）を特定
  const startNodes = nodes.filter(node => {
    const hasInput = edges.some(edge => edge.target === node.id);
    return !hasInput;
  });

  // 開始ノードから到達可能なノードをDFSで探索
  const dfs = (nodeId: string) => {
    if (reachableFromStart.has(nodeId)) return;
    reachableFromStart.add(nodeId);

    const outgoingEdges = edges.filter(e => e.source === nodeId);
    for (const edge of outgoingEdges) {
      dfs(edge.target);
    }
  };

  for (const startNode of startNodes) {
    dfs(startNode.id);
  }

  // 到達不可能なノードを検出
  for (const node of nodes) {
    if (!reachableFromStart.has(node.id) && startNodes.length > 0) {
      warnings.push({
        type: 'optimization',
        message: `到達不可能な工程: ${node.data.label}`,
        nodeIds: [node.id],
        suggestions: ['開始工程からの接続を確認してください'],
      });
    }
  }

  return warnings;
};

/**
 * ボトルネックの検出
 */
export const detectBottlenecks = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const node of nodes) {
    const incomingEdges = edges.filter(e => e.target === node.id);
    const outgoingEdges = edges.filter(e => e.source === node.id);

    // 複数の入力を持つ工程（合流点）
    if (incomingEdges.length > 2) {
      warnings.push({
        type: 'performance',
        message: `ボトルネックの可能性: ${node.data.label}（${incomingEdges.length}つの入力）`,
        nodeIds: [node.id],
        suggestions: [
          '処理能力の向上を検討してください',
          'バッファ容量の増加を検討してください',
        ],
      });
    }

    // 処理時間が長い工程
    if (node.data.cycleTime > 300) { // 5分以上
      warnings.push({
        type: 'performance',
        message: `処理時間が長い工程: ${node.data.label}（${node.data.cycleTime}秒）`,
        nodeIds: [node.id],
        suggestions: [
          '設備台数の増加を検討してください',
          '作業の並列化を検討してください',
        ],
      });
    }
  }

  return warnings;
};

/**
 * レイアウトの問題検出
 */
export const detectLayoutIssues = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  // ノード同士の重なりチェック
  const nodeOverlaps = detectNodeOverlaps(nodes);
  warnings.push(...nodeOverlaps);

  // 交差する接続線の検出
  const crossingEdges = detectCrossingEdges(nodes, edges);
  warnings.push(...crossingEdges);

  // 逆流の検出（右から左への接続）
  const backflowEdges = detectBackflow(nodes, edges);
  warnings.push(...backflowEdges);

  return warnings;
};

/**
 * ユーティリティ関数群
 */

const buildAdjacencyList = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): Map<string, string[]> => {
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }

  for (const edge of edges) {
    const neighbors = adjacencyList.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacencyList.set(edge.source, neighbors);
  }

  return adjacencyList;
};

const removeDuplicateCycles = (cycles: string[][]): string[][] => {
  const uniqueCycles: string[][] = [];
  const seen = new Set<string>();

  for (const cycle of cycles) {
    // サイクルを正規化（最小要素から開始）
    const minIndex = cycle.indexOf(Math.min(...cycle.map(id => parseInt(id.split('_')[1] || '0'))).toString());
    const normalized = cycle.slice(minIndex).concat(cycle.slice(0, minIndex));
    const key = normalized.join('-');

    if (!seen.has(key)) {
      seen.add(key);
      uniqueCycles.push(cycle);
    }
  }

  return uniqueCycles;
};

const detectNodeOverlaps = (nodes: NetworkNode[]): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  const nodeSize = { width: 200, height: 100 }; // 概算のノードサイズ

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];

      const dx = Math.abs(node1.position.x - node2.position.x);
      const dy = Math.abs(node1.position.y - node2.position.y);

      if (dx < nodeSize.width && dy < nodeSize.height) {
        warnings.push({
          type: 'layout',
          message: `工程の重なり: ${node1.data.label} と ${node2.data.label}`,
          nodeIds: [node1.id, node2.id],
          suggestions: ['工程の位置を調整してください'],
        });
      }
    }
  }

  return warnings;
};

const detectCrossingEdges = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  // 簡略化した交差検出（実装は複雑になるため基本的なケースのみ）

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const edge1 = edges[i];
      const edge2 = edges[j];

      // 異なるエッジで、共通のノードを持たない場合のみチェック
      if (edge1.source !== edge2.source && edge1.target !== edge2.target &&
          edge1.source !== edge2.target && edge1.target !== edge2.source) {
        
        const node1s = nodes.find(n => n.id === edge1.source);
        const node1t = nodes.find(n => n.id === edge1.target);
        const node2s = nodes.find(n => n.id === edge2.source);
        const node2t = nodes.find(n => n.id === edge2.target);

        if (node1s && node1t && node2s && node2t) {
          // 簡易的な交差判定（詳細な幾何学的計算は省略）
          const crosses = doLinesIntersect(
            node1s.position, node1t.position,
            node2s.position, node2t.position
          );

          if (crosses) {
            warnings.push({
              type: 'layout',
              message: `接続線の交差が発生しています`,
              suggestions: ['レイアウトの見直しを検討してください'],
            });
            break; // 一つ見つかったら十分
          }
        }
      }
    }
  }

  return warnings;
};

const detectBackflow = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  for (const edge of edges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (sourceNode && targetNode) {
      // 右から左への流れ（逆流）を検出
      if (sourceNode.position.x > targetNode.position.x + 50) { // 50px のマージン
        warnings.push({
          type: 'layout',
          message: `逆流の可能性: ${sourceNode.data.label} → ${targetNode.data.label}`,
          nodeIds: [edge.source, edge.target],
          suggestions: ['工程の配置順序を見直してください'],
        });
      }
    }
  }

  return warnings;
};

// 簡易的な線分交差判定
const doLinesIntersect = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean => {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (denominator === 0) return false; // 平行線

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

/**
 * ストアが最後にあることの確認
 */
export const validateStoreAtEnd = (
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // 出力がないノード（終了ノード）を特定
  const endNodes = nodes.filter(node => {
    const outgoingEdges = edges.filter(e => e.source === node.id);
    return outgoingEdges.length === 0;
  });

  // 終了ノードが存在しない場合
  if (endNodes.length === 0) {
    errors.push({
      type: 'missing_end',
      severity: 'error',
      message: 'ネットワークに終了工程がありません。ストアを最後に配置してください。',
      nodeIds: [],
    });
    return errors;
  }

  // 終了ノードの中にストアが含まれているかチェック
  const hasStoreAtEnd = endNodes.some(node => node.data.type === 'store');

  if (!hasStoreAtEnd) {
    const endNodeNames = endNodes.map(node => node.data.label).join(', ');
    errors.push({
      type: 'invalid_end',
      severity: 'error',
      message: `終了工程にストアが含まれていません。現在の終了工程: ${endNodeNames}。ストアを最後に配置してください。`,
      nodeIds: endNodes.map(node => node.id),
    });
  }

  // 複数の終了ノードがある場合の警告
  if (endNodes.length > 1) {
    const nonStoreEndNodes = endNodes.filter(node => node.data.type !== 'store');
    if (nonStoreEndNodes.length > 0) {
      const nonStoreNames = nonStoreEndNodes.map(node => node.data.label).join(', ');
      errors.push({
        type: 'multiple_ends',
        severity: 'warning',
        message: `複数の終了工程があります。非ストア工程: ${nonStoreNames}。ストア以外の工程は削除するか、ストアに接続してください。`,
        nodeIds: nonStoreEndNodes.map(node => node.id),
      });
    }
  }

  return errors;
};