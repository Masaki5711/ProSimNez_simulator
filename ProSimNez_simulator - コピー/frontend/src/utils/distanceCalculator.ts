// 距離計算ユーティリティ

export interface Point {
  x: number;
  y: number;
}

/**
 * 2点間のユークリッド距離を計算
 * @param point1 開始点
 * @param point2 終了点
 * @returns 距離（ピクセル単位）
 */
export const calculateEuclideanDistance = (point1: Point, point2: Point): number => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * マンハッタン距離を計算（直角に移動する場合）
 * @param point1 開始点
 * @param point2 終了点
 * @returns 距離（ピクセル単位）
 */
export const calculateManhattanDistance = (point1: Point, point2: Point): number => {
  const dx = Math.abs(point2.x - point1.x);
  const dy = Math.abs(point2.y - point1.y);
  return dx + dy;
};

/**
 * ピクセル距離を実際の距離（メートル）に変換
 * @param pixelDistance ピクセル距離
 * @param scale スケール（ピクセル/メートル）デフォルト：10px = 1m
 * @returns 実際の距離（メートル）
 */
export const pixelToMeter = (pixelDistance: number, scale: number = 10): number => {
  return Math.round((pixelDistance / scale) * 10) / 10; // 小数点第1位まで
};

/**
 * 搬送方式に応じた距離係数を適用
 * @param distance 基本距離
 * @param transportType 搬送方式
 * @returns 調整後の距離
 */
export const applyTransportFactor = (distance: number, transportType: string): number => {
  const factors = {
    conveyor: 1.0,    // コンベア：直線距離
    agv: 1.2,         // AGV：経路制約により20%増
    manual: 1.5,      // 手搬送：非効率的な経路で50%増
    forklift: 1.3,    // フォークリフト：やや迂回して30%増
  };
  
  const factor = factors[transportType as keyof typeof factors] || 1.0;
  return Math.round(distance * factor * 10) / 10;
};

/**
 * 工程間の実際の搬送距離を計算
 * @param sourcePosition 開始工程の座標
 * @param targetPosition 終了工程の座標
 * @param transportType 搬送方式
 * @param useManhattan マンハッタン距離を使用するか（デフォルト：false）
 * @param scale ピクセル/メートルのスケール
 * @returns 実際の搬送距離（メートル）
 */
export const calculateTransportDistance = (
  sourcePosition: Point,
  targetPosition: Point,
  transportType: string = 'conveyor',
  useManhattan: boolean = false,
  scale: number = 10
): number => {
  // 基本距離を計算
  const pixelDistance = useManhattan 
    ? calculateManhattanDistance(sourcePosition, targetPosition)
    : calculateEuclideanDistance(sourcePosition, targetPosition);
  
  // ピクセル距離をメートルに変換
  const meterDistance = pixelToMeter(pixelDistance, scale);
  
  // 搬送方式に応じた係数を適用
  return applyTransportFactor(meterDistance, transportType);
};

/**
 * 搬送時間を距離と搬送方式から推定
 * @param distance 距離（メートル）
 * @param transportType 搬送方式
 * @returns 推定搬送時間（秒）
 */
export const estimateTransportTime = (distance: number, transportType: string): number => {
  // 搬送方式別の速度（m/s）
  const speeds = {
    conveyor: 0.5,    // コンベア：0.5m/s
    agv: 1.0,         // AGV：1.0m/s
    manual: 0.8,      // 手搬送：0.8m/s
    forklift: 2.0,    // フォークリフト：2.0m/s
  };
  
  const speed = speeds[transportType as keyof typeof speeds] || 1.0;
  const baseTime = distance / speed;
  
  // 始動・停止時間を追加
  const setupTimes = {
    conveyor: 5,      // コンベア：5秒
    agv: 10,         // AGV：10秒（接近・位置決め時間）
    manual: 3,       // 手搬送：3秒
    forklift: 8,     // フォークリフト：8秒
  };
  
  const setupTime = setupTimes[transportType as keyof typeof setupTimes] || 5;
  
  return Math.round(baseTime + setupTime);
};

/**
 * 搬送コストを距離と搬送方式から推定
 * @param distance 距離（メートル）
 * @param transportType 搬送方式
 * @returns 推定搬送コスト（円/回）
 */
export const estimateTransportCost = (distance: number, transportType: string): number => {
  // 搬送方式別の基本コスト（円/m）
  const costPerMeter = {
    conveyor: 2,      // コンベア：2円/m
    agv: 8,          // AGV：8円/m（電力・減価償却含む）
    manual: 12,      // 手搬送：12円/m（人件費）
    forklift: 6,     // フォークリフト：6円/m
  };
  
  const unitCost = costPerMeter[transportType as keyof typeof costPerMeter] || 5;
  
  // 固定コストを追加
  const fixedCosts = {
    conveyor: 10,     // コンベア：10円
    agv: 30,         // AGV：30円
    manual: 20,      // 手搬送：20円
    forklift: 25,    // フォークリフト：25円
  };
  
  const fixedCost = fixedCosts[transportType as keyof typeof fixedCosts] || 15;
  
  return Math.round(distance * unitCost + fixedCost);
};

/**
 * 複数の工程間の総距離を計算
 * @param positions 工程の座標配列
 * @param transportType 搬送方式
 * @returns 総距離（メートル）
 */
export const calculateTotalDistance = (
  positions: Point[],
  transportType: string = 'conveyor'
): number => {
  if (positions.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    totalDistance += calculateTransportDistance(
      positions[i],
      positions[i + 1],
      transportType
    );
  }
  
  return Math.round(totalDistance * 10) / 10;
};