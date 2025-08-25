import { Product, MaterialInput, ProductOutput } from '../types/productionTypes';

/**
 * ロットサイズベースのバッファ管理ユーティリティ
 */
export class BufferUtils {
  /**
   * 部品のロットサイズを取得
   */
  static getLotSize(materialId: string, products: Product[]): number {
    const product = products.find(p => p.id === materialId || p.code === materialId);
    if (product) {
      // Productにはロットサイズ情報がないため、デフォルトロットサイズを使用
      return 10; // デフォルト10個
    }
    
    // デフォルトロットサイズ
    return 10;
  }

  /**
   * コンポーネントの搬送ロットサイズを取得
   */
  static getTransportLotSize(materialId: string, components: any[]): number {
    const component = components.find(c => c.id === materialId || c.code === materialId);
    if (component) {
      return component.transportLotSize || component.batchSize || 1;
    }
    return 1;
  }

  /**
   * ロットサイズの倍数に丸める（切り上げ）
   */
  static roundToLotSize(quantity: number, lotSize: number): number {
    if (quantity === 0) return 0;
    if (lotSize <= 0) return quantity;
    return Math.ceil(quantity / lotSize) * lotSize;
  }

  /**
   * ロットサイズの倍数に丸める（切り下げ）
   */
  static floorToLotSize(quantity: number, lotSize: number): number {
    if (quantity === 0) return 0;
    if (lotSize <= 0) return quantity;
    return Math.floor(quantity / lotSize) * lotSize;
  }

  /**
   * 有効なバッファサイズリストを生成（ロットサイズの倍数）
   */
  static generateValidBufferSizes(lotSize: number, maxLots: number = 10): number[] {
    const sizes = [0]; // 初期在庫なしの選択肢
    for (let i = 1; i <= maxLots; i++) {
      sizes.push(i * lotSize);
    }
    return sizes;
  }

  /**
   * バッファ設定の検証
   */
  static validateBufferSettings(
    materialId: string,
    bufferSettings: MaterialInput['bufferSettings'],
    products: Product[],
    components: any[] = []
  ): {
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // ロットサイズを取得
    const productLotSize = this.getLotSize(materialId, products);
    const componentLotSize = this.getTransportLotSize(materialId, components);
    const effectiveLotSize = Math.max(productLotSize, componentLotSize);
    
    // 初期在庫の検証
    if (bufferSettings.initialStock > 0 && bufferSettings.initialStock % effectiveLotSize !== 0) {
      errors.push(`初期在庫数(${bufferSettings.initialStock})はロットサイズ(${effectiveLotSize})の倍数である必要があります`);
      suggestions.push(`推奨値: ${this.roundToLotSize(bufferSettings.initialStock, effectiveLotSize)}`);
    }
    
    // 安全在庫の検証
    if (bufferSettings.safetyStock > 0 && bufferSettings.safetyStock % effectiveLotSize !== 0) {
      errors.push(`安全在庫数(${bufferSettings.safetyStock})はロットサイズ(${effectiveLotSize})の倍数である必要があります`);
      suggestions.push(`推奨値: ${this.roundToLotSize(bufferSettings.safetyStock, effectiveLotSize)}`);
    }
    
    // 最大容量の検証
    const maxCapacity = bufferSettings.maxLots * effectiveLotSize;
    if (bufferSettings.initialStock > maxCapacity) {
      errors.push(`初期在庫数(${bufferSettings.initialStock})が最大容量(${maxCapacity})を超えています`);
    }
    
    if (bufferSettings.safetyStock > maxCapacity) {
      errors.push(`安全在庫数(${bufferSettings.safetyStock})が最大容量(${maxCapacity})を超えています`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * バッファ設定の自動修正
   */
  static correctBufferSettings(
    materialId: string,
    bufferSettings: MaterialInput['bufferSettings'],
    products: Product[],
    components: any[] = []
  ): MaterialInput['bufferSettings'] {
    const productLotSize = this.getLotSize(materialId, products);
    const componentLotSize = this.getTransportLotSize(materialId, components);
    const effectiveLotSize = Math.max(productLotSize, componentLotSize);
    
    return {
      ...bufferSettings,
      enabled: true, // 常に有効
      initialStock: this.floorToLotSize(bufferSettings.initialStock, effectiveLotSize),
      safetyStock: this.floorToLotSize(bufferSettings.safetyStock, effectiveLotSize),
      maxLots: Math.max(1, bufferSettings.maxLots) // 最低1ロット
    };
  }

  /**
   * バッファ使用率の計算
   */
  static calculateBufferUtilization(
    currentStock: number,
    maxLots: number,
    lotSize: number
  ): number {
    const maxCapacity = maxLots * lotSize;
    if (maxCapacity === 0) return 0;
    return Math.min(currentStock / maxCapacity, 1.0);
  }

  /**
   * バッファステータスの取得
   */
  static getBufferStatus(
    currentStock: number,
    safetyStock: number,
    maxLots: number,
    lotSize: number
  ): 'empty' | 'low' | 'normal' | 'high' | 'full' {
    if (currentStock === 0) return 'empty';
    
    const maxCapacity = maxLots * lotSize;
    const utilization = this.calculateBufferUtilization(currentStock, maxLots, lotSize);
    
    if (currentStock <= safetyStock) return 'low';
    if (currentStock >= maxCapacity) return 'full';
    if (utilization > 0.8) return 'high';
    return 'normal';
  }
}