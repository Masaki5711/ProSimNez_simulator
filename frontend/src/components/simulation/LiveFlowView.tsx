/**
 * ライブフロービュー v2
 * - ノード間をSVG線で接続
 * - 稼働/停止をパルスアニメーションで表現
 * - 搬送ゲージ常時表示
 */
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Box, Typography, Paper, Chip, Tooltip } from '@mui/material';
import {
  Settings as MachiningIcon,
  Build as AssemblyIcon,
  Search as InspectionIcon,
  Warehouse as StoreIcon,
  LocalShipping,
} from '@mui/icons-material';

interface ProcessInfo {
  id: string; name: string; type: string; cycleTime: number;
  equipmentCount: number; production: number; defects: number;
  utilization: number; waitingTime: number;
}
interface BufferInfo { id: string; total: number; }
interface TransportStat { source: string; target: string; transport_type: string; trips: number; items_moved: number; }
interface ActiveTransport { id: string; source: string; target: string; progress: number; quantity: number; transport_type: string; }
interface Props {
  processes: ProcessInfo[]; buffers: BufferInfo[];
  transportStats: Record<string, TransportStat>;
  activeTransports: ActiveTransport[]; kpis: any;
  networkNodes: any[]; networkEdges: any[];
}

const typeColor = (t: string) => {
  switch (t) {
    case 'machining': return '#1565c0';
    case 'assembly': return '#2e7d32';
    case 'inspection': return '#7b1fa2';
    case 'store': case 'storage': return '#e65100';
    default: return '#616161';
  }
};
const typeIcon = (t: string, size = 16) => {
  const sx = { fontSize: size };
  switch (t) {
    case 'machining': return <MachiningIcon sx={sx} />;
    case 'assembly': return <AssemblyIcon sx={sx} />;
    case 'inspection': return <InspectionIcon sx={sx} />;
    case 'store': case 'storage': return <StoreIcon sx={sx} />;
    default: return <MachiningIcon sx={sx} />;
  }
};
const tLabel = (t: string) => {
  switch (t) { case 'agv': return 'AGV'; case 'conveyor': return 'CNV'; case 'manual': return 'MAN'; default: return t; }
};

// ノードカードの幅・高さ
const NODE_W = 150;
const NODE_H = 130;
const CARD_GAP_X = 60;
const CARD_GAP_Y = 30;

