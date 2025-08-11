import React, { useEffect } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

interface WebSocketProviderProps {
  children: React.ReactNode;
}

const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  // WebSocket接続を初期化
  useWebSocket();

  return <>{children}</>;
};

export default WebSocketProvider;