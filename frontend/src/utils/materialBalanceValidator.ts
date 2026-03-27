import { Product, BOMItem } from '../types/productionTypes';

export interface MaterialBalanceIssue {
  nodeId: string;
  nodeName: string;
  productId: string;
  productName: string;
  issueType: 'shortage' | 'excess' | 'missing_bom';
  requiredQuantity: number;
  actualQuantity: number;
  shortageQuantity: number;
  materialId: string;
  materialName: string;
}

export interface MaterialBalanceResult {
  isValid: boolean;
  issues: MaterialBalanceIssue[];
  summary: {
    totalNodes: number;
    nodesWithIssues: number;
    totalIssues: number;
  };
}

/**
 * BOMと工程材料設定を照合して材料バランスを検証する
 */
export class MaterialBalanceValidator {
  private products: Product[];
  private bomItems: BOMItem[];
  private components: any[];

  constructor(products: Product[], bomItems: BOMItem[] = [], components: any[] = []) {
    this.products = products || [];
    this.bomItems = bomItems || [];
    this.components = components || [];
  }

  /**
   * ネットワーク全体の材料バランスを検証
   */
  validateNetwork(nodes: any[], processAdvancedData: Map<string, any>): MaterialBalanceResult {
    const issues: MaterialBalanceIssue[] = [];
    let nodesWithIssues = 0;
    
    console.log('🔍 Starting material balance validation...');
    console.log('🔍 Products available:', this.products.length);
    console.log('🔍 BOM items available:', this.bomItems.length);
    console.log('🔍 Components available:', this.components.length);
    console.log('🔍 Nodes to validate:', nodes.length);
    console.log('🔍 Process advanced data entries:', processAdvancedData.size);

    // 各工程ノードを検証
    const processNodes = nodes.filter(node => node.type === 'process');
    
    for (const node of processNodes) {
      const nodeIssues = this.validateNode(node, processAdvancedData);
      if (nodeIssues.length > 0) {
        issues.push(...nodeIssues);
        nodesWithIssues++;
      }
    }

    console.log('🔍 Validation completed:', {
      totalIssues: issues.length,
      nodesWithIssues,
      totalNodes: processNodes.length
    });

    return {
      isValid: issues.length === 0,
      issues,
      summary: {
        totalNodes: processNodes.length,
        nodesWithIssues,
        totalIssues: issues.length
      }
    };
  }

