"""
ProSimNez ファクトチェックツール

このモジュールは、シミュレーション実行前・実行中のデータ整合性と妥当性をチェックする
包括的なツールセットを提供します。
"""

import argparse
import json
import logging
import sys
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from pathlib import Path
import yaml
from dataclasses import dataclass, asdict
from enum import Enum

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CheckSeverity(Enum):
    """チェック結果の重要度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class CheckResult:
    """チェック結果のデータクラス"""
    check_name: str
    severity: CheckSeverity
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = None
    fix_suggestions: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class CheckSummary:
    """チェック結果のサマリー"""
    total_checks: int
    passed: int
    warnings: int
    errors: int
    critical: int
    execution_time: float
    timestamp: datetime

class NetworkIntegrityChecker:
    """ネットワーク整合性チェッカー"""
    
    def __init__(self):
        self.name = "NetworkIntegrityChecker"
    
    def check_connectivity(self, network_data: Dict) -> List[CheckResult]:
        """ネットワークの接続性をチェック"""
        results = []
        nodes = network_data.get('nodes', [])
        edges = network_data.get('edges', [])
        
        # ノードIDの収集
        node_ids = {node['id'] for node in nodes}
        
        # 孤立したノードのチェック
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge['source'])
            connected_nodes.add(edge['target'])
        
        isolated_nodes = node_ids - connected_nodes
        if isolated_nodes:
            results.append(CheckResult(
                check_name="isolated_nodes",
                severity=CheckSeverity.WARNING,
                message=f"孤立したノードが{len(isolated_nodes)}個見つかりました",
                details={"isolated_nodes": list(isolated_nodes)},
                fix_suggestions=[
                    "孤立したノードを他のノードと接続する",
                    "孤立したノードが不要な場合は削除する"
                ]
            ))
        
        # 接続数のチェック
        for node in nodes:
            incoming_edges = [e for e in edges if e['target'] == node['id']]
            outgoing_edges = [e for e in edges if e['source'] == node['id']]
            
            if node['data']['type'] == 'store' and incoming_edges == 0:
                results.append(CheckResult(
                    check_name="store_without_input",
                    severity=CheckSeverity.ERROR,
                    message=f"ストアノード '{node['data']['label']}' に入力接続がありません",
                    details={"node_id": node['id'], "node_type": node['data']['type']},
                    fix_suggestions=[
                        "前工程からの接続を追加する",
                        "ストアノードの設定を確認する"
                    ]
                ))
            
            if node['data']['type'] != 'store' and outgoing_edges == 0:
                results.append(CheckResult(
                    check_name="process_without_output",
                    severity=CheckSeverity.WARNING,
                    message=f"工程ノード '{node['data']['label']}' に出力接続がありません",
                    details={"node_id": node['id'], "node_type": node['data']['type']},
                    fix_suggestions=[
                        "次工程への接続を追加する",
                        "最終工程の場合はストアノードを追加する"
                    ]
                ))
        
        return results
    
    def check_cycles(self, network_data: Dict) -> List[CheckResult]:
        """循環参照をチェック"""
        results = []
        edges = network_data.get('edges', [])
        
        # 簡易的な循環検出（深さ優先探索）
        def has_cycle(node_id: str, visited: set, rec_stack: set, graph: Dict) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for neighbor in graph.get(node_id, []):
                if neighbor not in visited:
                    if has_cycle(neighbor, visited, rec_stack, graph):
                        return True
                elif neighbor in rec_stack:
                    return True
            
            rec_stack.remove(node_id)
            return False
        
        # グラフ構築
        graph = {}
        for edge in edges:
            if edge['source'] not in graph:
                graph[edge['source']] = []
            graph[edge['source']].append(edge['target'])
        
        # 循環チェック
        visited = set()
        for node_id in graph:
            if node_id not in visited:
                if has_cycle(node_id, visited, set(), graph):
                    results.append(CheckResult(
                        check_name="circular_reference",
                        severity=CheckSeverity.ERROR,
                        message="ネットワークに循環参照が検出されました",
                        details={"cycle_detected": True},
                        fix_suggestions=[
                            "循環している接続を特定して削除する",
                            "工程の依存関係を見直す"
                        ]
                    ))
                    break
        
        return results
    
    def check_material_flow(self, network_data: Dict) -> List[CheckResult]:
        """材料フローの整合性をチェック"""
        results = []
        nodes = network_data.get('nodes', [])
        edges = network_data.get('edges', [])
        process_advanced_data = network_data.get('process_advanced_data', {})
        
        for node in nodes:
            if node['data']['type'] == 'store':
                continue
                
            node_id = node['id']
            process_data = process_advanced_data.get(node_id, {})
            
            # 入力材料のチェック
            input_materials = process_data.get('inputMaterials', [])
            incoming_edges = [e for e in edges if e['target'] == node_id]
            
            if incoming_edges and not input_materials:
                results.append(CheckResult(
                    check_name="missing_input_materials",
                    severity=CheckSeverity.WARNING,
                    message=f"工程 '{node['data']['label']}' に入力接続がありますが、入力材料が設定されていません",
                    details={"node_id": node_id, "incoming_edges": len(incoming_edges)},
                    fix_suggestions=[
                        "材料設定ダイアログで入力材料を設定する",
                        "前工程の出力製品を確認する"
                    ]
                ))
            
            # 出力製品のチェック
            output_products = process_data.get('outputProducts', [])
            outgoing_edges = [e for e in edges if e['source'] == node_id]
            
            if outgoing_edges and not output_products:
                results.append(CheckResult(
                    check_name="missing_output_products",
                    severity=CheckSeverity.WARNING,
                    message=f"工程 '{node['data']['label']}' に出力接続がありますが、出力製品が設定されていません",
                    details={"node_id": node_id, "outgoing_edges": len(outgoing_edges)},
                    fix_suggestions=[
                        "材料設定ダイアログで出力製品を設定する",
                        "次工程の入力材料を確認する"
                    ]
                ))
        
        return results

class BOMIntegrityChecker:
    """BOM整合性チェッカー"""
    
    def __init__(self):
        self.name = "BOMIntegrityChecker"
    
    def check_bom_structure(self, bom_data: Dict) -> List[CheckResult]:
        """BOM構造の整合性をチェック"""
        results = []
        
        # BOMアイテムの存在チェック
        bom_items = bom_data.get('bom_items', [])
        if not bom_items:
            results.append(CheckResult(
                check_name="empty_bom",
                severity=CheckSeverity.INFO,
                message="BOMが設定されていません",
                details={"bom_items_count": 0},
                fix_suggestions=[
                    "BOMマネージャーで部品表を設定する",
                    "サンプルBOMを読み込む"
                ]
            ))
            return results
        
        # BOMアイテムの詳細チェック
        for item in bom_items:
            if not item.get('product_id'):
                results.append(CheckResult(
                    check_name="invalid_bom_item",
                    severity=CheckSeverity.ERROR,
                    message="無効なBOMアイテムが含まれています",
                    details={"item": item},
                    fix_suggestions=[
                        "BOMアイテムの設定を確認する",
                        "無効なアイテムを削除する"
                    ]
                ))
            
            if item.get('quantity', 0) <= 0:
                results.append(CheckResult(
                    check_name="invalid_quantity",
                    severity=CheckSeverity.ERROR,
                    message=f"BOMアイテム '{item.get('product_name', 'Unknown')}' の数量が無効です",
                    details={"item": item, "quantity": item.get('quantity')},
                    fix_suggestions=[
                        "数量を正の値に設定する",
                        "BOMアイテムの設定を確認する"
                    ]
                ))
        
        return results
    
    def check_quantity_consistency(self, bom_data: Dict) -> List[CheckResult]:
        """数量の整合性をチェック"""
        results = []
        
        # 製品の存在チェック
        products = bom_data.get('products', [])
        bom_items = bom_data.get('bom_items', [])
        
        product_ids = {p['id'] for p in products}
        
        for item in bom_items:
            if item.get('product_id') not in product_ids:
                results.append(CheckResult(
                    check_name="missing_product",
                    severity=CheckSeverity.ERROR,
                    message=f"BOMアイテム '{item.get('product_name', 'Unknown')}' に対応する製品が存在しません",
                    details={"item": item, "product_id": item.get('product_id')},
                    fix_suggestions=[
                        "製品マスターに製品を追加する",
                        "BOMアイテムの製品IDを修正する"
                    ]
                ))
        
        return results
    
    def check_circular_dependency(self, bom_data: Dict) -> List[CheckResult]:
        """循環依存関係をチェック"""
        results = []
        
        # 簡易的な循環依存チェック
        # 実際の実装では、より高度なアルゴリズムが必要
        
        return results

class ConfigurationValidator:
    """設定値妥当性チェッカー"""
    
    def __init__(self):
        self.name = "ConfigurationValidator"
    
    def validate_process_parameters(self, process_data: Dict) -> List[CheckResult]:
        """工程パラメータの妥当性をチェック"""
        results = []
        
        # サイクルタイムのチェック
        cycle_time = process_data.get('cycleTime', 0)
        if cycle_time <= 0:
            results.append(CheckResult(
                check_name="invalid_cycle_time",
                severity=CheckSeverity.ERROR,
                message="サイクルタイムが無効です",
                details={"cycle_time": cycle_time},
                fix_suggestions=[
                    "サイクルタイムを正の値に設定する",
                    "工程の基本設定を確認する"
                ]
            ))
        
        # 段取り時間のチェック
        setup_time = process_data.get('setupTime', 0)
        if setup_time < 0:
            results.append(CheckResult(
                check_name="invalid_setup_time",
                severity=CheckSeverity.WARNING,
                message="段取り時間が負の値です",
                details={"setup_time": setup_time},
                fix_suggestions=[
                    "段取り時間を0以上の値に設定する",
                    "工程の基本設定を確認する"
                ]
            ))
        
        # 設備数のチェック
        equipment_count = process_data.get('equipmentCount', 0)
        if equipment_count < 0:
            results.append(CheckResult(
                check_name="invalid_equipment_count",
                severity=CheckSeverity.ERROR,
                message="設備数が無効です",
                details={"equipment_count": equipment_count},
                fix_suggestions=[
                    "設備数を0以上の値に設定する",
                    "工程の基本設定を確認する"
                ]
            ))
        
        # 不良率のチェック
        defect_rate = process_data.get('defectRate', 0)
        if defect_rate < 0 or defect_rate > 100:
            results.append(CheckResult(
                check_name="invalid_defect_rate",
                severity=CheckSeverity.ERROR,
                message="不良率が無効です（0-100%の範囲である必要があります）",
                details={"defect_rate": defect_rate},
                fix_suggestions=[
                    "不良率を0-100%の範囲に設定する",
                    "工程の基本設定を確認する"
                ]
            ))
        
        return results
    
    def validate_time_settings(self, time_data: Dict) -> List[CheckResult]:
        """時間設定の妥当性をチェック"""
        results = []
        
        # シミュレーション時間のチェック
        simulation_time = time_data.get('simulationTime', 0)
        if simulation_time <= 0:
            results.append(CheckResult(
                check_name="invalid_simulation_time",
                severity=CheckSeverity.ERROR,
                message="シミュレーション時間が無効です",
                details={"simulation_time": simulation_time},
                fix_suggestions=[
                    "シミュレーション時間を正の値に設定する",
                    "シミュレーション設定を確認する"
                ]
            ))
        
        # 実行速度のチェック
        simulation_speed = time_data.get('simulationSpeed', 1.0)
        if simulation_speed <= 0:
            results.append(CheckResult(
                check_name="invalid_simulation_speed",
                severity=CheckSeverity.ERROR,
                message="シミュレーション速度が無効です",
                details={"simulation_speed": simulation_speed},
                fix_suggestions=[
                    "シミュレーション速度を正の値に設定する",
                    "シミュレーション設定を確認する"
                ]
            ))
        
        return results
    
    def validate_cost_settings(self, cost_data: Dict) -> List[CheckResult]:
        """コスト設定の妥当性をチェック"""
        results = []
        
        # 運転コストのチェック
        operating_cost = cost_data.get('operatingCost', 0)
        if operating_cost < 0:
            results.append(CheckResult(
                check_name="invalid_operating_cost",
                severity=CheckSeverity.WARNING,
                message="運転コストが負の値です",
                details={"operating_cost": operating_cost},
                fix_suggestions=[
                    "運転コストを0以上の値に設定する",
                    "工程の基本設定を確認する"
                ]
            ))
        
        return results

class SimulationFeasibilityChecker:
    """シミュレーション実行可能性チェッカー"""
    
    def __init__(self):
        self.name = "SimulationFeasibilityChecker"
    
    def check_resource_availability(self, factory_data: Dict) -> List[CheckResult]:
        """リソースの可用性をチェック"""
        results = []
        
        # 設備の可用性チェック
        processes = factory_data.get('processes', {})
        for process_id, process in processes.items():
            equipment_count = process.get('equipmentCount', 0)
            if equipment_count == 0:
                results.append(CheckResult(
                    check_name="no_equipment",
                    severity=CheckSeverity.ERROR,
                    message=f"工程 '{process.get('label', process_id)}' に設備が設定されていません",
                    details={"process_id": process_id, "equipment_count": equipment_count},
                    fix_suggestions=[
                        "工程に設備を設定する",
                        "工程の基本設定を確認する"
                    ]
                ))
        
        return results
    
    def check_material_sufficiency(self, factory_data: Dict) -> List[CheckResult]:
        """材料の充足性をチェック"""
        results = []
        
        # 材料の存在チェック
        products = factory_data.get('products', {})
        if not products:
            results.append(CheckResult(
                check_name="no_products",
                severity=CheckSeverity.WARNING,
                message="製品が設定されていません",
                details={"products_count": len(products)},
                fix_suggestions=[
                    "製品マスターに製品を追加する",
                    "サンプル製品を読み込む"
                ]
            ))
        
        return results
    
    def check_capacity_constraints(self, factory_data: Dict) -> List[CheckResult]:
        """容量制約をチェック"""
        results = []
        
        # バッファ容量のチェック
        processes = factory_data.get('processes', {})
        for process_id, process in processes.items():
            input_buffer_capacity = process.get('inputBufferCapacity', 0)
            output_buffer_capacity = process.get('outputBufferCapacity', 0)
            
            if input_buffer_capacity <= 0:
                results.append(CheckResult(
                    check_name="invalid_input_buffer",
                    severity=CheckSeverity.WARNING,
                    message=f"工程 '{process.get('label', process_id)}' の入力バッファ容量が無効です",
                    details={"process_id": process_id, "input_buffer_capacity": input_buffer_capacity},
                    fix_suggestions=[
                        "入力バッファ容量を正の値に設定する",
                        "工程の基本設定を確認する"
                    ]
                ))
            
            if output_buffer_capacity <= 0:
                results.append(CheckResult(
                    check_name="invalid_output_buffer",
                    severity=CheckSeverity.WARNING,
                    message=f"工程 '{process.get('label', process_id)}' の出力バッファ容量が無効です",
                    details={"process_id": process_id, "output_buffer_capacity": output_buffer_capacity},
                    fix_suggestions=[
                        "出力バッファ容量を正の値に設定する",
                        "工程の基本設定を確認する"
                    ]
                ))
        
        return results

class PerformancePredictor:
    """パフォーマンス予測器"""
    
    def __init__(self):
        self.name = "PerformancePredictor"
    
    def predict_throughput(self, factory_data: Dict) -> Dict[str, Any]:
        """スループットを予測"""
        # 簡易的なスループット計算
        processes = factory_data.get('processes', {})
        total_cycle_time = 0
        total_equipment = 0
        
        for process in processes.values():
            cycle_time = process.get('cycleTime', 60)
            equipment_count = process.get('equipmentCount', 1)
            total_cycle_time += cycle_time
            total_equipment += equipment_count
        
        if total_cycle_time > 0:
            avg_cycle_time = total_cycle_time / len(processes)
            estimated_throughput = (total_equipment * 3600) / avg_cycle_time  # 1時間あたり
        else:
            estimated_throughput = 0
        
        return {
            "estimated_throughput_per_hour": estimated_throughput,
            "average_cycle_time": avg_cycle_time if total_cycle_time > 0 else 0,
            "total_equipment": total_equipment
        }
    
    def predict_bottlenecks(self, factory_data: Dict) -> List[Dict[str, Any]]:
        """ボトルネックを予測"""
        bottlenecks = []
        processes = factory_data.get('processes', {})
        
        for process_id, process in processes.items():
            cycle_time = process.get('cycleTime', 60)
            equipment_count = process.get('equipmentCount', 1)
            
            # 簡易的なボトルネック判定
            if cycle_time > 120 and equipment_count <= 1:  # 2分以上で設備1台
                bottlenecks.append({
                    "process_id": process_id,
                    "process_label": process.get('label', process_id),
                    "cycle_time": cycle_time,
                    "equipment_count": equipment_count,
                    "bottleneck_type": "high_cycle_time_low_equipment"
                })
        
        return bottlenecks
    
    def predict_resource_utilization(self, factory_data: Dict) -> Dict[str, float]:
        """リソース稼働率を予測"""
        processes = factory_data.get('processes', {})
        total_utilization = 0
        process_count = len(processes)
        
        for process in processes.values():
            # 簡易的な稼働率計算
            cycle_time = process.get('cycleTime', 60)
            setup_time = process.get('setupTime', 0)
            
            if cycle_time > 0:
                utilization = (cycle_time / (cycle_time + setup_time)) * 100
                total_utilization += utilization
        
        avg_utilization = total_utilization / process_count if process_count > 0 else 0
        
        return {
            "average_utilization": avg_utilization,
            "total_processes": process_count
        }

class FactChecker:
    """メインファクトチェッカー"""
    
    def __init__(self):
        self.checkers = {
            'network': NetworkIntegrityChecker(),
            'bom': BOMIntegrityChecker(),
            'config': ConfigurationValidator(),
            'feasibility': SimulationFeasibilityChecker(),
            'performance': PerformancePredictor()
        }
        
        self.results: List[CheckResult] = []
        self.start_time: Optional[datetime] = None
    
    def run_all_checks(self, project_data: Dict) -> CheckSummary:
        """全てのチェックを実行"""
        self.start_time = datetime.now()
        self.results = []
        
        logger.info("ファクトチェックを開始します...")
        
        # 各チェッカーを実行
        for checker_name, checker in self.checkers.items():
            logger.info(f"{checker.name} を実行中...")
            
            try:
                if checker_name == 'network':
                    results = checker.check_connectivity(project_data)
                    results.extend(checker.check_cycles(project_data))
                    results.extend(checker.check_material_flow(project_data))
                elif checker_name == 'bom':
                    results = checker.check_bom_structure(project_data)
                    results.extend(checker.check_quantity_consistency(project_data))
                    results.extend(checker.check_circular_dependency(project_data))
                elif checker_name == 'config':
                    # 各工程の設定をチェック
                    processes = project_data.get('processes', {})
                    for process_id, process in processes.items():
                        results = checker.validate_process_parameters(process)
                        self.results.extend(results)
                    continue
                elif checker_name == 'feasibility':
                    results = checker.check_resource_availability(project_data)
                    results.extend(checker.check_material_sufficiency(project_data))
                    results.extend(checker.check_capacity_constraints(project_data))
                elif checker_name == 'performance':
                    # パフォーマンス予測は結果を記録
                    throughput = checker.predict_throughput(project_data)
                    bottlenecks = checker.predict_bottlenecks(project_data)
                    utilization = checker.predict_resource_utilization(project_data)
                    
                    # 予測結果を結果に追加
                    self.results.append(CheckResult(
                        check_name="performance_prediction",
                        severity=CheckSeverity.INFO,
                        message="パフォーマンス予測が完了しました",
                        details={
                            "throughput": throughput,
                            "bottlenecks": bottlenecks,
                            "utilization": utilization
                        }
                    ))
                    continue
                else:
                    continue
                
                self.results.extend(results)
                
            except Exception as e:
                logger.error(f"{checker.name} の実行中にエラーが発生しました: {e}")
                self.results.append(CheckResult(
                    check_name=f"{checker.name}_error",
                    severity=CheckSeverity.ERROR,
                    message=f"{checker.name} の実行中にエラーが発生しました",
                    details={"error": str(e)}
                ))
        
        execution_time = (datetime.now() - self.start_time).total_seconds()
        
        # サマリーを作成
        summary = CheckSummary(
            total_checks=len(self.results),
            passed=len([r for r in self.results if r.severity == CheckSeverity.INFO]),
            warnings=len([r for r in self.results if r.severity == CheckSeverity.WARNING]),
            errors=len([r for r in self.results if r.severity == CheckSeverity.ERROR]),
            critical=len([r for r in self.results if r.severity == CheckSeverity.CRITICAL]),
            execution_time=execution_time,
            timestamp=datetime.now()
        )
        
        logger.info(f"ファクトチェックが完了しました。実行時間: {execution_time:.2f}秒")
        logger.info(f"結果: 成功={summary.passed}, 警告={summary.warnings}, エラー={summary.errors}, 重大={summary.critical}")
        
        return summary
    
    def generate_report(self, report_type: str = "summary") -> str:
        """レポートを生成"""
        if not self.results:
            return "チェック結果がありません。"
        
        if report_type == "summary":
            return self._generate_summary_report()
        elif report_type == "detailed":
            return self._generate_detailed_report()
        else:
            return "不明なレポートタイプです。"
    
    def _generate_summary_report(self) -> str:
        """サマリーレポートを生成"""
        report = []
        report.append("=" * 60)
        report.append("ProSimNez ファクトチェック サマリーレポート")
        report.append("=" * 60)
        report.append(f"生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # 結果サマリー
        severity_counts = {}
        for result in self.results:
            severity = result.severity.value
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        report.append("【チェック結果サマリー】")
        for severity, count in severity_counts.items():
            report.append(f"  {severity.upper()}: {count}")
        report.append("")
        
        # 重要な問題
        critical_errors = [r for r in self.results if r.severity in [CheckSeverity.ERROR, CheckSeverity.CRITICAL]]
        if critical_errors:
            report.append("【重要な問題】")
            for result in critical_errors[:5]:  # 最初の5件
                report.append(f"  ❌ {result.message}")
            if len(critical_errors) > 5:
                report.append(f"  ... 他 {len(critical_errors) - 5} 件")
            report.append("")
        
        return "\n".join(report)
    
    def _generate_detailed_report(self) -> str:
        """詳細レポートを生成"""
        report = []
        report.append("=" * 60)
        report.append("ProSimNez ファクトチェック 詳細レポート")
        report.append("=" * 60)
        report.append(f"生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # 重要度別に結果をグループ化
        severity_order = [CheckSeverity.CRITICAL, CheckSeverity.ERROR, CheckSeverity.WARNING, CheckSeverity.INFO]
        
        for severity in severity_order:
            severity_results = [r for r in self.results if r.severity == severity]
            if not severity_results:
                continue
            
            report.append(f"【{severity.value.upper()}】")
            report.append("-" * 40)
            
            for result in severity_results:
                report.append(f"• {result.check_name}")
                report.append(f"  {result.message}")
                if result.fix_suggestions:
                    report.append("  修正提案:")
                    for suggestion in result.fix_suggestions:
                        report.append(f"    - {suggestion}")
                if result.details:
                    report.append(f"  詳細: {json.dumps(result.details, indent=2, ensure_ascii=False)}")
                report.append("")
        
        return "\n".join(report)

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="ProSimNez ファクトチェックツール")
    parser.add_argument("--check-network", action="store_true", help="ネットワーク整合性チェック")
    parser.add_argument("--check-bom", action="store_true", help="BOM整合性チェック")
    parser.add_argument("--check-config", action="store_true", help="設定値妥当性チェック")
    parser.add_argument("--check-feasibility", action="store_true", help="実行可能性チェック")
    parser.add_argument("--check-all", action="store_true", help="全てのチェックを実行")
    parser.add_argument("--project-id", type=str, help="プロジェクトID")
    parser.add_argument("--project-file", type=str, help="プロジェクトファイルパス")
    parser.add_argument("--generate-report", action="store_true", help="レポートを生成")
    parser.add_argument("--report-type", choices=["summary", "detailed"], default="summary", help="レポートタイプ")
    parser.add_argument("--output-file", type=str, help="出力ファイルパス")
    
    args = parser.parse_args()
    
    # プロジェクトデータの読み込み
    project_data = {}
    
    if args.project_file:
        try:
            with open(args.project_file, 'r', encoding='utf-8') as f:
                if args.project_file.endswith('.json'):
                    project_data = json.load(f)
                elif args.project_file.endswith('.yaml') or args.project_file.endswith('.yml'):
                    project_data = yaml.safe_load(f)
                else:
                    logger.error("サポートされていないファイル形式です。JSONまたはYAMLファイルを使用してください。")
                    sys.exit(1)
        except Exception as e:
            logger.error(f"プロジェクトファイルの読み込みに失敗しました: {e}")
            sys.exit(1)
    else:
        # サンプルデータを使用
        project_data = {
            "nodes": [],
            "edges": [],
            "products": [],
            "bom_items": [],
            "process_advanced_data": {}
        }
        logger.warning("プロジェクトファイルが指定されていないため、サンプルデータを使用します。")
    
    # ファクトチェッカーを実行
    checker = FactChecker()
    
    if args.check_all or any([args.check_network, args.check_bom, args.check_config, args.check_feasibility]):
        summary = checker.run_all_checks(project_data)
        
        # レポート生成
        if args.generate_report:
            report = checker.generate_report(args.report_type)
            
            if args.output_file:
                try:
                    with open(args.output_file, 'w', encoding='utf-8') as f:
                        f.write(report)
                    logger.info(f"レポートが {args.output_file} に保存されました。")
                except Exception as e:
                    logger.error(f"レポートの保存に失敗しました: {e}")
            else:
                print(report)
        
        # 結果の表示
        print(f"\nチェック完了: 成功={summary.passed}, 警告={summary.warnings}, エラー={summary.errors}, 重大={summary.critical}")
        
        # エラーがある場合は終了コード1で終了
        if summary.errors > 0 or summary.critical > 0:
            sys.exit(1)
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 