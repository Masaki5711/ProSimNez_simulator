import React from 'react';
import { Box, Paper, Typography, List, ListItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  DragIndicator,
  Edit,
  Link,
  Delete,
  Add,
  PanTool,
  Build,
  Settings,
  HelpOutline
} from '@mui/icons-material';

const HelpPage: React.FC = () => {
  const operations = [
    { icon: <DragIndicator />, primary: '工程配置', secondary: '左の工程パレットからドラッグ&ドロップ' },
    { icon: <Link />, primary: '接続作成', secondary: '工程の緑色の点（出力）から青色の点（入力）へドラッグ' },
    { icon: <Edit />, primary: '工程編集', secondary: '工程ノードをダブルクリック' },
    { icon: <Edit />, primary: '接続編集', secondary: '接続線をダブルクリック' },
    { icon: <Add />, primary: '材料設定', secondary: '工程を選択し、右下のアクションメニュー（＋）から材料アイコンをクリック' },
    { icon: <Delete />, primary: '削除', secondary: '削除したい工程や接続線を選択して Delete キーを押す' },
    { icon: <PanTool />, primary: 'メニュー制御', secondary: '右下のアクションメニュー（＋）で開閉。背景クリックや Escape キーで閉じる' },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        ヘルプ
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        シミュレーターの基本的な操作方法と、各種設定項目の意味について説明します。
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        ネットワークエディタの操作方法
      </Typography>
      <List>
        {operations.map((op, index) => (
          <ListItem key={index}>
            <ListItemIcon>{op.icon}</ListItemIcon>
            <ListItemText primary={op.primary} secondary={op.secondary} />
          </ListItem>
        ))}
      </List>
      
      <Divider sx={{ my: 2 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        各種設定について
      </Typography>
      <Box sx={{ ml: 2 }}>
        <Typography variant="h6" gutterBottom>
          <Settings sx={{ verticalAlign: 'middle', mr: 1 }} />
          工程設定
        </Typography>
        <Typography variant="body2" paragraph sx={{ pl: 4 }}>
          - **サイクルタイム (CT):** 1つの製品を生産するのにかかる時間（秒）。<br/>
          - **設備数:** その工程に配置されている設備の数。複数ある場合、並列で処理されます。<br/>
          - **入力/出力バッファ容量:** 工程の前後に置ける製品の最大在庫数。
        </Typography>
        <Typography variant="h6" gutterBottom>
          <Build sx={{ verticalAlign: 'middle', mr: 1 }} />
          接続設定
        </Typography>
        <Typography variant="body2" paragraph sx={{ pl: 4 }}>
          - **輸送時間:** 工程間を製品が移動するのにかかる時間（秒）。
        </Typography>
      </Box>
    </Paper>
  );
};

export default HelpPage;