  /**
   * 完成品が投入材料として使用されているかチェック
   */
  private isFinishedProductUsedAsInput(productId: string, processAdvancedData: Map<string, any>): boolean {
    for (const [nodeId, data] of processAdvancedData.entries()) {
      if (data.inputMaterials && Array.isArray(data.inputMaterials)) {
        const product = this.products.find(p => p.id === productId);
        const productName = product?.name;
        
        const hasFinishedProductAsInput = data.inputMaterials.some((input: any) => 
          input.materialId === productId || 
          input.productId === productId ||
          (productName && input.materialName === productName)
        );
        if (hasFinishedProductAsInput) {
          console.log(`🔍 Finished product ${productId} is used as input material in node ${nodeId}`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 単一ノードの材料バランスを検証
   */
  private validateNode(node: any, processAdvancedData: Map<string, any>): MaterialBalanceIssue[] {
    const issues: MaterialBalanceIssue[] = [];
    const nodeId = node.id;
    const nodeName = node.data?.label || nodeId;
    
    console.log(`🔍 Validating node: ${nodeName} (${nodeId})`);

    // 工程の詳細データを取得
    const processData = processAdvancedData.get(nodeId);
    if (!processData || !processData.outputProducts) {
      console.log(`🔍 No process data or output products for node: ${nodeId}`);
      return issues;
    }

    console.log(`🔍 Node ${nodeId} output products:`, processData.outputProducts?.length || 0);

    // 各出力製品について材料バランスを検証
    for (const outputProduct of processData.outputProducts) {
      const productIssues = this.validateProductMaterials(
        nodeId,
        nodeName,
        outputProduct,
        processData.inputMaterials || [],
        processAdvancedData
      );
      issues.push(...productIssues);
    }

    return issues;
  }

  /**
   * 製品の材料バランスを検証
   */
  private validateProductMaterials(
    nodeId: string,
    nodeName: string,
    outputProduct: any,
    inputMaterials: any[],
    processAdvancedData: Map<string, any>
  ): MaterialBalanceIssue[] {
    const issues: MaterialBalanceIssue[] = [];
    const productId = outputProduct.productId;
    const productName = outputProduct.productName || productId;
    const outputQuantity = outputProduct.outputQuantity || 1;

    console.log(`🔍 Validating product: ${productName} (${productId}) - Output: ${outputQuantity}`);

    // 製品のBOMを取得
    const product = this.products.find(p => p.id === productId || p.code === productId);
    if (!product) {
      console.log(`🔍 Product not found in product list: ${productId}`);
      return issues;
    }

    // 入出力が同じ部品の場合（検査工程等）はBOM検証不要
    const inputIds = inputMaterials.map((m: any) => m.materialId);
    if (inputIds.includes(productId)) {
      console.log(`🔍 Input/Output same product (inspection/pass-through): ${productName} - skipping BOM check`);
      return issues;
    }

    // 製品のBOMアイテムを取得（networkレベル: parent_product / componentレベル: parentProductId）
    let productBomItems = this.bomItems.filter(item =>
      (item as any).parent_product === productId ||
      (item as any).parent_product === product.code ||
      (item as any).parent_product === product.id ||
      item.parentProductId === productId ||
      item.parentProductId === product.code ||
      item.parentProductId === product.id
    );

    // ネットワークレベルのBOMが見つからない場合、コンポーネントレベルを確認
    if ((!productBomItems || productBomItems.length === 0) && this.components.length > 0) {
      console.log(`🔍 No network BOM found, checking component BOM for: ${productName}`);
      const component = this.components.find(c => 
        c.id === productId || 
        c.code === productId || 
        c.name === productName
      );
      
      if (component && component.bomItems && component.bomItems.length > 0) {
        console.log(`🔍 Found component BOM for ${productName}:`, component.bomItems.length, 'items');
        // ComponentBOMItemをBOMItemフォーマットに変換
        productBomItems = component.bomItems.map((item: any) => ({
          id: item.id,
          parentProductId: item.parentProductId,
          childProductId: item.childProductId,
          quantity: item.quantity,
          unit: item.unit,
          isOptional: item.isOptional,
          effectiveDate: item.effectiveDate,
          expiryDate: item.expiryDate,
          alternativeProducts: item.alternativeProducts || [],
          notes: item.notes
        }));
      }
    }

    if (!productBomItems || productBomItems.length === 0) {
      // 製品タイプに応じてBOMの必要性を判定
      const productType = product.type;
      const bomRequiredTypes = ['sub_assembly', 'finished_product'];
      const bomOptionalTypes = ['defective_product']; // 元製品のBOMを継承する場合がある
      const bomNotRequiredTypes = ['raw_material', 'component'];
      
      console.log(`🔍 No BOM found for product: ${productName}, type: ${productType}`);
      
      if (bomNotRequiredTypes.includes(productType)) {
        console.log(`🔍 Product type '${productType}' does not require BOM - skipping validation`);
        return issues; // BOMが不要な製品タイプの場合はエラーにしない
      }
      
      // 完成品が他の工程で投入材料として使用されている場合（スルーや不良品修理）はBOM不要
      if (productType === 'finished_product') {
        const isUsedAsInput = this.isFinishedProductUsedAsInput(productId, processAdvancedData);
        if (isUsedAsInput) {
          console.log(`🔍 Finished product '${productName}' is used as input material (through/rework case) - skipping BOM validation`);
          return issues; // 投入材料として使用される完成品の場合はエラーにしない
        }
      }
      
      if (bomRequiredTypes.includes(productType)) {
        console.log(`🔍 Product type '${productType}' requires BOM but none found - adding missing_bom issue`);
        issues.push({
          nodeId,
          nodeName,
          productId,
          productName,
          issueType: 'missing_bom',
          requiredQuantity: 0,
          actualQuantity: 0,
          shortageQuantity: 0,
          materialId: '',
          materialName: `BOMが設定されていません（${productType}には必須）`
        });
        return issues;
      }
      
      if (bomOptionalTypes.includes(productType)) {
        console.log(`🔍 Product type '${productType}' may require BOM - issuing warning`);
        // 不良品の場合は警告レベル（元製品のBOMを確認する必要がある）
        issues.push({
          nodeId,
          nodeName,
          productId,
          productName,
          issueType: 'missing_bom',
          requiredQuantity: 0,
          actualQuantity: 0,
          shortageQuantity: 0,
          materialId: '',
          materialName: `BOM確認が必要（${productType}）`
        });
        return issues;
      }
      
      // 未知の製品タイプの場合は警告
      console.log(`🔍 Unknown product type '${productType}' - issuing warning`);
      issues.push({
        nodeId,
        nodeName,
        productId,
        productName,
        issueType: 'missing_bom',
        requiredQuantity: 0,
        actualQuantity: 0,
        shortageQuantity: 0,
        materialId: '',
        materialName: `製品タイプ不明（${productType}）- BOM確認が必要`
      });
      return issues;
    }

    console.log(`🔍 Product ${productName} BOM items:`, productBomItems.length);

    // BOMの各材料について必要数量を計算し、投入材料と比較
    for (const bomItem of productBomItems) {
      const requiredQuantity = bomItem.quantity * outputQuantity;
      const materialId = bomItem.childProductId || (bomItem as any).child_product;
      
      // 対応する投入材料を検索
      const inputMaterial = inputMaterials.find(input => 
        input.materialId === materialId || 
        input.productId === materialId
      );

      const actualQuantity = inputMaterial ? (inputMaterial.requiredQuantity || 0) : 0;
      const materialName = this.getMaterialName(materialId) || materialId;

      console.log(`🔍 Material ${materialName}: Required=${requiredQuantity}, Actual=${actualQuantity}`);

      if (actualQuantity < requiredQuantity) {
        const shortageQuantity = requiredQuantity - actualQuantity;
        issues.push({
          nodeId,
          nodeName,
          productId,
          productName,
          issueType: 'shortage',
          requiredQuantity,
          actualQuantity,
          shortageQuantity,
          materialId,
          materialName
        });

        console.log(`🔍 ⚠️ Material shortage detected: ${materialName} shortage=${shortageQuantity}`);
      } else if (actualQuantity > requiredQuantity) {
        issues.push({
          nodeId,
          nodeName,
          productId,
          productName,
          issueType: 'excess',
          requiredQuantity,
          actualQuantity,
          shortageQuantity: actualQuantity - requiredQuantity,
          materialId,
          materialName
        });

        console.log(`🔍 ℹ️ Material excess detected: ${materialName} excess=${actualQuantity - requiredQuantity}`);
      }
    }

    return issues;
  }

  /**
   * 材料IDから材料名を取得
   */
  private getMaterialName(materialId: string): string | null {
    const material = this.products.find(p => p.id === materialId || p.code === materialId);
    return material ? material.name : null;
  }
}