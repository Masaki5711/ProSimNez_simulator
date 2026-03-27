import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Paper, Typography, Button, ButtonGroup, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Grid, Chip, Alert, IconButton, Divider,
  ToggleButton, ToggleButtonGroup, Collapse, Tabs, Tab,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, Speed, Download,
  CheckCircle, Warning,
  LocalShipping, Inventory, PrecisionManufacturing,
  ExpandMore, ExpandLess, AccountTree,
} from '@mui/icons-material';
import LiveFlowView from '../components/simulation/LiveFlowView';
import TimelineView from '../components/simulation/TimelineView';
import { RootState } from '../store';
import { setNetworkData } from '../store/projectSlice';
import { simulationApi } from '../api/simulationApi';

// ============================================================
// 型定義
// ============================================================
interface ProcessRow {
  id: string; name: string; type: string;
  cycleTime: number; equipmentCount: number;
  production: number; defects: number;
  utilization: number; waitingTime: number;
}
interface TransportActive {
  id: string; conn_id: string; source: string; target: string;
  product_id: string; quantity: number; progress: number; transport_type: string;
}
interface TransportStat {
  source: string; target: string; transport_type: string;
  trips: number; items_moved: number;
}
interface BufferRow {
  id: string; name: string; total: number; capacity: number | null;
}

// ============================================================
// ユーティリティ
// ============================================================
const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const UtilBar: React.FC<{value: number}> = ({value}) => {
  const color = value > 85 ? '#d32f2f' : value > 60 ? '#ed6c02' : '#2e7d32';
  return (
    <Box sx={{display:'flex',alignItems:'center',gap:1,width:'100%'}}>
      <Box sx={{flex:1,height:14,bgcolor:'#e0e0e0',borderRadius:1,overflow:'hidden'}}>
        <Box sx={{width:`${Math.min(value,100)}%`,height:'100%',bgcolor:color,borderRadius:1,transition:'width 0.3s'}}/>
      </Box>
      <Typography variant="caption" sx={{minWidth:40,textAlign:'right',fontWeight:value>85?'bold':'normal',color}}>
        {value.toFixed(1)}%
      </Typography>
    </Box>
  );
};

const transportIcon = (t: string) => {
  switch(t) {
    case 'agv': return 'AGV';
    case 'conveyor': return 'CNV';
    case 'manual': return 'MAN';
    case 'forklift': return 'FLT';
    default: return t.toUpperCase().slice(0,3);
  }
};

const typeColor = (t: string) => {
  switch(t) {
    case 'machining': return '#1565c0';
    case 'assembly': return '#2e7d32';
    case 'inspection': return '#7b1fa2';
    default: return '#616161';
  }
};

