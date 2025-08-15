"""
強化されたファクトチェックツール
SIMULATION_IMPLEMENTATION_PLAN.mdの仕様に基づいた高度なファクトチェック機能
"""
import asyncio
import json
import uuid
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from pydantic import BaseModel

from app.tools.fact_checker import FactChecker, CheckResult, CheckSeverity, CheckSummary
from app.core.data_integration import DataTransformationResult
from app.models.factory import Factory
from app.core.resource_manager import ResourceManager

class IntegrityCheckResult(BaseModel):
    """整合性チェック結果"""
    issues: List[CheckResult]
    severity: CheckSeverity
    recommendations: List[str]
    
    class Config:
        arbitrary_types_allowed = True
    
class ValidationResult(BaseModel):
    """検証結果"""
    issues: List[CheckResult]
    severity: CheckSeverity
    recommendations: List[str]
    
    class Config:
        arbitrary_types_allowed = True
    
class FeasibilityResult(BaseModel):
    """実行可能性結果"""
    is_feasible: bool
    issues: List[CheckResult]
    recommendations: List[str]
    
    class Config:
        arbitrary_types_allowed = True
    
class PerformancePrediction(BaseModel):
    """パフォーマンス予測"""
    throughput: Dict[str, Any]
    bottlenecks: List[Dict[str, Any]]
    utilization: Dict[str, Any]
    confidence_level: float
    
    class Config:
        arbitrary_types_allowed = True

class AnomalyDetectionResult(BaseModel):
    """異常検知結果"""
    anomalies: List[CheckResult]
    severity: CheckSeverity
    immediate_actions: List[str]
    
    class Config:
        arbitrary_types_allowed = True

class PredictiveAlertResult(BaseModel):
    """予測アラート結果"""
    alerts: List[CheckResult]
    time_horizon: str
    confidence_level: float
    
    class Config:
        arbitrary_types_allowed = True

class ConnectivityChecker:
    """接続性チェッカー"""
    
    async def check(self, network_data: Dict[str, Any]) -> List[CheckResult]:
        """接続性をチェック"""
        results = []
        nodes = network_data.get('nodes', [])
        edges = network_data.get('edges', [])
        
        # ノードIDの収集
        node_ids = {node['id'] for node in nodes}
        
        # 孤立ノードの検出
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge.get('source'))
            connected_nodes.add(edge.get('target'))
            
        isolated_nodes = node_ids - connected_nodes
        
        if isolated_nodes:
            results.append(CheckResult(
                check_name="isolated_nodes",
                severity=CheckSeverity.ERROR,
                message=f"孤立したノードが{len(isolated_nodes)}個検出されました",
                details={"isolated_nodes": list(isolated_nodes)},
                fix_suggestions=[
                    "孤立したノードを他のノードと接続する",
                    "不要なノードを削除する",
                    "ネットワーク設計を見直す"
                ]
            ))
            
        # 入出力の妥当性チェック
        for node in nodes:
            node_id = node['id']
            node_data = node.get('data', {})
            node_type = node_data.get('type', 'unknown')
            
            incoming_edges = [e for e in edges if e.get('target') == node_id]
            outgoing_edges = [e for e in edges if e.get('source') == node_id]
            
            # ストアノードの特別チェック
            if node_type == 'store':
                if not incoming_edges:
                    results.append(CheckResult(
                        check_name="store_no_input",
                        severity=CheckSeverity.ERROR,
                        message=f"ストアノード '{node_data.get('label', node_id)}' に入力がありません",
                        details={"node_id": node_id, "node_type": node_type},
                        fix_suggestions=[
                            "前工程からの接続を追加する",
                            "ストアノードの配置を見直す"
                        ]
                    ))
                    
            # 終端ノード以外の出力チェック
            elif node_type not in ['store', 'shipping']:
                if not outgoing_edges:
                    results.append(CheckResult(
                        check_name="process_no_output",
                        severity=CheckSeverity.WARNING,
                        message=f"工程ノード '{node_data.get('label', node_id)}' に出力がありません",
                        details={"node_id": node_id, "node_type": node_type},
                        fix_suggestions=[
                            "次工程への接続を追加する",
                            "ストアノードまたは出荷ノードを追加する"
                        ]
                    ))
                    
        return results

