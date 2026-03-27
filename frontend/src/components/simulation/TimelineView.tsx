/**
 * タイムラインビュー
 * ガントチャート風の工程稼働状況・在庫推移・搬送活動の時系列表示
 */
import React, { useMemo } from 'react';
import { Box, Typography, Paper, Chip, Tabs, Tab } from '@mui/material';

interface Props {
  results: any;
  networkNodes: any[];
}

const fmtT = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

const COLORS = {
  running: '#4caf50', idle: '#e0e0e0', blocked: '#ff9800',
  buffer: '#42a5f5', transport: '#00897b', production: '#7b1fa2',
};

// SVGチャート描画
const Chart: React.FC<{
  title: string; series: [number, number][]; color: string; maxY?: number;
  duration: number; height?: number; fill?: boolean; yLabel?: string;
}> = ({ title, series, color, maxY: propMaxY, duration, height = 80, fill = true, yLabel }) => {
  if (!series?.length) return null;
  const W = 800;
  const H = height;
  const pad = { l: 50, r: 10, t: 5, b: 20 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const maxY = propMaxY || Math.max(...series.map(s => s[1]), 1);

  const points = series.map(([t, v]) => {
    const x = pad.l + (t / duration) * cw;
    const y = pad.t + ch - (v / maxY) * ch;
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = fill ? `${pad.l},${pad.t + ch} ${points} ${pad.l + (series[series.length - 1][0] / duration) * cw},${pad.t + ch}` : '';

  // 時間軸ラベル
  const ticks = [];
  const step = duration > 14400 ? 3600 : duration > 3600 ? 1800 : 600;
  for (let t = 0; t <= duration; t += step) {
    ticks.push(t);
  }

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" fontWeight="bold" sx={{ ml: 1 }}>{title}</Typography>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
        {/* グリッド */}
        {ticks.map(t => {
          const x = pad.l + (t / duration) * cw;
          return <line key={t} x1={x} y1={pad.t} x2={x} y2={pad.t + ch} stroke="#f0f0f0" strokeWidth="0.5" />;
        })}
        {/* Y軸グリッド */}
        {[0, 0.25, 0.5, 0.75, 1].map(r => {
          const y = pad.t + ch * (1 - r);
          return <g key={r}>
            <line x1={pad.l} y1={y} x2={pad.l + cw} y2={y} stroke="#f5f5f5" strokeWidth="0.5" />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#999">{Math.round(maxY * r)}</text>
          </g>;
        })}
        {/* 塗り */}
        {fill && <polygon points={fillPoints} fill={color} opacity="0.15" />}
        {/* 線 */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        {/* 時間軸ラベル */}
        {ticks.map(t => {
          const x = pad.l + (t / duration) * cw;
          return <text key={`l${t}`} x={x} y={H - 2} textAnchor="middle" fontSize="8" fill="#999">{fmtT(t)}</text>;
        })}
        {/* Y軸ラベル */}
        {yLabel && <text x={4} y={pad.t + ch / 2} fontSize="8" fill="#999" transform={`rotate(-90,4,${pad.t + ch / 2})`} textAnchor="middle">{yLabel}</text>}
      </svg>
    </Box>
  );
};

// ガントバー（工程ステータス）
const GanttBar: React.FC<{
  name: string; series: [number, number][]; duration: number;
}> = ({ name, series, duration }) => {
  if (!series?.length) return null;
  const W = 800;
  const H = 24;
  const pad = { l: 120, r: 10 };
  const cw = W - pad.l - pad.r;

  // 連続する同じステータスの区間をまとめる
  const segments: { start: number; end: number; status: number }[] = [];
  for (let i = 0; i < series.length; i++) {
    const [t, v] = series[i];
    const status = Math.round(v); // 0=idle, 1=running, 2=blocked
    const end = i < series.length - 1 ? series[i + 1][0] : duration;
    if (segments.length > 0 && segments[segments.length - 1].status === status) {
      segments[segments.length - 1].end = end;
    } else {
      segments.push({ start: t, end, status });
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <text x={pad.l - 4} y={H / 2 + 4} textAnchor="end" fontSize="10" fill="#333">{name}</text>
      {segments.map((seg, i) => {
        const x = pad.l + (seg.start / duration) * cw;
        const w = ((seg.end - seg.start) / duration) * cw;
        const color = seg.status === 2 ? COLORS.blocked : seg.status === 1 ? COLORS.running : COLORS.idle;
        return <rect key={i} x={x} y={2} width={Math.max(w, 0.5)} height={H - 4} fill={color} rx={1} />;
      })}
    </svg>
  );
};

const TimelineView: React.FC<Props> = ({ results, networkNodes }) => {
  const [activeTab, setActiveTab] = React.useState(0);

  const ts = results?.time_series || {};
  const duration = results?.duration || 3600;

  // 工程名マップ
  const procNames = useMemo(() => {
    const m: Record<string, string> = {};
    networkNodes?.forEach((n: any) => {
      m[n.id] = n.data?.label || n.id;
    });
    return m;
  }, [networkNodes]);

  // 工程リスト（ストア除外）
  const processIds = useMemo(() => {
    return Object.keys(ts).filter(k => k.startsWith('status_')).map(k => k.replace('status_', ''));
  }, [ts]);

  // バッファリスト（IN/OUTのみ）
  const bufferKeys = useMemo(() => {
    return Object.keys(ts).filter(k => k.startsWith('buf_') && (k.includes('BUF_IN') || k.includes('BUF_OUT') || k.includes('store')));
  }, [ts]);

  if (!results || Object.keys(ts).length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">シミュレーション完了後にタイムラインが表示されます</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 1, minHeight: 32 }}>
        <Tab label="工程ガントチャート" sx={{ minHeight: 32, py: 0, textTransform: 'none', fontSize: 13 }} />
        <Tab label="在庫推移" sx={{ minHeight: 32, py: 0, textTransform: 'none', fontSize: 13 }} />
        <Tab label="生産・搬送" sx={{ minHeight: 32, py: 0, textTransform: 'none', fontSize: 13 }} />
      </Tabs>

      {/* ── ガントチャート ── */}
      {activeTab === 0 && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" gutterBottom>工程稼働ガントチャート</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Chip label="稼働" size="small" sx={{ bgcolor: COLORS.running, color: 'white', height: 18, fontSize: 10 }} />
            <Chip label="待機" size="small" sx={{ bgcolor: COLORS.idle, height: 18, fontSize: 10 }} />
            <Chip label="ブロック" size="small" sx={{ bgcolor: COLORS.blocked, color: 'white', height: 18, fontSize: 10 }} />
          </Box>
          {processIds.map(pid => (
            <GanttBar key={pid} name={procNames[pid] || pid} series={ts[`status_${pid}`]} duration={duration} />
          ))}
          {/* 時間軸 */}
          <Box sx={{ ml: '120px', display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            {[0, 0.25, 0.5, 0.75, 1].map(r => (
              <Typography key={r} variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                {fmtT(duration * r)}
              </Typography>
            ))}
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>工程稼働率推移</Typography>
          {processIds.map(pid => (
            <Chart key={`u_${pid}`}
              title={procNames[pid] || pid}
              series={ts[`util_${pid}`]} color={COLORS.running}
              maxY={100} duration={duration} height={50} yLabel="%" />
          ))}
        </Paper>
      )}

      {/* ── 在庫推移 ── */}
      {activeTab === 1 && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" gutterBottom>バッファ在庫推移</Typography>
          {bufferKeys.sort().map(key => {
            const label = key.replace('buf_', '').replace('BUF_IN_', 'IN:').replace('BUF_OUT_', 'OUT:');
            const maxVal = Math.max(...(ts[key] || []).map((s: any) => s[1]), 1);
            return (
              <Chart key={key} title={label} series={ts[key]} color={COLORS.buffer}
                maxY={maxVal} duration={duration} height={50} yLabel="個" />
            );
          })}
          <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>総仕掛品(WIP)推移</Typography>
          <Chart title="Total WIP" series={ts["total_wip"]} color="#ff7043"
            duration={duration} height={70} yLabel="個" />
        </Paper>
      )}

      {/* ── 生産・搬送 ── */}
      {activeTab === 2 && (
        <Paper variant="outlined" sx={{ p: 1 }}>
          <Typography variant="subtitle2" gutterBottom>工程別生産累計</Typography>
          {processIds.map(pid => (
            <Chart key={`p_${pid}`}
              title={procNames[pid] || pid}
              series={ts[`prod_${pid}`]} color={COLORS.production}
              duration={duration} height={50} fill={false} yLabel="個" />
          ))}
          <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>搬送中件数推移</Typography>
          <Chart title="搬送中" series={ts["active_transports"]} color={COLORS.transport}
            duration={duration} height={60} yLabel="件" />
        </Paper>
      )}
    </Box>
  );
};

export default TimelineView;
