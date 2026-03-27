import React from 'react';
import {
  Box, Paper, Typography, Divider, Chip, Grid, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  ExpandMore, PlayArrow, Settings, AccountTree, Build, Inventory,
  LocalShipping, Assessment, Download, Speed, Keyboard, Language,
  DragIndicator, Edit, Link, Delete, Search, Help,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

const HelpPage: React.FC = () => {
  const { language } = useLanguage();

  const content = {
    ja: {
      title: 'ProSimNez ヘルプガイド',
      subtitle: '生産ネットワークシミュレーターの使い方',
      sections: [
        {
          title: '1. はじめに',
          icon: <Help />,
          content: `ProSimNezは、Witness風の離散イベントシミュレーションエンジンを搭載した工場の生産フローシミュレーターです。
工程・搬送・バッファを設計し、シミュレーションを実行して生産性を分析できます。`,
        },
        {
          title: '2. プロジェクト管理',
          icon: <Inventory />,
          items: [
            'サイドバー「プロジェクト」からプロジェクトを選択・作成',
            'プロジェクトにはネットワーク設計・部品・BOM・シミュレーション設定が含まれる',
            '初回起動時にデモプロジェクトが自動生成される',
          ],
        },
        {
          title: '3. ネットワーク設計',
          icon: <AccountTree />,
          items: [
            '左のパレットから工程ノード（加工・組立・検査）をドラッグ＆ドロップ',
            'ストアノード（部品倉庫・完成品倉庫）を配置',
            '工程の緑色の点（出力）から次工程の青色の点（入力）にドラッグして接続',
            'ノードをダブルクリック → 基本設定（サイクルタイム・設備台数・バッファ容量）',
            'ノードを右クリック → 「材料設定」で投入材料・出力製品・BOM連動を定義',
            '接続線を右クリック → 搬送方式（AGV/コンベア/手動）・ロットサイズを設定',
            'ストアをダブルクリック → 容量・稼働時間・生産スケジュールを設定',
          ],
        },
        {
          title: '4. 部品編集・BOM',
          icon: <Build />,
          items: [
            '製品マスタの作成・編集',
            'BOM（部品表）構成の定義：親製品 → 子部品 × 必要数量',
            'BOMに基づいてシミュレーション時の材料消費が決まる',
          ],
        },
        {
          title: '5. シミュレーション実行',
          icon: <PlayArrow />,
          items: [
            '「開始」ボタンでシミュレーション開始',
            '速度切替: 10x / 60x / 600x / MAX',
            'ライブフロー: 工程カード＋稼働率バー＋搬送アニメーション',
            'テーブル: 工程別詳細・搬送統計・バッファ在庫',
            'タイムライン分析: ガントチャート・在庫推移・生産累計（完了後）',
            'PDF出力: 設定条件＋結果詳細のレポート',
            'CSV出力: データのエクスポート',
          ],
        },
        {
          title: '6. シミュレーション仕様',
          icon: <Assessment />,
          items: [
            'BOM連動材料消費: 素材A×1 + 素材B×1 → 加工品×1',
            'バッファ容量制限: INバッファ満杯→搬送停止、OUTバッファ満杯→工程ブロック',
            'Push/Pull/Kanban: スケジューリング方式の切替',
            '不良率シミュレーション: 工程ごとに設定可能',
            '搬送ロットサイズ: 製品別ロットサイズとキャパシティ制限',
            '稼働時間: 完成品ストアの設定からシミュレーション時間を自動計算',
          ],
        },
        {
          title: '7. キーボードショートカット',
          icon: <Keyboard />,
          items: [
            'Ctrl+B: サイドバー表示/非表示',
            'Delete: 選択したノード/接続を削除',
            'ダブルクリック: ノード/接続の設定画面を開く',
            '右クリック: コンテキストメニュー（材料設定等）',
          ],
        },
        {
          title: '8. 言語設定',
          icon: <Language />,
          items: [
            'サイドバー下部の「設定」→「言語・地域」タブで切替',
            '日本語 / English / Bahasa Indonesia に対応',
          ],
        },
      ],
    },
    en: {
      title: 'ProSimNez Help Guide',
      subtitle: 'How to use the Production Network Simulator',
      sections: [
        {
          title: '1. Introduction',
          icon: <Help />,
          content: `ProSimNez is a factory production flow simulator with a Witness-style discrete event simulation engine.
Design processes, transport, and buffers, run simulations, and analyze productivity.`,
        },
        {
          title: '2. Project Management',
          icon: <Inventory />,
          items: [
            'Select or create projects from the sidebar "Projects"',
            'Projects contain network design, components, BOM, and simulation settings',
            'Demo projects are auto-generated on first launch',
          ],
        },
        {
          title: '3. Network Design',
          icon: <AccountTree />,
          items: [
            'Drag & drop process nodes (machining, assembly, inspection) from the palette',
            'Place store nodes (parts warehouse, finished goods warehouse)',
            'Drag from green dot (output) to blue dot (input) to connect',
            'Double-click node → Basic settings (cycle time, equipment count, buffer capacity)',
            'Right-click node → "Material Settings" to define input/output materials with BOM',
            'Right-click edge → Transport method (AGV/Conveyor/Manual), lot size',
            'Double-click store → Capacity, working hours, production schedule',
          ],
        },
        {
          title: '4. Component Editor & BOM',
          icon: <Build />,
          items: [
            'Create and edit product master data',
            'Define BOM (Bill of Materials): Parent product → Child parts × Required quantity',
            'BOM drives material consumption during simulation',
          ],
        },
        {
          title: '5. Running Simulation',
          icon: <PlayArrow />,
          items: [
            'Click "Start" to begin simulation',
            'Speed control: 10x / 60x / 600x / MAX',
            'Live Flow: process cards + utilization bars + transport animation',
            'Table: process details, transport stats, buffer inventory',
            'Timeline Analysis: Gantt chart, inventory trend, production curve (after completion)',
            'PDF Output: report with settings and detailed results',
            'CSV Export: data export',
          ],
        },
        {
          title: '6. Simulation Specifications',
          icon: <Assessment />,
          items: [
            'BOM-driven consumption: Material A×1 + Material B×1 → Processed×1',
            'Buffer capacity limits: IN full → transport stops, OUT full → process blocks',
            'Push/Pull/Kanban: scheduling mode switching',
            'Defect rate simulation: configurable per process',
            'Transport lot sizes: per-product lot sizes with capacity limits',
            'Working hours: simulation duration auto-calculated from finished goods store settings',
          ],
        },
        {
          title: '7. Keyboard Shortcuts',
          icon: <Keyboard />,
          items: [
            'Ctrl+B: Toggle sidebar',
            'Delete: Delete selected node/edge',
            'Double-click: Open node/edge settings',
            'Right-click: Context menu (material settings, etc.)',
          ],
        },
        {
          title: '8. Language Settings',
          icon: <Language />,
          items: [
            'Settings → "Language & Region" tab to switch',
            'Supports Japanese / English / Bahasa Indonesia',
          ],
        },
      ],
    },
    id: {
      title: 'Panduan Bantuan ProSimNez',
      subtitle: 'Cara menggunakan Simulator Jaringan Produksi',
      sections: [
        {
          title: '1. Pendahuluan',
          icon: <Help />,
          content: `ProSimNez adalah simulator alur produksi pabrik dengan mesin simulasi kejadian diskrit gaya Witness.
Rancang proses, transportasi, dan buffer, jalankan simulasi, dan analisis produktivitas.`,
        },
        {
          title: '2. Manajemen Proyek',
          icon: <Inventory />,
          items: [
            'Pilih atau buat proyek dari sidebar "Proyek"',
            'Proyek berisi desain jaringan, komponen, BOM, dan pengaturan simulasi',
            'Proyek demo dibuat otomatis saat pertama kali dijalankan',
          ],
        },
        {
          title: '3. Desain Jaringan',
          icon: <AccountTree />,
          items: [
            'Seret & lepas node proses (pemesinan, perakitan, inspeksi) dari palet',
            'Tempatkan node toko (gudang bahan, gudang barang jadi)',
            'Seret dari titik hijau (output) ke titik biru (input) untuk menghubungkan',
            'Klik dua kali node → Pengaturan dasar (waktu siklus, jumlah peralatan, kapasitas buffer)',
            'Klik kanan node → "Pengaturan Material" untuk mendefinisikan material input/output dengan BOM',
            'Klik kanan edge → Metode transportasi (AGV/Konveyor/Manual), ukuran lot',
            'Klik dua kali toko → Kapasitas, jam kerja, jadwal produksi',
          ],
        },
        {
          title: '4. Editor Komponen & BOM',
          icon: <Build />,
          items: [
            'Buat dan edit data master produk',
            'Definisikan BOM (Bill of Materials): Produk induk → Komponen anak × Jumlah yang diperlukan',
            'BOM menggerakkan konsumsi material selama simulasi',
          ],
        },
        {
          title: '5. Menjalankan Simulasi',
          icon: <PlayArrow />,
          items: [
            'Klik "Mulai" untuk memulai simulasi',
            'Kontrol kecepatan: 10x / 60x / 600x / MAX',
            'Live Flow: kartu proses + bar utilisasi + animasi transportasi',
            'Tabel: detail proses, statistik transportasi, inventaris buffer',
            'Analisis Timeline: Gantt chart, tren inventaris, kurva produksi (setelah selesai)',
            'Output PDF: laporan dengan pengaturan dan hasil detail',
            'Ekspor CSV: ekspor data',
          ],
        },
        {
          title: '6. Spesifikasi Simulasi',
          icon: <Assessment />,
          items: [
            'Konsumsi berbasis BOM: Material A×1 + Material B×1 → Diproses×1',
            'Batas kapasitas buffer: IN penuh → transportasi berhenti, OUT penuh → proses terblokir',
            'Push/Pull/Kanban: pergantian mode penjadwalan',
            'Simulasi tingkat cacat: dapat dikonfigurasi per proses',
            'Ukuran lot transportasi: per-produk dengan batas kapasitas',
            'Jam kerja: durasi simulasi dihitung otomatis dari pengaturan toko barang jadi',
          ],
        },
        {
          title: '7. Pintasan Keyboard',
          icon: <Keyboard />,
          items: [
            'Ctrl+B: Toggle sidebar',
            'Delete: Hapus node/edge yang dipilih',
            'Klik dua kali: Buka pengaturan node/edge',
            'Klik kanan: Menu konteks (pengaturan material, dll.)',
          ],
        },
        {
          title: '8. Pengaturan Bahasa',
          icon: <Language />,
          items: [
            'Pengaturan → Tab "Bahasa & Wilayah" untuk beralih',
            'Mendukung Jepang / Inggris / Bahasa Indonesia',
          ],
        },
      ],
    },
  };

  const lang = content[language as keyof typeof content] || content.ja;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          {lang.title}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {lang.subtitle}
        </Typography>
      </Paper>

      {lang.sections.map((section, i) => (
        <Accordion key={i} defaultExpanded={i < 2}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {section.icon}
              <Typography variant="h6">{section.title}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {(section as any).content && (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                {(section as any).content}
              </Typography>
            )}
            {(section as any).items && (
              <List dense>
                {(section as any).items.map((item: string, j: number) => (
                  <ListItem key={j}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    </ListItemIcon>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default HelpPage;