class CycleDetector:
    """循環参照検出器"""
    
    async def detect(self, network_data: Dict[str, Any]) -> List[CheckResult]:
        """循環参照を検出"""
        results = []
        edges = network_data.get('edges', [])
        
        # グラフ構築
        graph = {}
        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            if source not in graph:
                graph[source] = []
            graph[source].append(target)
            
        # DFSで循環検出
        def has_cycle(node: str, visited: set, rec_stack: set, path: List[str]) -> Optional[List[str]]:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    cycle_path = has_cycle(neighbor, visited, rec_stack, path.copy())
                    if cycle_path:
                        return cycle_path
                elif neighbor in rec_stack:
                    # 循環を発見
                    cycle_start = path.index(neighbor)
                    return path[cycle_start:] + [neighbor]
                    
            rec_stack.remove(node)
            return None
            
        visited = set()
        for node in graph:
            if node not in visited:
                cycle_path = has_cycle(node, visited, set(), [])
                if cycle_path:
                    results.append(CheckResult(
                        check_name="circular_reference",
                        severity=CheckSeverity.CRITICAL,
                        message="循環参照が検出されました",
                        details={
                            "cycle_path": cycle_path,
                            "cycle_length": len(cycle_path) - 1
                        },
                        fix_suggestions=[
                            "循環している接続を削除する",
                            "工程の順序を見直す",
                            "フィードバックループが必要な場合は適切に設計する"
                        ]
                    ))
                    break
                    
        return results

class MaterialFlowChecker:
    """材料フローチェッカー"""
    
    async def check(self, network_data: Dict[str, Any]) -> List[CheckResult]:
        """材料フローをチェック"""
        results = []
        nodes = network_data.get('nodes', [])
        edges = network_data.get('edges', [])
        process_advanced_data = network_data.get('process_advanced_data', {})
        
        for node in nodes:
            node_id = node['id']
            node_data = node.get('data', {})
            advanced_data = process_advanced_data.get(node_id, {})
            
            if node_data.get('type') == 'store':
                continue
                
            # 入力材料の一致性チェック
            incoming_edges = [e for e in edges if e.get('target') == node_id]
            input_materials = advanced_data.get('inputMaterials', [])
            
            if incoming_edges and not input_materials:
                results.append(CheckResult(
                    check_name="missing_input_definition",
                    severity=CheckSeverity.WARNING,
                    message=f"工程 '{node_data.get('label', node_id)}' の入力材料が定義されていません",
                    details={
                        "node_id": node_id,
                        "incoming_connections": len(incoming_edges)
                    },
                    fix_suggestions=[
                        "BOMマネージャーで入力材料を設定する",
                        "材料フロー設定ダイアログを確認する"
                    ]
                ))
                
            # 出力製品の一致性チェック
            outgoing_edges = [e for e in edges if e.get('source') == node_id]
            output_products = advanced_data.get('outputProducts', [])
            
            if outgoing_edges and not output_products:
                results.append(CheckResult(
                    check_name="missing_output_definition",
                    severity=CheckSeverity.WARNING,
                    message=f"工程 '{node_data.get('label', node_id)}' の出力製品が定義されていません",
                    details={
                        "node_id": node_id,
                        "outgoing_connections": len(outgoing_edges)
                    },
                    fix_suggestions=[
                        "BOMマネージャーで出力製品を設定する",
                        "材料フロー設定ダイアログを確認する"
                    ]
                ))
                
            # BOMマッピングの整合性チェック
            bom_mappings = advanced_data.get('bomMappings', [])
            if input_materials and output_products and not bom_mappings:
                results.append(CheckResult(
                    check_name="missing_bom_mapping",
                    severity=CheckSeverity.ERROR,
                    message=f"工程 '{node_data.get('label', node_id)}' のBOMマッピングが定義されていません",
                    details={
                        "node_id": node_id,
                        "input_materials_count": len(input_materials),
                        "output_products_count": len(output_products)
                    },
                    fix_suggestions=[
                        "BOMマッピングを設定する",
                        "入力と出力の関係を明確にする"
                    ]
                ))
                
        return results

