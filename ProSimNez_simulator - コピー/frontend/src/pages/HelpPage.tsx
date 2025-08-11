import React from 'react';
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

const HelpPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ヘルプ
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          生産シミュレーターの使用方法について説明します。
        </Typography>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">プロジェクト管理</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              プロジェクトタブでは、製造ラインの設計・シミュレーション・分析プロジェクトを管理できます。
            </Typography>
            <Typography variant="body2" component="div">
              <strong>主な機能：</strong>
              <ul>
                <li>新規プロジェクトの作成</li>
                <li>プロジェクトの編集・削除</li>
                <li>プロジェクトのアーカイブ・復元</li>
                <li>カテゴリ別・ステータス別のフィルタリング</li>
                <li>プロジェクトの検索・ソート</li>
              </ul>
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">ネットワーク編集</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              ネットワーク編集では、製造ラインの工程ネットワークを視覚的に設計できます。
            </Typography>
            <Typography variant="body2" component="div">
              <strong>操作方法：</strong>
              <ul>
                <li>工程ノードの追加：右クリック → 工程追加</li>
                <li>工程の接続：ノード間をドラッグ</li>
                <li>工程パラメータ編集：ノードをダブルクリック</li>
                <li>材料設定：工程パラメータ編集から設定</li>
                <li>BOM管理：BOMタブから設定</li>
              </ul>
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">シミュレーション</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              シミュレータータブでは、設計したネットワークのシミュレーションを実行できます。
            </Typography>
            <Typography variant="body2" component="div">
              <strong>機能：</strong>
              <ul>
                <li>リアルタイムシミュレーション</li>
                <li>在庫量の可視化</li>
                <li>設備稼働率の監視</li>
                <li>KPI指標の表示</li>
                <li>イベントログの確認</li>
              </ul>
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">分析</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              分析タブでは、シミュレーション結果の詳細分析とレポート生成ができます。
            </Typography>
            <Typography variant="body2" component="div">
              <strong>分析項目：</strong>
              <ul>
                <li>生産性分析</li>
                <li>ボトルネック検出</li>
                <li>コスト分析</li>
                <li>品質分析</li>
                <li>レイアウト最適化提案</li>
              </ul>
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  );
};

export default HelpPage;