const LiveFlowView: React.FC<Props> = ({
  processes, buffers, transportStats, activeTransports, kpis, networkNodes, networkEdges,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, {x: number, y: number}>>({});

  const processMap = useMemo(() => {
    const m: Record<string, ProcessInfo> = {};
    processes.forEach(p => { m[p.id] = p; });
    return m;
  }, [processes]);

  const bufferMap = useMemo(() => {
    const m: Record<string, BufferInfo> = {};
    buffers.forEach(b => { m[b.id] = b; });
    return m;
  }, [buffers]);

  // アクティブ搬送をコネクションIDでマップ
  const activeByConn = useMemo(() => {
    const m: Record<string, ActiveTransport> = {};
    activeTransports.forEach(t => {
      const key = `${t.source}->${t.target}`;
      m[key] = t;
    });
    return m;
  }, [activeTransports]);

  // ノード配置計算（トポロジカルソート→レイヤー→座標）
  const { layers, nodePositions, svgSize } = useMemo(() => {
    if (!networkNodes?.length) return { layers: [], nodePositions: {}, svgSize: { w: 0, h: 0 } };

    const inMap: Record<string, string[]> = {};
    const outMap: Record<string, string[]> = {};
    networkEdges?.forEach((e: any) => {
      if (!inMap[e.target]) inMap[e.target] = [];
      inMap[e.target].push(e.source);
      if (!outMap[e.source]) outMap[e.source] = [];
      outMap[e.source].push(e.target);
    });

    // レイヤー計算
    const layerOf: Record<string, number> = {};
    const visited = new Set<string>();
    const getLayer = (nid: string): number => {
      if (layerOf[nid] !== undefined) return layerOf[nid];
      if (visited.has(nid)) return 0;
      visited.add(nid);
      const preds = inMap[nid] || [];
      const maxPred = preds.length > 0 ? Math.max(...preds.map(getLayer)) : -1;
      layerOf[nid] = maxPred + 1;
      return layerOf[nid];
    };
    networkNodes.forEach((n: any) => getLayer(n.id));

    const maxLayer = Math.max(...Object.values(layerOf), 0);
    const layerGroups: any[][] = [];
    for (let i = 0; i <= maxLayer; i++) {
      layerGroups.push(
        networkNodes.filter((n: any) => layerOf[n.id] === i)
          .sort((a: any, b: any) => (a.position?.y || 0) - (b.position?.y || 0))
      );
    }

    // 座標計算
    const pos: Record<string, {x: number, y: number}> = {};
    let maxW = 0, maxH = 0;
    layerGroups.forEach((group, li) => {
      group.forEach((node: any, ni: number) => {
        const x = 20 + li * (NODE_W + CARD_GAP_X);
        const y = 20 + ni * (NODE_H + CARD_GAP_Y);
        pos[node.id] = { x, y };
        maxW = Math.max(maxW, x + NODE_W + 20);
        maxH = Math.max(maxH, y + NODE_H + 20);
      });
    });

    return { layers: layerGroups, nodePositions: pos, svgSize: { w: maxW, h: maxH } };
  }, [networkNodes, networkEdges]);

  useEffect(() => { setPositions(nodePositions); }, [nodePositions]);

  if (!networkNodes?.length) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">ネットワークデータなし</Typography></Box>;
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', overflow: 'auto', minHeight: svgSize.h + 40 }}>
      {/* SVG接続線（ノードの後ろに描画） */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: svgSize.w, height: svgSize.h, pointerEvents: 'none', zIndex: 0 }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
            <path d="M0,0 L10,3 L0,6 Z" fill="#90a4ae" />
          </marker>
          <marker id="arrow-active" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
            <path d="M0,0 L10,3 L0,6 Z" fill="#00838f" />
          </marker>
        </defs>
        {networkEdges?.map((edge: any) => {
          const from = positions[edge.source];
          const to = positions[edge.target];
          if (!from || !to) return null;

          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;

          // 搬送中か判定
          const connKey = `${edge.source}->${edge.target}`;
          const isActive = !!activeByConn[connKey];
          const stat = Object.values(transportStats).find(
            s => s.source === edge.source && s.target === edge.target);
          const hasMoved = stat && stat.items_moved > 0;

          // ベジェ曲線のコントロールポイント
          const dx = x2 - x1;
          const cx1 = x1 + dx * 0.4;
          const cx2 = x2 - dx * 0.4;

          return (
            <g key={edge.id}>
              <path
                d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                fill="none"
                stroke={isActive ? '#00838f' : hasMoved ? '#78909c' : '#cfd8dc'}
                strokeWidth={isActive ? 3 : 2}
                strokeDasharray={isActive ? '8 4' : 'none'}
                markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
              >
                {isActive && (
                  <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />
                )}
              </path>
              {/* 搬送ラベル */}
              {stat && stat.items_moved > 0 && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}
                  textAnchor="middle" fontSize="10" fill="#546e7a">
                  {tLabel(stat.transport_type)} {stat.items_moved}個
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* ノードカード */}
      {networkNodes.map((node: any) => {
        const pos = positions[node.id];
        if (!pos) return null;
        const proc = processMap[node.id];
        const isStore = node.type === 'store' || node.type === 'storage' || node.data?.type === 'store';
        const effectiveType = node.data?.type || node.type || 'machining';
        const color = typeColor(effectiveType);
        const util = proc?.utilization || 0;
        const isBottleneck = util > 85;
        const isRunning = util > 5;
        const inBuf = bufferMap[`BUF_IN_${node.id}`] || bufferMap[node.id];
        const outBuf = bufferMap[`BUF_OUT_${node.id}`];

        return (
          <Paper key={node.id} elevation={isBottleneck ? 4 : 1} sx={{
            position: 'absolute', left: pos.x, top: pos.y, width: NODE_W, zIndex: 1,
            border: `2px solid ${isBottleneck ? '#d32f2f' : color}`,
            borderRadius: 2, p: 1, bgcolor: isBottleneck ? '#fff3e0' : 'white',
            transition: 'box-shadow 0.3s',
            animation: isRunning && !isStore ? 'pulse-border 2s infinite' : 'none',
            '@keyframes pulse-border': {
              '0%': { boxShadow: `0 0 0 0 ${color}40` },
              '50%': { boxShadow: `0 0 8px 4px ${color}30` },
              '100%': { boxShadow: `0 0 0 0 ${color}40` },
            },
          }}>
            {/* ヘッダー */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
              <Box sx={{ color }}>{typeIcon(effectiveType)}</Box>
              <Typography variant="caption" fontWeight="bold" noWrap sx={{ flex: 1, fontSize: 11 }}>
                {node.data?.label || node.id}
              </Typography>
              {/* 稼働/停止インジケーター */}
              {!isStore && (
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: isRunning ? '#4caf50' : '#bdbdbd',
                  animation: isRunning ? 'blink 1s infinite' : 'none',
                  '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                }} />
              )}
              {isBottleneck && <Chip label="BN" size="small" color="error" sx={{ height: 14, fontSize: 8 }} />}
            </Box>

            {/* 工程情報 */}
            {!isStore && proc && (
              <>
                <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
                  CT:{proc.cycleTime}s {proc.equipmentCount}台
                </Typography>
                {/* 稼働率バー */}
                <Box sx={{ mt: 0.3, height: 6, bgcolor: '#e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                  <Box sx={{
                    width: `${Math.min(util, 100)}%`, height: '100%', borderRadius: 1,
                    bgcolor: util > 85 ? '#d32f2f' : util > 60 ? '#ed6c02' : '#2e7d32',
                    transition: 'width 0.5s',
                  }} />
                </Box>
                <Typography variant="caption" sx={{ fontSize: 9, color: util > 85 ? '#d32f2f' : 'text.secondary' }}>
                  稼働{util.toFixed(0)}%
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 'bold' }}>
                    生産:{proc.production}
                  </Typography>
                  {proc.defects > 0 && (
                    <Typography variant="caption" sx={{ fontSize: 10, color: 'error.main' }}>
                      不良:{proc.defects}
                    </Typography>
                  )}
                </Box>
              </>
            )}

            {/* ストア */}
            {isStore && (
              <Box sx={{ textAlign: 'center', mt: 0.5 }}>
                <StoreIcon sx={{ fontSize: 22, color, opacity: 0.5 }} />
              </Box>
            )}

            {/* バッファ */}
            <Box sx={{ mt: 0.3, display: 'flex', gap: 0.3, flexWrap: 'wrap' }}>
              {inBuf && inBuf.total > 0 && (
                <Chip label={`IN:${inBuf.total}`} size="small" variant="outlined" color="info" sx={{ height: 16, fontSize: 9 }} />
              )}
              {outBuf && outBuf.total > 0 && (
                <Chip label={`OUT:${outBuf.total}`} size="small" variant="outlined" color="success" sx={{ height: 16, fontSize: 9 }} />
              )}
              {isStore && inBuf && inBuf.total > 0 && (
                <Chip label={`${inBuf.total}個`} size="small" color="warning" sx={{ height: 18, fontSize: 10, fontWeight: 'bold' }} />
              )}
            </Box>
          </Paper>
        );
      })}

      {/* 搬送ルート常時表示ゲージ（下部） */}
      <Box sx={{ position: 'relative', zIndex: 2, mt: `${svgSize.h + 10}px`, px: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <LocalShipping sx={{ fontSize: 14, color: '#00838f' }} />
          <Typography variant="caption" fontWeight="bold" color="#00838f">搬送ルート</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {networkEdges?.map((edge: any) => {
            const connKey = `${edge.source}->${edge.target}`;
            const active = activeByConn[connKey];
            const stat = Object.values(transportStats).find(
              s => s.source === edge.source && s.target === edge.target);
            const tType = edge.data?.transportType || stat?.transport_type || '?';
            const srcLabel = (networkNodes.find((n: any) => n.id === edge.source)?.data?.label || edge.source).replace(/\(.*\)/, '').trim();
            const tgtLabel = (networkNodes.find((n: any) => n.id === edge.target)?.data?.label || edge.target).replace(/\(.*\)/, '').trim();

            return (
              <Box key={edge.id} sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5,
                bgcolor: active ? '#e0f7fa' : '#fafafa', borderRadius: 1,
                border: `1px solid ${active ? '#00838f' : '#e0e0e0'}`,
                minWidth: 180, flex: '0 0 auto',
              }}>
                <Chip label={tLabel(tType)} size="small" variant="outlined"
                  sx={{ height: 16, fontSize: 9, minWidth: 32, color: active ? '#00838f' : 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontSize: 9, minWidth: 40 }} noWrap>{srcLabel}</Typography>
                <Box sx={{ flex: 1, height: 4, bgcolor: '#e0e0e0', borderRadius: 1, overflow: 'hidden', minWidth: 30 }}>
                  <Box sx={{
                    width: active ? `${(active.progress || 0) * 100}%` : stat && stat.items_moved > 0 ? '100%' : '0%',
                    height: '100%', borderRadius: 1,
                    bgcolor: active ? '#00838f' : '#b0bec5',
                    transition: 'width 0.5s',
                  }} />
                </Box>
                <Typography variant="caption" sx={{ fontSize: 9, minWidth: 40, textAlign: 'right' }} noWrap>{tgtLabel}</Typography>
                <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary', minWidth: 28, textAlign: 'right' }}>
                  {stat?.items_moved || 0}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* 凡例 */}
      <Box sx={{ position: 'relative', zIndex: 2, mt: 1, px: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {[
          { color: '#1565c0', label: '加工' }, { color: '#2e7d32', label: '組立' },
          { color: '#7b1fa2', label: '検査' }, { color: '#e65100', label: 'ストア' },
          { color: '#d32f2f', label: 'BN(>85%)' },
        ].map(l => (
          <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: l.color }} />
            <Typography variant="caption" sx={{ fontSize: 10 }}>{l.label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4caf50', animation: 'blink 1s infinite',
            '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
          <Typography variant="caption" sx={{ fontSize: 10 }}>稼働中</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#bdbdbd' }} />
          <Typography variant="caption" sx={{ fontSize: 10 }}>停止/待機</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LiveFlowView;