class NetworkIntegrityChecker:
    """ネットワーク整合性チェッカー（強化版）"""
    
    def __init__(self):
        self.connectivity_checker = ConnectivityChecker()
        self.cycle_detector = CycleDetector()
        self.material_flow_checker = MaterialFlowChecker()
        
    async def check_network_integrity(self, network_data: Dict[str, Any]) -> IntegrityCheckResult:
        """ネットワーク整合性の包括的チェック"""
        all_issues = []
        
        # 接続性チェック
        connectivity_issues = await self.connectivity_checker.check(network_data)
        all_issues.extend(connectivity_issues)
        
        # 循環参照チェック
        cycle_issues = await self.cycle_detector.detect(network_data)
        all_issues.extend(cycle_issues)
        
        # 材料フローチェック
        flow_issues = await self.material_flow_checker.check(network_data)
        all_issues.extend(flow_issues)
        
        # 全体的な重要度を計算
        severity = self._calculate_overall_severity(all_issues)
        
        # 推奨事項を生成
        recommendations = self._generate_recommendations(all_issues)
        
        return IntegrityCheckResult(
            issues=all_issues,
            severity=severity,
            recommendations=recommendations
        )
        
    def _calculate_overall_severity(self, issues: List[CheckResult]) -> CheckSeverity:
        """全体的な重要度を計算"""
        if not issues:
            return CheckSeverity.INFO
            
        severities = [issue.severity for issue in issues]
        
        if CheckSeverity.CRITICAL in severities:
            return CheckSeverity.CRITICAL
        elif CheckSeverity.ERROR in severities:
            return CheckSeverity.ERROR
        elif CheckSeverity.WARNING in severities:
            return CheckSeverity.WARNING
        else:
            return CheckSeverity.INFO
            
    def _generate_recommendations(self, issues: List[CheckResult]) -> List[str]:
        """推奨事項を生成"""
        recommendations = []
        
        # 重要度別の推奨事項
        critical_issues = [i for i in issues if i.severity == CheckSeverity.CRITICAL]
        error_issues = [i for i in issues if i.severity == CheckSeverity.ERROR]
        
        if critical_issues:
            recommendations.append("重大な問題があります。シミュレーション実行前に必ず修正してください。")
            
        if error_issues:
            recommendations.append("エラーが検出されました。正確なシミュレーション結果のために修正を推奨します。")
            
        # 共通的な推奨事項
        issue_types = set(issue.check_name for issue in issues)
        
        if "isolated_nodes" in issue_types:
            recommendations.append("ネットワーク全体の接続性を確認してください。")
            
        if "circular_reference" in issue_types:
            recommendations.append("工程の流れを見直し、適切な順序にしてください。")
            
        if any("missing_" in issue_type for issue_type in issue_types):
            recommendations.append("材料フローとBOM設定の整合性を確認してください。")
            
        return recommendations