// ============================================================
// メインコンポーネント
// ============================================================
const SimulatorPage: React.FC = () => {
  const dispatch = useDispatch();
  const { networkData, currentProject } = useSelector((state: RootState) => state.project);

  // シミュレーション状態
  const [simStatus, setSimStatus] = useState<'idle'|'running'|'paused'|'completed'>('idle');
  const [simTime, setSimTime] = useState(0);
  const [duration, setDuration] = useState(3600);
  const [durationSource, setDurationSource] = useState('');
  const [progress, setProgress] = useState(0);
  const [speedFactor, setSpeedFactor] = useState('60');
  const [error, setError] = useState<string|null>(null);

  // 最下流ストアのスケジュール・稼働時間からシミュレーション時間を計算
  useEffect(() => {
    if (!networkData?.nodes || !networkData?.edges) return;

    // 最下流のストアを探す（出力エッジがないストア）
    const storeNodes = networkData.nodes.filter((n: any) =>
      n.type === 'store' || n.data?.type === 'store' || n.data?.storeType);
    const sourceIds = new Set(networkData.edges.map((e: any) => e.source));
    // 出力エッジがないストア = 最下流
    let finishedStore = storeNodes.find((n: any) => !sourceIds.has(n.id));
    // なければfinished_product指定のストア
    if (!finishedStore) {
      finishedStore = storeNodes.find((n: any) => n.data?.storeType === 'finished_product');
    }
    // それもなければ最後のストア
    if (!finishedStore && storeNodes.length > 0) {
      finishedStore = storeNodes[storeNodes.length - 1];
    }
    if (!finishedStore) {
      console.log('Duration: No finished store found, using default');
      setDuration(28800);
      setDurationSource('デフォルト: 8時間');
      return;
    }

    const d = finishedStore.data;
    console.log('Duration: Found store', finishedStore.id, 'data keys:', Object.keys(d), 'workingHours:', d.workingHours?.length, 'schedule:', d.productionSchedule?.length);

    // 1) 稼働時間から計算（最優先）
    const workingHours = d.workingHours;
    if (workingHours && workingHours.length > 0) {
      // 最初の稼働日の時間を使用
      const workDay = workingHours.find((wh: any) => wh.isWorkingDay !== false);
      if (workDay && workDay.startTime && workDay.endTime) {
        const [sh, sm] = workDay.startTime.split(':').map(Number);
        const [eh, em] = workDay.endTime.split(':').map(Number);
        let workSeconds = ((eh * 60 + em) - (sh * 60 + sm)) * 60;
        // 休憩時間を引く
        if (workDay.breakTimes) {
          for (const bt of workDay.breakTimes) {
            if (bt.startTime && bt.endTime) {
              const [bsh, bsm] = bt.startTime.split(':').map(Number);
              const [beh, bem] = bt.endTime.split(':').map(Number);
              workSeconds -= ((beh * 60 + bem) - (bsh * 60 + bsm)) * 60;
            }
          }
        }
        if (workSeconds > 0) {
          setDuration(workSeconds);
          setDurationSource(`稼働時間: ${workDay.startTime}～${workDay.endTime}`);
          return;
        }
      }
    }

    // 2) 生産スケジュールから推定
    const schedule = d.productionSchedule;
    if (schedule && schedule.length > 0) {
      const activeSchedule = schedule.filter((s: any) => s.isActive !== false);
      if (activeSchedule.length > 0) {
        // スケジュールの時間指定があればそれを使用
        const firstSch = activeSchedule[0];
        if (firstSch.startTime && firstSch.endTime) {
          const [sh, sm] = firstSch.startTime.split(':').map(Number);
          const [eh, em] = firstSch.endTime.split(':').map(Number);
          const schSeconds = ((eh * 60 + em) - (sh * 60 + sm)) * 60;
          if (schSeconds > 0) {
            setDuration(schSeconds);
            setDurationSource(`スケジュール: ${firstSch.startTime}～${firstSch.endTime}`);
            return;
          }
        }
        // 時間指定がない場合、目標数量からCTベースで推定
        const totalQty = activeSchedule.reduce((s: number, sch: any) => s + (sch.quantity || 0), 0);
        if (totalQty > 0) {
          // ボトルネック工程のCTから所要時間を推定
          let maxCtPerUnit = 60; // デフォルト60秒/個
          for (const node of networkData.nodes) {
            if (node.data?.cycleTime && node.data?.equipmentCount) {
              const ctPerUnit = node.data.cycleTime / node.data.equipmentCount;
              maxCtPerUnit = Math.max(maxCtPerUnit, ctPerUnit);
            }
          }
          const estimatedSeconds = Math.ceil(totalQty * maxCtPerUnit * 1.2); // 20%マージン
          setDuration(Math.max(estimatedSeconds, 600)); // 最低10分
          setDurationSource(`目標${totalQty}個 (推定${Math.ceil(estimatedSeconds/60)}分)`);
          return;
        }
      }
    }

    // 3) デフォルト: 8時間
    setDuration(28800);
    setDurationSource('デフォルト: 8時間');
  }, [networkData]);

  // ライブデータ
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [bufferRows, setBufferRows] = useState<BufferRow[]>([]);
  const [activeTransports, setActiveTransports] = useState<TransportActive[]>([]);
  const [transportStats, setTransportStats] = useState<Record<string, TransportStat>>({});
  const [kpis, setKpis] = useState<any>({});

  // 結果データ
  const [results, setResults] = useState<any>(null);
  const [showTransport, setShowTransport] = useState(true);

  const [monitorTab, setMonitorTab] = useState(0);

  // WebSocket
  const wsRef = useRef<WebSocket|null>(null);
  const reconnectRef = useRef<NodeJS.Timeout|null>(null);

  // プロジェクト変更時にネットワークデータを自動ロード
  useEffect(() => {
    if (currentProject?.id && !networkData) {
      try {
        const saved = localStorage.getItem(`project_${currentProject.id}_network`);
        if (saved) {
          dispatch(setNetworkData(JSON.parse(saved)));
        }
      } catch (e) { /* ignore */ }
    }
  }, [dispatch, networkData, currentProject]);

  // ── マウント時にバックエンド状態を復元 ──
  useEffect(() => {
    const restoreState = async () => {
      try {
        const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        // 1) ステータス確認
        const statusRes = await fetch(`${API}/api/simulation/status`);
        if (!statusRes.ok) return;
        const status = await statusRes.json();

        if (status.is_running || status.status === 'running' || status.status === 'paused') {
          // シミュレーション実行中 → 状態を復元
          setSimStatus(status.status === 'paused' ? 'paused' : 'running');
          setSimTime(status.simulation_time || 0);
          setProgress(status.progress || 0);

          // 2) 現在のデータを取得
          const resultsRes = await fetch(`${API}/api/simulation/results`);
          if (resultsRes.ok) {
            const data = await resultsRes.json();
            if (data.kpis) setKpis(data.kpis);

            // 工程データ復元
            if (data.process_details) {
              const rows: ProcessRow[] = data.process_details.map((p: any) => ({
                id: p.id, name: p.name, type: p.type,
                cycleTime: p.cycle_time, equipmentCount: p.equipment_count,
                production: p.production, defects: p.defects,
                utilization: p.utilization, waitingTime: p.waiting_time,
              }));
              setProcessRows(rows);
            }

            // バッファ復元
            if (data.buffer_states) {
              const brows: BufferRow[] = Object.entries(data.buffer_states).map(
                ([bid, b]: [string, any]) => ({
                  id: bid,
                  name: bid.replace('BUF_IN_','IN:').replace('BUF_OUT_','OUT:'),
                  total: b.total || 0, capacity: b.capacity,
                })
              ).filter(b => b.total > 0 || b.id.startsWith('store'));
              setBufferRows(brows);
            }

            // 搬送復元
            if (data.transport_details) {
              const stats: Record<string, TransportStat> = {};
              data.transport_details.forEach((t: any) => {
                stats[t.id] = {
                  source: t.source, target: t.target,
                  transport_type: t.transport_type,
                  trips: t.trips, items_moved: t.items_moved,
                };
              });
              setTransportStats(stats);
            }
          }
        } else if (status.status === 'completed') {
          // 完了済み → 結果を表示して再実行可能に
          setSimStatus('completed');
          setProgress(100);
          setSimTime(status.simulation_time || 0);
          const resultsRes = await fetch(`${API}/api/simulation/results`);
          if (resultsRes.ok) setResults(await resultsRes.json());
        } else {
          // idle等 → そのまま
          setSimStatus('idle');
        }
      } catch (e) {
        // バックエンド未起動時は無視
      }
    };
    restoreState();
  }, []); // マウント時に1回だけ

  // ── WebSocket接続 ──
  const connectWs = useCallback(() => {
    const url = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/simulation';
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { ws.send(JSON.stringify({type:'ping'})); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const etype = msg.event_type || msg.type;
        const d = msg.data || msg;

        if (etype === 'state_update' && d) {
          // 時間
          if (d.simulation_time !== undefined) setSimTime(d.simulation_time);
          if (d.progress !== undefined) setProgress(d.progress);

          // KPI
          if (d.kpis) setKpis(d.kpis);

          // 工程
          if (d.equipment_states) {
            const rows: ProcessRow[] = [];
            Object.entries(d.equipment_states).forEach(([pid, pdata]: [string, any]) => {
              const eqs = pdata.equipments || {};
              const eqList = Object.values(eqs) as any[];
              const avgUtil = eqList.length > 0
                ? eqList.reduce((s: number, e: any) => s + (e.utilization||0), 0) / eqList.length
                : 0;
              // バックエンドから送られたCT/設備数を使用（フォールバックとしてノードデータも参照）
              const ct = pdata.cycle_time || pdata.cycleTime || 0;
              const eqCount = pdata.equipment_count || eqList.length;
              const ptype = pdata.type || '';
              rows.push({
                id: pid, name: pdata.name || pid, type: ptype,
                cycleTime: ct, equipmentCount: eqCount,
                production: pdata.production || 0, defects: pdata.defects || 0,
                utilization: avgUtil, waitingTime: pdata.waiting_time || 0,
              });
            });
            setProcessRows(rows);
          }

          // バッファ
          if (d.inventories) {
            const brows: BufferRow[] = [];
            Object.entries(d.inventories).forEach(([bid, bdata]: [string, any]) => {
              // バックエンドのnameを使用、なければID整形
              const displayName = bdata.name || bid.replace('BUF_IN_','IN:').replace('BUF_OUT_','OUT:');
              brows.push({
                id: bid,
                name: displayName,
                total: bdata.total || 0,
                capacity: bdata.capacity || null,
              });
            });
            setBufferRows(brows.filter(b => b.total > 0 || b.id.includes('store') || b.id.includes('ship')));
          }

          // 搬送
          if (d.transport_states) {
            setActiveTransports(d.transport_states.active || []);
            setTransportStats(d.transport_states.stats || {});
          }
        }

        if (etype === 'simulation_completed') {
          setSimStatus('completed');
          fetchResults();
        }
        // progress 100%でも結果取得（simulation_completedが来ない場合の安全策）
        if (d?.progress >= 100 && !results) {
          setSimStatus('completed');
          fetchResults();
        }
      } catch (e) { /* ignore parse errors */ }
    };
    ws.onclose = () => {
      reconnectRef.current = setTimeout(connectWs, 3000);
    };
  }, [networkData]);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWs]);

  // ── 結果取得 ──
  const fetchResults = async () => {
    try {
      const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API}/api/simulation/results`);
      if (res.ok) setResults(await res.json());
    } catch (e) { /* ignore */ }
  };

  // ── 操作ハンドラー ──
  const handleStart = async () => {
    if (!networkData?.nodes?.length) {
      setError('ネットワークデータがありません。デモデータを読み込んでください。');
      return;
    }
    setError(null);
    setResults(null);
    setSimStatus('running');
    setSimTime(0); setProgress(0);

    try {
      await simulationApi.start({
        start_time: new Date().toISOString(),
        duration,
        speed: parseFloat(speedFactor),
        network_data: networkData,
      });
      // 速度設定
      const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      await fetch(`${API}/api/simulation/speed?speed=${speedFactor}`, {method:'POST'});
    } catch (e: any) {
      setError(e.message || 'シミュレーション開始エラー');
      setSimStatus('idle');
    }
  };

  const handlePause = async () => {
    await simulationApi.pause();
    setSimStatus('paused');
  };
  const handleResume = async () => {
    await simulationApi.resume();
    setSimStatus('running');
  };
  const handleStop = async () => {
    await simulationApi.stop();
    setSimStatus('completed');
    // 少し待ってから結果取得（バックエンドの集計完了を待つ）
    await new Promise(r => setTimeout(r, 500));
    fetchResults();
  };

  const handleExportCSV = () => {
    if (!results) return;
    const lines = ['工程名,タイプ,CT(秒),設備数,生産数,不良数,稼働率(%),材料待ち(秒)'];
    results.process_details?.forEach((p: any) => {
      lines.push(`${p.name},${p.type},${p.cycle_time},${p.equipment_count},${p.production},${p.defects},${p.utilization},${p.waiting_time}`);
    });
    lines.push('');
    lines.push('搬送ID,始点,終点,方式,搬送回数,搬送個数');
    results.transport_details?.forEach((t: any) => {
      lines.push(`${t.id},${t.source},${t.target},${t.transport_type},${t.trips},${t.items_moved}`);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `simulation_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // ── レポート出力 ──
  const handleReport = () => {
    if (!results && !kpis?.total_production) return;
    const r = results || {};
    const k = r.kpis || kpis || {};
    const procs = r.process_details || processRows;
    const trans = r.transport_details || Object.entries(transportStats).map(([id, s]: [string, any]) => ({ id, ...s }));
    const bufs = r.buffer_states || {};

    // ノード設定情報を収集
    const nodeConfigs = (networkData?.nodes || []).map((n: any) => {
      const d = n.data || {};
      const pTypes = ['machining','assembly','inspection','process'];
      if (!pTypes.includes(n.type) && !pTypes.includes(d.type)) return null;
      return {
        name: d.label || n.id,
        type: d.type || n.type,
        ct: d.cycleTime,
        setup: d.setupTime,
        eq: d.equipmentCount,
        op: d.operatorCount,
        inCap: d.inputBufferCapacity,
        outCap: d.outputBufferCapacity,
        defect: d.defectRate,
        inputs: (d.inputMaterials || []).map((m: any) => `${m.materialName||m.materialId}×${m.requiredQuantity} [${m.schedulingMode}]`).join(', '),
        outputs: (d.outputProducts || []).map((o: any) => `${o.productName||o.productId}×${o.outputQuantity}`).join(', '),
      };
    }).filter(Boolean);

    const storeConfigs = (networkData?.nodes || []).filter((n: any) =>
      n.type === 'store' || n.data?.type === 'store' || n.data?.storeType
    ).map((n: any) => {
      const d = n.data || {};
      return { name: d.label || n.id, type: d.storeType || 'unknown', capacity: d.capacity,
        safety: d.safetyStock, auto: d.autoReplenishment,
        inv: (d.inventoryLevels || []).map((i: any) => `${i.productName}: ${i.currentStock}`).join(', '),
      };
    });

    const edgeConfigs = (networkData?.edges || []).map((e: any) => {
      const d = e.data || {};
      const m = d.transportMethods?.[0];
      return {
        from: (networkData?.nodes?.find((n: any) => n.id === e.source)?.data?.label || e.source),
        to: (networkData?.nodes?.find((n: any) => n.id === e.target)?.data?.label || e.target),
        type: d.transportType || m?.type || '?',
        time: d.transportTime || m?.transportTime || 0,
        lot: d.transportLotSize || m?.transportProducts?.[0]?.lotSize || 1,
      };
    });

    const utilColor = (v: number) => v > 85 ? '#d32f2f' : v > 60 ? '#ed6c02' : '#2e7d32';

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>シミュレーションレポート - ${currentProject?.name || 'ProSimNez'}</title>
<style>
body{font-family:'Segoe UI',sans-serif;max-width:1000px;margin:0 auto;padding:20px;color:#333;font-size:13px}
h1{color:#1565c0;border-bottom:3px solid #1565c0;padding-bottom:8px;font-size:20px}
h2{color:#37474f;border-left:4px solid #1565c0;padding-left:10px;margin-top:30px;font-size:16px}
h3{color:#546e7a;font-size:14px;margin-top:20px}
table{border-collapse:collapse;width:100%;margin:10px 0}
th{background:#1565c0;color:white;padding:6px 10px;text-align:left;font-size:12px}
td{border:1px solid #e0e0e0;padding:5px 10px;font-size:12px}
tr:nth-child(even){background:#f5f5f5}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:15px 0}
.kpi-card{border:1px solid #e0e0e0;border-radius:8px;padding:12px;text-align:center;border-left:4px solid #1565c0}
.kpi-card .value{font-size:24px;font-weight:bold;color:#1565c0}
.kpi-card .label{font-size:11px;color:#757575;margin-top:4px}
.bn{background:#fff3e0;font-weight:bold}
.bar{height:14px;border-radius:3px;display:inline-block;min-width:4px}
.meta{color:#757575;font-size:11px}
.warn{color:#d32f2f;font-weight:bold}
@media print{@page{size:A4;margin:15mm}body{font-size:10px;max-width:100%}h1{font-size:15px}h2{font-size:13px;page-break-after:avoid}table{page-break-inside:avoid;font-size:9px}.kpi-grid{grid-template-columns:repeat(4,1fr)}.bar{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<h1>シミュレーションレポート</h1>
<p class="meta">プロジェクト: <strong>${currentProject?.name || '-'}</strong> | 生成: ${new Date().toLocaleString('ja-JP')} | エンジン: ProSimNez v2</p>

<h2>1. シミュレーション条件</h2>
<table><tr><th>項目</th><th>値</th></tr>
<tr><td>シミュレーション時間</td><td>${fmtTime(r.duration || simTime)}</td></tr>
<tr><td>稼働時間設定</td><td>${durationSource || '-'}</td></tr>
<tr><td>工程数</td><td>${processCount}</td></tr>
<tr><td>搬送接続数</td><td>${edgeCount}</td></tr>
<tr><td>製品数</td><td>${productCount}</td></tr>
</table>

<h3>1.1 工程設定</h3>
<table><tr><th>工程名</th><th>タイプ</th><th>CT(秒)</th><th>段取(秒)</th><th>設備</th><th>作業者</th><th>IN容量</th><th>OUT容量</th><th>不良率</th><th>投入材料</th><th>出力製品</th></tr>
${nodeConfigs.map((n: any) => `<tr><td>${n.name}</td><td>${n.type}</td><td>${n.ct||'-'}</td><td>${n.setup||0}</td><td>${n.eq}</td><td>${n.op||'-'}</td><td>${n.inCap||'∞'}</td><td>${n.outCap||'∞'}</td><td>${n.defect||0}%</td><td>${n.inputs||'-'}</td><td>${n.outputs||'-'}</td></tr>`).join('')}
</table>

<h3>1.2 ストア設定</h3>
<table><tr><th>ストア名</th><th>種別</th><th>容量</th><th>安全在庫</th><th>自動補充</th><th>初期在庫</th></tr>
${storeConfigs.map((s: any) => `<tr><td>${s.name}</td><td>${s.type}</td><td>${s.capacity||'∞'}</td><td>${s.safety||0}</td><td>${s.auto?'有':'無'}</td><td>${s.inv||'-'}</td></tr>`).join('')}
</table>

<h3>1.3 搬送設定</h3>
<table><tr><th>区間</th><th>方式</th><th>搬送時間(秒)</th><th>ロットサイズ</th></tr>
${edgeConfigs.map((e: any) => `<tr><td>${e.from} → ${e.to}</td><td>${e.type.toUpperCase()}</td><td>${e.time}</td><td>${e.lot}</td></tr>`).join('')}
</table>

<h2>2. 結果サマリー</h2>
<div class="kpi-grid">
<div class="kpi-card"><div class="value">${k.total_production||0}</div><div class="label">完成品数</div></div>
<div class="kpi-card" style="border-color:#2e7d32"><div class="value" style="color:#2e7d32">${k.throughput||0}</div><div class="label">スループット(個/h)</div></div>
<div class="kpi-card" style="border-color:#ed6c02"><div class="value" style="color:#ed6c02">${k.equipment_utilization||0}%</div><div class="label">平均稼働率</div></div>
<div class="kpi-card" style="border-color:#7b1fa2"><div class="value" style="color:#7b1fa2">${k.quality_rate||100}%</div><div class="label">品質率</div></div>
<div class="kpi-card" style="border-color:#d32f2f"><div class="value" style="color:#d32f2f">${k.bottleneck||'-'}</div><div class="label">ボトルネック(${k.bottleneck_utilization||0}%)</div></div>
<div class="kpi-card"><div class="value">${k.total_defects||0}</div><div class="label">総不良数</div></div>
<div class="kpi-card"><div class="value">${k.average_lead_time||0}s</div><div class="label">平均リードタイム</div></div>
<div class="kpi-card"><div class="value">${k.total_process_outputs||0}</div><div class="label">全工程出力合計</div></div>
</div>

<h2>3. 工程別詳細結果</h2>
<table><tr><th>工程名</th><th>タイプ</th><th>CT</th><th>設備</th><th>生産数</th><th>不良数</th><th>稼働率</th><th>材料待ち(秒)</th><th>稼働率バー</th></tr>
${(Array.isArray(procs) ? procs : []).sort((a: any, b: any) => (b.utilization||0) - (a.utilization||0)).map((p: any) => {
  const u = p.utilization || 0;
  return `<tr class="${u>85?'bn':''}"><td><strong>${p.name}</strong>${u>85?' ⚠BN':''}</td><td>${p.type}</td><td>${p.cycle_time||p.cycleTime||'-'}s</td><td>${p.equipment_count||p.equipmentCount||'-'}</td><td><strong>${p.production}</strong></td><td class="${p.defects>0?'warn':''}">${p.defects||0}</td><td>${u.toFixed(1)}%</td><td>${p.waiting_time||p.waitingTime||0}</td><td><div class="bar" style="width:${u}%;background:${utilColor(u)}">&nbsp;</div></td></tr>`;
}).join('')}
</table>

<h2>4. 搬送詳細結果</h2>
<table><tr><th>区間</th><th>搬送方式</th><th>搬送回数</th><th>搬送個数</th><th>1回あたり</th></tr>
${(Array.isArray(trans) ? trans : []).map((t: any) => {
  const src = networkData?.nodes?.find((n: any) => n.id === t.source)?.data?.label || t.source;
  const tgt = networkData?.nodes?.find((n: any) => n.id === t.target)?.data?.label || t.target;
  return `<tr><td>${src} → ${tgt}</td><td>${(t.transport_type||'?').toUpperCase()}</td><td>${t.trips}</td><td><strong>${t.items_moved}</strong></td><td>${t.trips>0?(t.items_moved/t.trips).toFixed(1):'-'}</td></tr>`;
}).join('')}
</table>

<h2>5. バッファ最終状態</h2>
<table><tr><th>バッファ</th><th>在庫数</th><th>容量</th><th>充填率</th></tr>
${Object.entries(bufs).length > 0
  ? Object.entries(bufs).sort(([,a]: any,[,b]: any) => (b.total||0)-(a.total||0)).map(([id, b]: [string, any]) => {
    const fill = b.capacity ? ((b.total/b.capacity)*100).toFixed(0) : '-';
    return `<tr><td>${b.name||id}</td><td><strong>${b.total}</strong></td><td>${b.capacity||'∞'}</td><td>${fill}%</td></tr>`;
  }).join('')
  : bufferRows.sort((a: any,b: any) => b.total-a.total).map((b: any) => `<tr><td>${b.name}</td><td><strong>${b.total}</strong></td><td>-</td><td>-</td></tr>`).join('')
}
</table>

<h2>6. 分析・所見</h2>
<ul>
${k.bottleneck ? `<li><strong>ボトルネック:</strong> ${k.bottleneck} (稼働率${k.bottleneck_utilization}%) — この工程の能力増強がスループット向上の鍵</li>` : ''}
${(k.total_defects||0) > 0 ? `<li><strong>品質:</strong> 不良${k.total_defects}個 (品質率${k.quality_rate}%) — 不良率の高い工程を重点改善</li>` : '<li><strong>品質:</strong> 不良ゼロ ✓</li>'}
${Object.entries(bufs).some(([,b]: any) => b.capacity && b.total >= b.capacity) ? '<li class="warn"><strong>バッファ満杯:</strong> 一部バッファが容量上限に達しています。容量拡大または生産ペース調整を検討</li>' : ''}
${(k.equipment_utilization||0) < 50 ? '<li><strong>低稼働率:</strong> 平均稼働率が50%未満。下流ブロックまたは材料不足の可能性</li>' : ''}
</ul>

<hr><p class="meta">Generated by ProSimNez Simulator | ${new Date().toISOString()}</p>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      // PDF保存ダイアログを自動で開く
      setTimeout(() => w.print(), 500);
    }
  };

  // ── ノード数集計 ──
  const processTypes = ['machining','assembly','inspection','kitting','shipping','process'];
  const nodeCount = networkData?.nodes?.length || 0;
  const processCount = networkData?.nodes?.filter((n: any) =>
    processTypes.includes(n.type) || processTypes.includes(n.data?.type))?.length || 0;
  const edgeCount = networkData?.edges?.length || 0;
  const productCount = networkData?.products?.length || 0;
  const isReady = processCount > 0 && edgeCount > 0;

  // ============================================================
  // レンダリング
  // ============================================================
  return (
    <Box sx={{height:'100vh',display:'flex',flexDirection:'column',bgcolor:'#f5f5f5',overflow:'auto'}}>
      {/* ──────── [1] ヘッダー＋ネットワーク概要 ──────── */}
      <Paper elevation={1} sx={{p:2,mx:2,mt:2,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:1}}>
        <Box sx={{display:'flex',alignItems:'center',gap:2}}>
          <PrecisionManufacturing color="primary" sx={{fontSize:32}} />
          <Typography variant="h5" fontWeight="bold">ProSimNez Simulator</Typography>
        </Box>
        <Box sx={{display:'flex',gap:1,alignItems:'center',flexWrap:'wrap'}}>
          <Chip icon={<PrecisionManufacturing/>} label={`工程: ${processCount}`} size="small" color="primary" variant="outlined"/>
          <Chip icon={<LocalShipping/>} label={`搬送: ${edgeCount}`} size="small" color="info" variant="outlined"/>
          <Chip icon={<Inventory/>} label={`製品: ${productCount}`} size="small" color="success" variant="outlined"/>
          <Chip label={`全ノード: ${nodeCount}`} size="small" variant="outlined"/>
          {isReady ? (
            <Chip icon={<CheckCircle/>} label="Ready" size="small" color="success"/>
          ) : (
            <Chip icon={<Warning/>} label="データなし" size="small" color="warning"/>
          )}
          {currentProject && (
            <Chip label={currentProject.name} size="small" color="primary"/>
          )}
          {(simStatus === 'running' || simStatus === 'paused' || simStatus === 'completed' || results) && (
            <Button size="small" variant="contained" color="info" startIcon={<Download/>}
              onClick={handleReport} sx={{ml:0.5}}>
              PDF出力
            </Button>
          )}
          {!networkData && (
            <Typography variant="caption" color="error">
              プロジェクトを選択してください
            </Typography>
          )}
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{mx:2,mt:1}} onClose={()=>setError(null)}>{error}</Alert>}

      {/* ──────── [2] 実行制御バー ──────── */}
      <Paper elevation={1} sx={{p:2,mx:2,mt:1,display:'flex',alignItems:'center',gap:2,flexWrap:'wrap'}}>
        <ButtonGroup variant="contained" size="large">
          <Button startIcon={<PlayArrow/>}
            disabled={simStatus==='running'||!isReady}
            onClick={simStatus==='paused'?handleResume:()=>{setSimStatus('idle');handleStart();}}
            color="success">
            {simStatus==='paused'?'再開':simStatus==='completed'?'再実行':'開始'}
          </Button>
          <Button startIcon={<Pause/>} disabled={simStatus!=='running'} onClick={handlePause}>
            一時停止
          </Button>
          <Button startIcon={<Stop/>} disabled={simStatus!=='running'&&simStatus!=='paused'}
            onClick={handleStop} color="error">
            停止
          </Button>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem/>

        <Box sx={{display:'flex',alignItems:'center',gap:1}}>
          <Speed fontSize="small"/>
          <ToggleButtonGroup size="small" exclusive value={speedFactor}
            onChange={(_,v)=>{
              if(v) {
                setSpeedFactor(v);
                // 実行中ならリアルタイムで速度変更をバックエンドに送信
                const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
                fetch(`${API}/api/simulation/speed?speed=${v}`, {method:'POST'}).catch(()=>{});
              }
            }}>
            <ToggleButton value="10">10x</ToggleButton>
            <ToggleButton value="60">60x</ToggleButton>
            <ToggleButton value="600">600x</ToggleButton>
            <ToggleButton value="6000">MAX</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider orientation="vertical" flexItem/>

        <Box sx={{flex:1,minWidth:200}}>
          <Box sx={{display:'flex',justifyContent:'space-between',mb:0.5}}>
            <Typography variant="body2" fontWeight="bold">
              {fmtTime(simTime)} / {fmtTime(duration)}
              {durationSource && <Typography component="span" variant="caption" color="text.secondary" sx={{ml:1}}>({durationSource})</Typography>}
            </Typography>
            <Typography variant="body2">{progress.toFixed(1)}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{height:8,borderRadius:1}}/>
        </Box>

        <Chip label={simStatus.toUpperCase()} size="small"
          color={simStatus==='running'?'success':simStatus==='paused'?'warning':simStatus==='completed'?'info':'default'}/>
      </Paper>

      {/* ──────── [3] KPIカード ──────── */}
      {(simStatus !== 'idle') && (
        <Box sx={{mx:2,mt:1}}>
          <Grid container spacing={1}>
            {[
              {label:'総生産数', value: kpis.total_production||0, unit:'個', color:'#1565c0'},
              {label:'スループット', value: (kpis.throughput||0).toFixed(1), unit:'個/h', color:'#2e7d32'},
              {label:'平均稼働率', value: (kpis.equipment_utilization||0).toFixed(1), unit:'%', color:'#ed6c02'},
              {label:'品質率', value: (kpis.quality_rate||100).toFixed(1), unit:'%', color:'#7b1fa2'},
              {label:'ボトルネック', value: kpis.bottleneck||'-', unit: kpis.bottleneck_utilization ? `${kpis.bottleneck_utilization}%` : '', color:'#d32f2f'},
              {label:'搬送中', value: kpis.active_transports||0, unit:'件', color:'#00838f'},
            ].map((k,i)=>(
              <Grid item xs={6} sm={4} md={2} key={i}>
                <Card variant="outlined" sx={{borderLeft:`4px solid ${k.color}`}}>
                  <CardContent sx={{py:1,px:1.5,'&:last-child':{pb:1}}}>
                    <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                    <Box sx={{display:'flex',alignItems:'baseline',gap:0.5}}>
                      <Typography variant="h6" fontWeight="bold" sx={{color:k.color}}>{k.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{k.unit}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ──────── [4] モニター＆分析 ──────── */}
      {(simStatus === 'running' || simStatus === 'paused' || simStatus === 'completed') && (
        <Box sx={{mx:2,mt:1,pb:2}}>
          {/* ビュー切替タブ */}
          <Paper elevation={0} sx={{borderBottom:1,borderColor:'divider',mb:1}}>
            <Tabs value={monitorTab} onChange={(_,v)=>setMonitorTab(v)} sx={{minHeight:32}}>
              <Tab label="ライブモニター" sx={{minHeight:32,py:0,textTransform:'none',fontSize:13}} />
              <Tab label="タイムライン分析" sx={{minHeight:32,py:0,textTransform:'none',fontSize:13}} />
            </Tabs>
          </Paper>

          {/* ライブモニタータブ */}
          {monitorTab === 0 && (<>
          {/* ライブフロービュー */}
          <Paper elevation={1} sx={{mb:1,overflow:'auto'}}>
            <Box sx={{px:2,py:0.5,bgcolor:'#37474f',color:'white',display:'flex',alignItems:'center',gap:1}}>
              <AccountTree sx={{fontSize:18}}/>
              <Typography variant="subtitle2">ライブフロー</Typography>
            </Box>
            <LiveFlowView
              processes={processRows}
              buffers={bufferRows}
              transportStats={transportStats}
              activeTransports={activeTransports}
              kpis={kpis}
              networkNodes={networkData?.nodes || []}
              networkEdges={networkData?.edges || []}
            />
          </Paper>

          {/* テーブル */}
          {(
            <Box sx={{display:'flex',gap:1,flexWrap:'wrap'}}>
              {/* 工程テーブル */}
              <Paper elevation={1} sx={{flex:2,minWidth:400,overflow:'auto'}}>
                <Box sx={{px:2,py:1,bgcolor:'primary.main',color:'white',display:'flex',alignItems:'center',gap:1}}>
                  <PrecisionManufacturing fontSize="small"/>
                  <Typography variant="subtitle2">工程ライブモニター</Typography>
                </Box>
                <TableContainer sx={{maxHeight:300}}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{fontWeight:'bold',minWidth:120}}>工程名</TableCell>
                        <TableCell sx={{fontWeight:'bold'}} align="center">CT(秒)</TableCell>
                        <TableCell sx={{fontWeight:'bold'}} align="center">設備</TableCell>
                        <TableCell sx={{fontWeight:'bold',minWidth:150}}>稼働率</TableCell>
                        <TableCell sx={{fontWeight:'bold'}} align="right">生産数</TableCell>
                        <TableCell sx={{fontWeight:'bold'}} align="right">不良</TableCell>
                        <TableCell sx={{fontWeight:'bold'}} align="right">待ち(秒)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {processRows.sort((a,b)=>b.utilization-a.utilization).map(r=>(
                        <TableRow key={r.id} sx={{bgcolor: r.utilization > 85 ? '#fff3e0' : 'inherit'}}>
                          <TableCell>
                            <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
                              <Box sx={{width:8,height:8,borderRadius:'50%',bgcolor:typeColor(r.type)}}/>
                              <Typography variant="body2" fontWeight={r.utilization>85?'bold':'normal'}>{r.name}</Typography>
                              {r.utilization > 85 && <Chip label="BN" size="small" color="error" sx={{height:16,fontSize:10}}/>}
                            </Box>
                          </TableCell>
                          <TableCell align="center">{r.cycleTime}</TableCell>
                          <TableCell align="center">{r.equipmentCount}</TableCell>
                          <TableCell><UtilBar value={r.utilization}/></TableCell>
                          <TableCell align="right"><strong>{r.production}</strong></TableCell>
                          <TableCell align="right" sx={{color: r.defects > 0 ? 'error.main' : 'inherit'}}>{r.defects}</TableCell>
                          <TableCell align="right">{r.waitingTime.toFixed(0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* 右カラム: 搬送 + バッファ */}
              <Box sx={{flex:1,minWidth:300,display:'flex',flexDirection:'column',gap:1}}>
            {/* 搬送ライブモニター */}
            <Paper elevation={1} sx={{overflow:'auto'}}>
              <Box sx={{px:2,py:1,bgcolor:'#00838f',color:'white',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                  <LocalShipping fontSize="small"/>
                  <Typography variant="subtitle2">搬送ライブモニター</Typography>
                  <Chip label={`${activeTransports.length}件`} size="small" sx={{color:'white',bgcolor:'rgba(255,255,255,0.2)'}}/>
                </Box>
                <IconButton size="small" sx={{color:'white'}} onClick={()=>setShowTransport(!showTransport)}>
                  {showTransport ? <ExpandLess/> : <ExpandMore/>}
                </IconButton>
              </Box>
              <Collapse in={showTransport}>
                {/* 搬送ルート常時表示 */}
                <Box sx={{p:1}}>
                  {Object.entries(transportStats).map(([cid, s]) => {
                    const active = activeTransports.find(t => t.source === s.source && t.target === s.target);
                    return (
                      <Box key={cid} sx={{display:'flex',alignItems:'center',gap:1,mb:0.5,p:0.5,
                        bgcolor: active ? '#e0f7fa' : '#fafafa', borderRadius:1,
                        border: `1px solid ${active ? '#00838f' : '#eeeeee'}`}}>
                        <Chip label={transportIcon(s.transport_type)} size="small" variant="outlined"
                          sx={{minWidth:40, color: active ? '#00838f' : 'text.secondary'}}/>
                        <Typography variant="caption" sx={{minWidth:50,fontSize:10}} noWrap>
                          {s.source.replace('proc_','').replace('store_','').replace('s_','')}
                        </Typography>
                        <Box sx={{flex:1,height:6,bgcolor:'#e0e0e0',borderRadius:1,overflow:'hidden'}}>
                          <Box sx={{
                            width: active ? `${(active.progress||0)*100}%` : s.items_moved > 0 ? '100%' : '0%',
                            height:'100%',bgcolor: active ? '#00838f' : '#b0bec5',borderRadius:1,
                            transition:'width 0.5s'}}/>
                        </Box>
                        <Typography variant="caption" sx={{minWidth:50,textAlign:'right',fontSize:10}} noWrap>
                          {s.target.replace('proc_','').replace('store_','').replace('s_','')}
                        </Typography>
                        <Typography variant="caption" sx={{minWidth:35,textAlign:'right',fontWeight:'bold',fontSize:10}}>
                          {s.items_moved}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                {/* 搬送統計テーブル */}
                {Object.keys(transportStats).length > 0 && (
                  <TableContainer sx={{maxHeight:200}}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{fontWeight:'bold',py:0.5}}>区間</TableCell>
                          <TableCell sx={{fontWeight:'bold',py:0.5}} align="center">方式</TableCell>
                          <TableCell sx={{fontWeight:'bold',py:0.5}} align="right">回数</TableCell>
                          <TableCell sx={{fontWeight:'bold',py:0.5}} align="right">個数</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(transportStats).map(([cid,s])=>(
                          <TableRow key={cid}>
                            <TableCell sx={{py:0.5}}>
                              <Typography variant="caption">{s.source.replace('proc_','').replace('store_','')}</Typography>
                              <Typography variant="caption" color="text.secondary"> → </Typography>
                              <Typography variant="caption">{s.target.replace('proc_','').replace('store_','')}</Typography>
                            </TableCell>
                            <TableCell align="center" sx={{py:0.5}}>
                              <Chip label={transportIcon(s.transport_type)} size="small" variant="outlined" sx={{height:20,fontSize:10}}/>
                            </TableCell>
                            <TableCell align="right" sx={{py:0.5}}>{s.trips}</TableCell>
                            <TableCell align="right" sx={{py:0.5}}><strong>{s.items_moved}</strong></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Collapse>
            </Paper>

            {/* バッファ在庫 */}
            <Paper elevation={1} sx={{overflow:'auto',flex:1}}>
              <Box sx={{px:2,py:1,bgcolor:'#2e7d32',color:'white',display:'flex',alignItems:'center',gap:1}}>
                <Inventory fontSize="small"/>
                <Typography variant="subtitle2">バッファ在庫</Typography>
              </Box>
              <TableContainer sx={{maxHeight:200}}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{fontWeight:'bold',py:0.5}}>バッファ</TableCell>
                      <TableCell sx={{fontWeight:'bold',py:0.5}} align="right">在庫数</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bufferRows.sort((a,b)=>b.total-a.total).map(b=>(
                      <TableRow key={b.id}>
                        <TableCell sx={{py:0.5}}><Typography variant="caption">{b.name}</Typography></TableCell>
                        <TableCell align="right" sx={{py:0.5}}><strong>{b.total}</strong></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              </Paper>
            </Box>
          </Box>
          )}
          </>)}

          {/* タイムライン分析タブ */}
          {monitorTab === 1 && (
            <TimelineView results={results} networkNodes={networkData?.nodes || []} />
          )}
        </Box>
      )}

      {/* ──────── [5] 結果サマリー ──────── */}
      {results && simStatus === 'completed' && (
        <Paper elevation={2} sx={{mx:2,mb:2,p:2}}>
          <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',mb:2}}>
            <Typography variant="h6" fontWeight="bold">シミュレーション結果</Typography>
            <Button startIcon={<Download/>} variant="outlined" onClick={handleExportCSV}>CSV出力</Button>
          </Box>

          {/* 結果KPI */}
          <Grid container spacing={2} sx={{mb:2}}>
            {[
              {label:'総生産数', value:`${results.kpis?.total_production||0} 個`},
              {label:'不良数', value:`${results.kpis?.total_defects||0} 個`},
              {label:'品質率', value:`${results.kpis?.quality_rate||100}%`},
              {label:'スループット', value:`${results.kpis?.throughput||0} 個/h`},
              {label:'ボトルネック', value: results.kpis?.bottleneck||'-'},
              {label:'シミュレーション時間', value: fmtTime(results.duration||0)},
            ].map((k,i)=>(
              <Grid item xs={6} sm={4} md={2} key={i}>
                <Box sx={{textAlign:'center',p:1,bgcolor:'#f5f5f5',borderRadius:1}}>
                  <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                  <Typography variant="h6" fontWeight="bold">{k.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* 結果テーブル */}
          <Typography variant="subtitle2" gutterBottom>工程別結果</Typography>
          <TableContainer sx={{mb:2}}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{bgcolor:'#f5f5f5'}}>
                  <TableCell sx={{fontWeight:'bold'}}>工程名</TableCell>
                  <TableCell sx={{fontWeight:'bold'}}>タイプ</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="center">CT(秒)</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="center">設備数</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="right">生産数</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="right">不良数</TableCell>
                  <TableCell sx={{fontWeight:'bold'}}>稼働率</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="right">材料待ち(秒)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.process_details?.sort((a: any,b: any)=>b.utilization-a.utilization).map((p: any)=>(
                  <TableRow key={p.id} sx={{bgcolor:p.utilization>85?'#fff3e0':'inherit'}}>
                    <TableCell>
                      <strong>{p.name}</strong>
                      {p.utilization>85 && <Chip label="ボトルネック" size="small" color="error" sx={{ml:1,height:18,fontSize:10}}/>}
                    </TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell align="center">{p.cycle_time}</TableCell>
                    <TableCell align="center">{p.equipment_count}</TableCell>
                    <TableCell align="right"><strong>{p.production}</strong></TableCell>
                    <TableCell align="right" sx={{color:p.defects>0?'error.main':'inherit'}}>{p.defects}</TableCell>
                    <TableCell><UtilBar value={p.utilization}/></TableCell>
                    <TableCell align="right">{p.waiting_time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 搬送結果テーブル */}
          <Typography variant="subtitle2" gutterBottom>搬送結果</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{bgcolor:'#f5f5f5'}}>
                  <TableCell sx={{fontWeight:'bold'}}>区間</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="center">搬送方式</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="right">搬送回数</TableCell>
                  <TableCell sx={{fontWeight:'bold'}} align="right">搬送個数</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.transport_details?.map((t: any)=>(
                  <TableRow key={t.id}>
                    <TableCell>{t.source} → {t.target}</TableCell>
                    <TableCell align="center"><Chip label={transportIcon(t.transport_type)} size="small" variant="outlined"/></TableCell>
                    <TableCell align="right">{t.trips}</TableCell>
                    <TableCell align="right"><strong>{t.items_moved}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default SimulatorPage;