class BOMStructureChecker:
    """BOM構造チェッカー"""
    
    async def check(self, bom_data: Dict[str, Any]) -> List[CheckResult]:
        """BOM構造をチェック"""
        results = []
        
        bom_items = bom_data.get('bom_items', [])
        products = bom_data.get('products', [])
        
        if not bom_items:
            results.append(CheckResult(
                check_name="empty_bom",
                severity=CheckSeverity.WARNING,
                message="BOMアイテムが定義されていません",
                details={"bom_items_count": 0},
                fix_suggestions=[
                    "BOMマネージャーで部品表を作成する",
                    "製品の構成要素を定義する"
                ]
            ))
            return results
            
        # 製品IDマップを作成
        product_ids = {product['id'] for product in products}
        
        # BOMアイテムの検証
        for item in bom_items:
            parent_id = item.get('parentProductId')
            child_id = item.get('childProductId')
            quantity = item.get('quantity', 0)
            
            # 親製品の存在確認
            if parent_id and parent_id not in product_ids:
                results.append(CheckResult(
                    check_name="missing_parent_product",
                    severity=CheckSeverity.ERROR,
                    message=f"親製品 '{parent_id}' が製品マスターに存在しません",
                    details={"bom_item": item, "parent_id": parent_id},
                    fix_suggestions=[
                        "製品マスターに親製品を追加する",
                        "BOMアイテムの親製品IDを修正する"
                    ]
                ))
                
            # 子製品の存在確認
            if child_id and child_id not in product_ids:
                results.append(CheckResult(
                    check_name="missing_child_product",
                    severity=CheckSeverity.ERROR,
                    message=f"子製品 '{child_id}' が製品マスターに存在しません",
                    details={"bom_item": item, "child_id": child_id},
                    fix_suggestions=[
                        "製品マスターに子製品を追加する",
                        "BOMアイテムの子製品IDを修正する"
                    ]
                ))
                
            # 数量の検証
            if quantity <= 0:
                results.append(CheckResult(
                    check_name="invalid_bom_quantity",
                    severity=CheckSeverity.ERROR,
                    message=f"BOMアイテムの数量が無効です: {quantity}",
                    details={"bom_item": item, "quantity": quantity},
                    fix_suggestions=[
                        "数量を正の値に設定する",
                        "BOMアイテムの設定を確認する"
                    ]
                ))
                
        return results

class QuantityConsistencyChecker:
    """数量整合性チェッカー"""
    
    async def check(self, bom_data: Dict[str, Any]) -> List[CheckResult]:
        """数量の整合性をチェック"""
        results = []
        
        bom_items = bom_data.get('bom_items', [])
        
        # 製品別の集計
        product_usage = {}
        for item in bom_items:
            parent_id = item.get('parentProductId')
            child_id = item.get('childProductId')
            quantity = item.get('quantity', 0)
            
            if parent_id not in product_usage:
                product_usage[parent_id] = {}
            
            if child_id in product_usage[parent_id]:
                # 重複する子製品
                results.append(CheckResult(
                    check_name="duplicate_bom_item",
                    severity=CheckSeverity.WARNING,
                    message=f"製品 '{parent_id}' で子製品 '{child_id}' が重複しています",
                    details={
                        "parent_id": parent_id,
                        "child_id": child_id,
                        "existing_quantity": product_usage[parent_id][child_id],
                        "new_quantity": quantity
                    },
                    fix_suggestions=[
                        "重複するBOMアイテムを統合する",
                        "数量を合計して1つのアイテムにする"
                    ]
                ))
            else:
                product_usage[parent_id][child_id] = quantity
                
        return results

class DependencyChecker:
    """依存関係チェッカー"""
    
    async def check(self, bom_data: Dict[str, Any]) -> List[CheckResult]:
        """依存関係をチェック"""
        results = []
        
        bom_items = bom_data.get('bom_items', [])
        
        # 依存関係グラフを構築
        dependencies = {}
        for item in bom_items:
            parent_id = item.get('parentProductId')
            child_id = item.get('childProductId')
            
            if parent_id not in dependencies:
                dependencies[parent_id] = set()
            dependencies[parent_id].add(child_id)
            
        # 循環依存の検出
        def has_circular_dependency(product_id: str, visited: set, path: List[str]) -> Optional[List[str]]:
            if product_id in visited:
                if product_id in path:
                    cycle_start = path.index(product_id)
                    return path[cycle_start:] + [product_id]
                return None
                
            visited.add(product_id)
            path.append(product_id)
            
            for child_id in dependencies.get(product_id, set()):
                cycle = has_circular_dependency(child_id, visited.copy(), path.copy())
                if cycle:
                    return cycle
                    
            return None
            
        visited = set()
        for product_id in dependencies:
            if product_id not in visited:
                cycle = has_circular_dependency(product_id, set(), [])
                if cycle:
                    results.append(CheckResult(
                        check_name="circular_dependency",
                        severity=CheckSeverity.CRITICAL,
                        message="BOMに循環依存が検出されました",
                        details={
                            "cycle_path": cycle,
                            "cycle_length": len(cycle) - 1
                        },
                        fix_suggestions=[
                            "循環する依存関係を解消する",
                            "BOM構造を見直す",
                            "代替部品の使用を検討する"
                        ]
                    ))
                    break
                    
        return results

class BOMIntegrityChecker:
    """BOM整合性チェッカー（強化版）"""
    
    def __init__(self):
        self.structure_checker = BOMStructureChecker()
        self.quantity_checker = QuantityConsistencyChecker()
        self.dependency_checker = DependencyChecker()
        
    async def check_bom_integrity(self, bom_data: Dict[str, Any]) -> IntegrityCheckResult:
        """BOM整合性の包括的チェック"""
        all_issues = []
        
        # BOM構造チェック
        structure_issues = await self.structure_checker.check(bom_data)
        all_issues.extend(structure_issues)
        
        # 数量整合性チェック
        quantity_issues = await self.quantity_checker.check(bom_data)
        all_issues.extend(quantity_issues)
        
        # 依存関係チェック
        dependency_issues = await self.dependency_checker.check(bom_data)
        all_issues.extend(dependency_issues)
        
        # 全体的な重要度を計算
        severity = self._calculate_overall_severity(all_issues)
        
        # 推奨事項を生成
        recommendations = self._generate_recommendations(all_issues)
        
        return IntegrityCheckResult(
            issues=all_issues,
            severity=severity,
            recommendations=recommendations
        )
        
    def _calculate_overall_severity(self, issues: List[CheckResult]) -> CheckSeverity:
        """全体的な重要度を計算"""
        if not issues:
            return CheckSeverity.INFO
            
        severities = [issue.severity for issue in issues]
        
        if CheckSeverity.CRITICAL in severities:
            return CheckSeverity.CRITICAL
        elif CheckSeverity.ERROR in severities:
            return CheckSeverity.ERROR
        elif CheckSeverity.WARNING in severities:
            return CheckSeverity.WARNING
        else:
            return CheckSeverity.INFO
            
    def _generate_recommendations(self, issues: List[CheckResult]) -> List[str]:
        """推奨事項を生成"""
        recommendations = []
        
        if not issues:
            recommendations.append("BOM構造は正常です。")
            return recommendations
            
        issue_types = set(issue.check_name for issue in issues)
        
        if "circular_dependency" in issue_types:
            recommendations.append("循環依存を解消してからシミュレーションを実行してください。")
            
        if any("missing_" in issue_type for issue_type in issue_types):
            recommendations.append("製品マスターの整備を行ってください。")
            
        if "duplicate_bom_item" in issue_types:
            recommendations.append("重複するBOMアイテムを統合してください。")
            
        return recommendations

class EnhancedFactChecker:
    """強化されたファクトチェッカー"""
    
    def __init__(self):
        self.network_checker = NetworkIntegrityChecker()
        self.bom_checker = BOMIntegrityChecker()
        self.base_checker = FactChecker()
        
    async def comprehensive_check(self, transformation_result: DataTransformationResult) -> Dict[str, Any]:
        """包括的なファクトチェック"""
        start_time = datetime.now()
        
        # 基本データの準備
        factory = transformation_result.factory
        project_data = {
            "nodes": [],  # TODO: factory から nodes を復元
            "edges": [],  # TODO: factory から edges を復元
            "products": [product.dict() for product in factory.products.values()],
            "bom_items": [],  # TODO: BOMアイテムの復元
            "process_advanced_data": {}  # TODO: 高度なプロセスデータの復元
        }
        
        results = {}
        
        # ネットワーク整合性チェック
        try:
            network_result = await self.network_checker.check_network_integrity(project_data)
            results["network_integrity"] = {
                "status": "completed",
                "issues_count": len(network_result.issues),
                "severity": network_result.severity.value,
                "issues": [issue.dict() for issue in network_result.issues],
                "recommendations": network_result.recommendations
            }
        except Exception as e:
            results["network_integrity"] = {
                "status": "error",
                "error": str(e)
            }
            
        # BOM整合性チェック
        try:
            bom_result = await self.bom_checker.check_bom_integrity(project_data)
            results["bom_integrity"] = {
                "status": "completed",
                "issues_count": len(bom_result.issues),
                "severity": bom_result.severity.value,
                "issues": [issue.dict() for issue in bom_result.issues],
                "recommendations": bom_result.recommendations
            }
        except Exception as e:
            results["bom_integrity"] = {
                "status": "error", 
                "error": str(e)
            }
            
        # 基本的なファクトチェック
        try:
            base_summary = self.base_checker.run_all_checks(project_data)
            results["basic_checks"] = {
                "status": "completed",
                "summary": {
                    "total_checks": base_summary.total_checks,
                    "passed": base_summary.passed,
                    "warnings": base_summary.warnings,
                    "errors": base_summary.errors,
                    "critical": base_summary.critical
                },
                "issues": [result.dict() for result in self.base_checker.results]
            }
        except Exception as e:
            results["basic_checks"] = {
                "status": "error",
                "error": str(e)
            }
            
        # 実行時間を記録
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # 全体的なサマリー
        total_issues = 0
        total_critical = 0
        total_errors = 0
        total_warnings = 0
        
        for check_result in results.values():
            if check_result.get("status") == "completed":
                if "issues_count" in check_result:
                    total_issues += check_result["issues_count"]
                if "summary" in check_result:
                    summary = check_result["summary"]
                    total_critical += summary.get("critical", 0)
                    total_errors += summary.get("errors", 0)
                    total_warnings += summary.get("warnings", 0)
                    
        # 全体的な推奨事項
        overall_recommendations = []
        if total_critical > 0:
            overall_recommendations.append("重大な問題があります。シミュレーション実行前に必ず修正してください。")
        if total_errors > 0:
            overall_recommendations.append("エラーが検出されました。修正を推奨します。")
        if total_warnings > 0:
            overall_recommendations.append("警告があります。必要に応じて確認してください。")
        if total_issues == 0:
            overall_recommendations.append("全てのチェックが正常に完了しました。")
            
        return {
            "check_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "execution_time": execution_time,
            "overall_status": "critical" if total_critical > 0 else "error" if total_errors > 0 else "warning" if total_warnings > 0 else "success",
            "summary": {
                "total_issues": total_issues,
                "critical": total_critical,
                "errors": total_errors,
                "warnings": total_warnings
            },
            "recommendations": overall_recommendations,
            "detailed_results": results
        }
        
    async def realtime_monitor(self, simulation_data: Dict[str, Any]) -> AnomalyDetectionResult:
        """リアルタイム監視"""
        anomalies = []
        
        # パフォーマンス劣化の検出
        current_kpis = simulation_data.get("kpis", {})
        if current_kpis:
            throughput = current_kpis.get("total_production", 0)
            utilization = current_kpis.get("equipment_utilization", 0)
            
            if throughput < 0.5:  # 期待値の50%以下
                anomalies.append(CheckResult(
                    check_name="low_throughput",
                    severity=CheckSeverity.WARNING,
                    message="スループットが低下しています",
                    details={"current_throughput": throughput},
                    fix_suggestions=[
                        "ボトルネック工程を特定する",
                        "設備稼働率を確認する"
                    ]
                ))
                
            if utilization < 60:  # 60%以下
                anomalies.append(CheckResult(
                    check_name="low_utilization",
                    severity=CheckSeverity.INFO,
                    message="設備稼働率が低下しています",
                    details={"current_utilization": utilization},
                    fix_suggestions=[
                        "需要と供給のバランスを確認する",
                        "段取り時間を見直す"
                    ]
                ))
                
        # 在庫異常の検出
        inventories = simulation_data.get("inventories", {})
        for buffer_id, inventory_data in inventories.items():
            total_qty = inventory_data.get("total", 0)
            if total_qty > 1000:  # 過剰在庫
                anomalies.append(CheckResult(
                    check_name="excessive_inventory",
                    severity=CheckSeverity.WARNING,
                    message=f"バッファ {buffer_id} で過剰在庫が発生しています",
                    details={"buffer_id": buffer_id, "quantity": total_qty},
                    fix_suggestions=[
                        "後工程の処理能力を確認する",
                        "バッファサイズを調整する"
                    ]
                ))
                
        # 重要度を計算
        severity = CheckSeverity.INFO
        if anomalies:
            severities = [anomaly.severity for anomaly in anomalies]
            if CheckSeverity.CRITICAL in severities:
                severity = CheckSeverity.CRITICAL
            elif CheckSeverity.ERROR in severities:
                severity = CheckSeverity.ERROR
            elif CheckSeverity.WARNING in severities:
                severity = CheckSeverity.WARNING
                
        # 即座に実行すべきアクション
        immediate_actions = []
        if severity in [CheckSeverity.CRITICAL, CheckSeverity.ERROR]:
            immediate_actions.append("シミュレーションを一時停止して問題を調査する")
        if any(anomaly.check_name == "excessive_inventory" for anomaly in anomalies):
            immediate_actions.append("在庫レベルを確認し、必要に応じてバッファサイズを調整する")
            
        return AnomalyDetectionResult(
            anomalies=anomalies,
            severity=severity,
            immediate_actions=immediate_actions
        )
        
    async def generate_predictive_alerts(self, historical_data: List[Dict[str, Any]]) -> PredictiveAlertResult:
        """予測アラートを生成"""
        alerts = []
        
        if len(historical_data) < 2:
            return PredictiveAlertResult(
                alerts=[],
                time_horizon="insufficient_data",
                confidence_level=0.0
            )
            
        # トレンド分析
        recent_data = historical_data[-5:]  # 直近5件
        
        # スループットのトレンド
        throughputs = [data.get("kpis", {}).get("total_production", 0) for data in recent_data]
        if len(throughputs) >= 3:
            trend = (throughputs[-1] - throughputs[0]) / len(throughputs)
            if trend < -0.1:  # 減少トレンド
                alerts.append(CheckResult(
                    check_name="declining_throughput_trend",
                    severity=CheckSeverity.WARNING,
                    message="スループットの減少傾向が予測されます",
                    details={
                        "trend": trend,
                        "recent_throughputs": throughputs
                    },
                    fix_suggestions=[
                        "予防保全を実施する",
                        "プロセス改善を検討する"
                    ]
                ))
                
        # 在庫レベルの予測
        for buffer_id in set().union(*[data.get("inventories", {}).keys() for data in recent_data]):
            buffer_levels = []
            for data in recent_data:
                inventory_data = data.get("inventories", {}).get(buffer_id, {})
                buffer_levels.append(inventory_data.get("total", 0))
                
            if len(buffer_levels) >= 3:
                avg_change = sum(buffer_levels[i+1] - buffer_levels[i] for i in range(len(buffer_levels)-1)) / (len(buffer_levels)-1)
                predicted_next = buffer_levels[-1] + avg_change
                
                if predicted_next > 1500:  # 予測される過剰在庫
                    alerts.append(CheckResult(
                        check_name="predicted_inventory_overflow",
                        severity=CheckSeverity.WARNING,
                        message=f"バッファ {buffer_id} で在庫過多が予測されます",
                        details={
                            "current_level": buffer_levels[-1],
                            "predicted_level": predicted_next,
                            "buffer_id": buffer_id
                        },
                        fix_suggestions=[
                            "事前に後工程の処理能力を向上させる",
                            "在庫調整を実施する"
                        ]
                    ))
                    
        confidence_level = min(len(historical_data) / 10.0, 1.0)  # データ量に基づく信頼度
        
        return PredictiveAlertResult(
            alerts=alerts,
            time_horizon="next_30_minutes",
            confidence_level=confidence_level
        )
