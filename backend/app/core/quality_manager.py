"""
品質管理シミュレーションシステム
不良率確率判定、品質検査、再加工プロセス、統計的品質管理(SQC)
"""
import asyncio
import random
import math
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import uuid
# import numpy as np  # 必要に応じてインストール
# from scipy import stats  # 必要に応じてインストール

from app.models.product import Product, Lot
from app.models.event import SimulationEvent
from app.core.event_manager import EventManager, EventPriority

class QualityResult(Enum):
    """品質判定結果"""
    GOOD = "good"           # 良品
    MINOR_DEFECT = "minor"  # 軽微な不良
    MAJOR_DEFECT = "major"  # 重大な不良
    CRITICAL_DEFECT = "critical"  # 致命的不良
    REWORK_REQUIRED = "rework"    # 再加工要
    SCRAP = "scrap"         # 廃棄

class InspectionType(Enum):
    """検査タイプ"""
    INCOMING = "incoming"     # 受入検査
    IN_PROCESS = "in_process" # 工程内検査
    FINAL = "final"          # 最終検査
    SAMPLING = "sampling"     # サンプリング検査
    FULL = "full"            # 全数検査

class QualityControlMethod(Enum):
    """品質管理手法"""
    STATISTICAL = "statistical"  # 統計的品質管理
    ATTRIBUTE = "attribute"      # 計数値管理
    VARIABLE = "variable"        # 計量値管理
    CAPABILITY = "capability"    # 工程能力管理

@dataclass
class QualitySpec:
    """品質仕様"""
    spec_id: str
    product_id: str
    parameter_name: str
    target_value: float
    upper_spec_limit: float  # USL
    lower_spec_limit: float  # LSL
    unit: str = ""
    critical_level: str = "minor"  # "minor", "major", "critical"

@dataclass
class QualityMeasurement:
    """品質測定値"""
    measurement_id: str
    lot_id: str
    product_id: str
    parameter_name: str
    measured_value: float
    measurement_time: datetime
    inspector_id: str
    equipment_id: str
    within_spec: bool = True
    deviation: float = 0.0

@dataclass
class QualityInspection:
    """品質検査"""
    inspection_id: str
    lot_id: str
    product_id: str
    inspection_type: InspectionType
    process_id: str
    inspection_time: datetime
    inspector_id: str
    measurements: List[QualityMeasurement] = field(default_factory=list)
    overall_result: QualityResult = QualityResult.GOOD
    defect_details: List[Dict[str, Any]] = field(default_factory=list)
    rework_instructions: List[str] = field(default_factory=list)

@dataclass
class DefectRecord:
    """不良記録"""
    defect_id: str
    lot_id: str
    product_id: str
    process_id: str
    defect_type: str
    defect_category: str  # "dimensional", "surface", "functional", "material"
    severity: str  # "minor", "major", "critical"
    detected_at: datetime
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    cost_impact: float = 0.0

@dataclass
class ControlChart:
    """管理図"""
    chart_id: str
    product_id: str
    parameter_name: str
    chart_type: str  # "X-bar", "R", "p", "c", "X-mR"
    sample_size: int
    center_line: float
    upper_control_limit: float
    lower_control_limit: float
    data_points: List[Tuple[datetime, float]] = field(default_factory=list)
    out_of_control_points: List[int] = field(default_factory=list)

class QualityManager:
    """品質管理システム"""
    
    def __init__(self, event_manager: EventManager):
        self.event_manager = event_manager
        
        # 品質仕様管理
        self.quality_specs: Dict[str, QualitySpec] = {}
        self.process_quality_params: Dict[str, Dict[str, float]] = {}  # process_id -> params
        
        # 検査管理
        self.inspections: Dict[str, QualityInspection] = {}
        self.inspection_queue: deque = deque()
        
        # 不良管理
        self.defect_records: Dict[str, DefectRecord] = {}
        self.defect_rates: Dict[str, float] = {}  # process_id -> rate
        
        # 統計的品質管理
        self.control_charts: Dict[str, ControlChart] = {}
        self.process_capability: Dict[str, Dict[str, float]] = {}  # Cp, Cpk等
        
        # 再加工管理
        self.rework_queue: deque = deque()
        self.rework_costs: Dict[str, float] = {}
        
        # 統計情報
        self.stats = {
            "total_inspections": 0,
            "good_count": 0,
            "defect_count": 0,
            "rework_count": 0,
            "scrap_count": 0,
            "total_quality_cost": 0.0,
            "first_pass_yield": 100.0,
            "dpmo": 0.0  # Defects Per Million Opportunities
        }
        
        # 初期化
        self._initialize_quality_specs()
        self._initialize_process_quality_params()
        self._initialize_control_charts()
        
    def _initialize_quality_specs(self):
        """品質仕様を初期化"""
        # デフォルトの品質仕様
        default_specs = [
            ("dimension_1", "product_1", "length", 100.0, 102.0, 98.0, "mm", "major"),
            ("dimension_2", "product_1", "width", 50.0, 51.0, 49.0, "mm", "major"),
            ("weight_1", "product_1", "weight", 500.0, 520.0, 480.0, "g", "minor"),
            ("surface_1", "product_1", "roughness", 1.6, 2.0, 0.0, "μm", "critical"),
        ]
        
        for spec_data in default_specs:
            spec_id, product_id, param_name, target, usl, lsl, unit, level = spec_data
            
            self.quality_specs[spec_id] = QualitySpec(
                spec_id=spec_id,
                product_id=product_id,
                parameter_name=param_name,
                target_value=target,
                upper_spec_limit=usl,
                lower_spec_limit=lsl,
                unit=unit,
                critical_level=level
            )
            
    def _initialize_process_quality_params(self):
        """工程品質パラメータを初期化"""
        # デフォルトの工程品質パラメータ
        default_params = {
            "process_1": {
                "base_defect_rate": 0.02,  # 2%基本不良率
                "capability_sigma": 4.0,   # 工程能力(σ)
                "drift_rate": 0.001,       # ドリフト率
                "temperature_sensitivity": 0.1,
                "tool_wear_factor": 0.05
            },
            "process_2": {
                "base_defect_rate": 0.015,
                "capability_sigma": 4.5,
                "drift_rate": 0.0008,
                "temperature_sensitivity": 0.05,
                "tool_wear_factor": 0.03
            }
        }
        
        self.process_quality_params = default_params
        
        # 初期不良率を設定
        for process_id, params in default_params.items():
            self.defect_rates[process_id] = params["base_defect_rate"]
            
    def _initialize_control_charts(self):
        """管理図を初期化"""
        # X-bar管理図の例
        for product_id in ["product_1"]:
            for param_name in ["length", "width", "weight"]:
                chart_id = f"xbar_{product_id}_{param_name}"
                
                spec = self._get_spec_by_product_param(product_id, param_name)
                if spec:
                    # 3σ管理限界
                    sigma_estimate = (spec.upper_spec_limit - spec.lower_spec_limit) / 6
                    
                    self.control_charts[chart_id] = ControlChart(
                        chart_id=chart_id,
                        product_id=product_id,
                        parameter_name=param_name,
                        chart_type="X-bar",
                        sample_size=5,
                        center_line=spec.target_value,
                        upper_control_limit=spec.target_value + 3 * sigma_estimate,
                        lower_control_limit=spec.target_value - 3 * sigma_estimate
                    )
                    
    async def perform_quality_inspection(self, lot_id: str, product_id: str,
                                       process_id: str, inspection_type: InspectionType,
                                       inspector_id: str = "auto") -> str:
        """品質検査を実行"""
        inspection_id = str(uuid.uuid4())
        
        inspection = QualityInspection(
            inspection_id=inspection_id,
            lot_id=lot_id,
            product_id=product_id,
            inspection_type=inspection_type,
            process_id=process_id,
            inspection_time=datetime.now(),
            inspector_id=inspector_id
        )
        
        # 測定値を生成
        measurements = await self._generate_measurements(
            lot_id, product_id, process_id, inspection_id
        )
        
        inspection.measurements = measurements
        
        # 総合判定
        inspection.overall_result = await self._evaluate_overall_quality(
            measurements, product_id
        )
        
        # 不良詳細と再加工指示
        if inspection.overall_result != QualityResult.GOOD:
            inspection.defect_details = await self._analyze_defects(measurements, product_id)
            inspection.rework_instructions = await self._generate_rework_instructions(
                inspection.defect_details
            )
            
        self.inspections[inspection_id] = inspection
        self.stats["total_inspections"] += 1
        
        # 統計更新
        await self._update_quality_statistics(inspection)
        
        # 管理図更新
        await self._update_control_charts(measurements)
        
        # イベント発行
        await self._emit_event("quality_inspection_completed", {
            "inspection": inspection.__dict__,
            "result": inspection.overall_result.value
        })
        
        # 不良の場合は不良記録を作成
        if inspection.overall_result not in [QualityResult.GOOD]:
            await self._create_defect_record(inspection)
            
        return inspection_id
        
    async def _generate_measurements(self, lot_id: str, product_id: str,
                                   process_id: str, inspection_id: str) -> List[QualityMeasurement]:
        """測定値を生成"""
        measurements = []
        
        # 製品の品質仕様を取得
        product_specs = [
            spec for spec in self.quality_specs.values()
            if spec.product_id == product_id
        ]
        
        for spec in product_specs:
            # 工程能力を考慮した測定値生成
            measured_value = await self._generate_realistic_measurement(
                spec, process_id
            )
            
            measurement = QualityMeasurement(
                measurement_id=str(uuid.uuid4()),
                lot_id=lot_id,
                product_id=product_id,
                parameter_name=spec.parameter_name,
                measured_value=measured_value,
                measurement_time=datetime.now(),
                inspector_id="auto",
                equipment_id=f"gauge_{spec.parameter_name}"
            )
            
            # 仕様内かチェック
            measurement.within_spec = (
                spec.lower_spec_limit <= measured_value <= spec.upper_spec_limit
            )
            
            # 偏差計算
            measurement.deviation = abs(measured_value - spec.target_value)
            
            measurements.append(measurement)
            
        return measurements
        
    async def _generate_realistic_measurement(self, spec: QualitySpec, 
                                            process_id: str) -> float:
        """現実的な測定値を生成"""
        process_params = self.process_quality_params.get(process_id, {})
        capability_sigma = process_params.get("capability_sigma", 3.0)
        
        # 工程の標準偏差を計算
        # 仕様幅の1/6をσとして、工程能力を考慮
        spec_range = spec.upper_spec_limit - spec.lower_spec_limit
        process_sigma = spec_range / (6 * capability_sigma)
        
        # 正規分布から測定値を生成
        measured_value = random.normalvariate(spec.target_value, process_sigma)
        
        # 工程のドリフトや変動要因を考慮
        drift_rate = process_params.get("drift_rate", 0.001)
        drift_factor = random.uniform(-drift_rate, drift_rate)
        measured_value += spec.target_value * drift_factor
        
        return measured_value
        
    async def _evaluate_overall_quality(self, measurements: List[QualityMeasurement],
                                       product_id: str) -> QualityResult:
        """総合品質判定"""
        if not measurements:
            return QualityResult.GOOD
            
        # 仕様外の測定値をチェック
        out_of_spec_count = sum(1 for m in measurements if not m.within_spec)
        
        if out_of_spec_count == 0:
            return QualityResult.GOOD
            
        # 不良の重要度を評価
        critical_violations = []
        major_violations = []
        minor_violations = []
        
        for measurement in measurements:
            if not measurement.within_spec:
                spec = self._get_spec_by_product_param(
                    product_id, measurement.parameter_name
                )
                
                if spec:
                    if spec.critical_level == "critical":
                        critical_violations.append(measurement)
                    elif spec.critical_level == "major":
                        major_violations.append(measurement)
                    else:
                        minor_violations.append(measurement)
                        
        # 判定ロジック
        if critical_violations:
            # 致命的不良の場合は廃棄
            return QualityResult.SCRAP
        elif major_violations:
            # 重大不良の場合は再加工可能性を判定
            if await self._is_reworkable(major_violations):
                return QualityResult.REWORK_REQUIRED
            else:
                return QualityResult.MAJOR_DEFECT
        elif minor_violations:
            # 軽微な不良
            return QualityResult.MINOR_DEFECT
        else:
            return QualityResult.GOOD
            
    async def _is_reworkable(self, violations: List[QualityMeasurement]) -> bool:
        """再加工可能性を判定"""
        # 簡略化: 偏差が仕様の20%以内なら再加工可能
        for measurement in violations:
            spec = self._get_spec_by_product_param(
                measurement.product_id, measurement.parameter_name
            )
            
            if spec:
                max_deviation = (spec.upper_spec_limit - spec.lower_spec_limit) * 0.2
                if measurement.deviation > max_deviation:
                    return False
                    
        return True
        
    async def _analyze_defects(self, measurements: List[QualityMeasurement],
                             product_id: str) -> List[Dict[str, Any]]:
        """不良詳細を分析"""
        defects = []
        
        for measurement in measurements:
            if not measurement.within_spec:
                spec = self._get_spec_by_product_param(
                    product_id, measurement.parameter_name
                )
                
                if spec:
                    # 不良の種類を判定
                    if measurement.measured_value > spec.upper_spec_limit:
                        defect_type = "oversized"
                        deviation_pct = (
                            (measurement.measured_value - spec.upper_spec_limit) /
                            (spec.upper_spec_limit - spec.lower_spec_limit) * 100
                        )
                    else:
                        defect_type = "undersized"
                        deviation_pct = (
                            (spec.lower_spec_limit - measurement.measured_value) /
                            (spec.upper_spec_limit - spec.lower_spec_limit) * 100
                        )
                        
                    defects.append({
                        "parameter": measurement.parameter_name,
                        "defect_type": defect_type,
                        "measured_value": measurement.measured_value,
                        "spec_limit": (spec.upper_spec_limit 
                                     if defect_type == "oversized" 
                                     else spec.lower_spec_limit),
                        "deviation_percent": round(deviation_pct, 2),
                        "severity": spec.critical_level
                    })
                    
        return defects
        
    async def _generate_rework_instructions(self, defects: List[Dict[str, Any]]) -> List[str]:
        """再加工指示を生成"""
        instructions = []
        
        for defect in defects:
            param = defect["parameter"]
            defect_type = defect["defect_type"]
            
            if param == "length":
                if defect_type == "oversized":
                    instructions.append("切削加工により長さを調整")
                else:
                    instructions.append("材料不足のため廃棄")
            elif param == "width":
                if defect_type == "oversized":
                    instructions.append("研削加工により幅を調整")
                else:
                    instructions.append("材料不足のため廃棄")
            elif param == "weight":
                if defect_type == "oversized":
                    instructions.append("余分な材料を除去")
                else:
                    instructions.append("材料追加は困難のため廃棄判定")
            elif param == "roughness":
                instructions.append("表面仕上げ加工を実施")
                
        return instructions
        
    async def _create_defect_record(self, inspection: QualityInspection):
        """不良記録を作成"""
        for defect_detail in inspection.defect_details:
            defect_id = str(uuid.uuid4())
            
            defect_record = DefectRecord(
                defect_id=defect_id,
                lot_id=inspection.lot_id,
                product_id=inspection.product_id,
                process_id=inspection.process_id,
                defect_type=defect_detail["defect_type"],
                defect_category=self._categorize_defect(defect_detail["parameter"]),
                severity=defect_detail["severity"],
                detected_at=inspection.inspection_time
            )
            
            # コスト影響を計算
            defect_record.cost_impact = await self._calculate_defect_cost(
                defect_record, inspection.overall_result
            )
            
            self.defect_records[defect_id] = defect_record
            
            # 統計更新
            self.stats["defect_count"] += 1
            self.stats["total_quality_cost"] += defect_record.cost_impact
            
    def _categorize_defect(self, parameter: str) -> str:
        """不良をカテゴリ分類"""
        categories = {
            "length": "dimensional",
            "width": "dimensional", 
            "weight": "material",
            "roughness": "surface"
        }
        return categories.get(parameter, "other")
        
    async def _calculate_defect_cost(self, defect_record: DefectRecord,
                                   overall_result: QualityResult) -> float:
        """不良コストを計算"""
        base_costs = {
            QualityResult.MINOR_DEFECT: 100,      # 100円
            QualityResult.MAJOR_DEFECT: 500,      # 500円
            QualityResult.CRITICAL_DEFECT: 2000,  # 2000円
            QualityResult.REWORK_REQUIRED: 800,   # 800円
            QualityResult.SCRAP: 1500             # 1500円
        }
        
        base_cost = base_costs.get(overall_result, 0)
        
        # 工程による係数
        process_multiplier = 1.0
        if "process_3" in defect_record.process_id:  # 後工程ほど高コスト
            process_multiplier = 1.5
            
        return base_cost * process_multiplier
        
    async def _update_quality_statistics(self, inspection: QualityInspection):
        """品質統計を更新"""
        # 結果別カウント
        if inspection.overall_result == QualityResult.GOOD:
            self.stats["good_count"] += 1
        elif inspection.overall_result == QualityResult.REWORK_REQUIRED:
            self.stats["rework_count"] += 1
        elif inspection.overall_result == QualityResult.SCRAP:
            self.stats["scrap_count"] += 1
            
        # 一次合格率計算
        total_judgments = (
            self.stats["good_count"] + self.stats["defect_count"] + 
            self.stats["rework_count"] + self.stats["scrap_count"]
        )
        
        if total_judgments > 0:
            self.stats["first_pass_yield"] = (
                self.stats["good_count"] / total_judgments * 100
            )
            
        # DPMO計算 (Defects Per Million Opportunities)
        opportunities_per_unit = len(inspection.measurements)
        total_opportunities = total_judgments * opportunities_per_unit
        
        if total_opportunities > 0:
            self.stats["dpmo"] = (
                self.stats["defect_count"] / total_opportunities * 1000000
            )
            
    async def _update_control_charts(self, measurements: List[QualityMeasurement]):
        """管理図を更新"""
        for measurement in measurements:
            chart_id = f"xbar_{measurement.product_id}_{measurement.parameter_name}"
            chart = self.control_charts.get(chart_id)
            
            if chart:
                # データポイントを追加
                chart.data_points.append((measurement.measurement_time, measurement.measured_value))
                
                # 管理限界外れをチェック
                if (measurement.measured_value > chart.upper_control_limit or
                    measurement.measured_value < chart.lower_control_limit):
                    chart.out_of_control_points.append(len(chart.data_points) - 1)
                    
                    # 管理限界外れのアラート
                    await self._emit_event("control_chart_violation", {
                        "chart_id": chart_id,
                        "measurement_value": measurement.measured_value,
                        "control_limits": {
                            "upper": chart.upper_control_limit,
                            "lower": chart.lower_control_limit
                        }
                    })
                    
                # データポイント数を制限（最新100点）
                if len(chart.data_points) > 100:
                    chart.data_points = chart.data_points[-100:]
                    
    def _get_spec_by_product_param(self, product_id: str, parameter_name: str) -> Optional[QualitySpec]:
        """製品・パラメータから仕様を取得"""
        for spec in self.quality_specs.values():
            if spec.product_id == product_id and spec.parameter_name == parameter_name:
                return spec
        return None
        
    async def calculate_process_capability(self, process_id: str, 
                                         product_id: str) -> Dict[str, float]:
        """工程能力を計算"""
        capabilities = {}
        
        # 最近の測定データを取得
        recent_measurements = self._get_recent_measurements(process_id, product_id, days=7)
        
        # パラメータ別に工程能力を計算
        param_groups = defaultdict(list)
        for measurement in recent_measurements:
            param_groups[measurement.parameter_name].append(measurement.measured_value)
            
        for param_name, values in param_groups.items():
            if len(values) >= 30:  # 十分なデータがある場合
                spec = self._get_spec_by_product_param(product_id, param_name)
                
                if spec:
                    # 統計値計算（numpy使用時は以下のコメントアウトを外す）
                    # mean = np.mean(values)
                    # std = np.std(values, ddof=1)
                    
                    # 標準ライブラリによる統計計算
                    mean = sum(values) / len(values)
                    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
                    std = variance ** 0.5
                    
                    # Cp計算（工程能力指数）
                    cp = (spec.upper_spec_limit - spec.lower_spec_limit) / (6 * std)
                    
                    # Cpk計算（工程能力指数）
                    cpu = (spec.upper_spec_limit - mean) / (3 * std)
                    cpl = (mean - spec.lower_spec_limit) / (3 * std)
                    cpk = min(cpu, cpl)
                    
                    capabilities[param_name] = {
                        "cp": round(cp, 3),
                        "cpk": round(cpk, 3),
                        "mean": round(mean, 3),
                        "std": round(std, 3),
                        "sample_size": len(values)
                    }
                    
        # 工程能力データを保存
        if process_id not in self.process_capability:
            self.process_capability[process_id] = {}
        self.process_capability[process_id][product_id] = capabilities
        
        return capabilities
        
    def _get_recent_measurements(self, process_id: str, product_id: str, 
                               days: int = 7) -> List[QualityMeasurement]:
        """最近の測定データを取得"""
        cutoff_date = datetime.now() - timedelta(days=days)
        recent_measurements = []
        
        for inspection in self.inspections.values():
            if (inspection.process_id == process_id and 
                inspection.product_id == product_id and
                inspection.inspection_time >= cutoff_date):
                recent_measurements.extend(inspection.measurements)
                
        return recent_measurements
        
    async def trigger_rework_process(self, lot_id: str, inspection_id: str) -> str:
        """再加工プロセスを開始"""
        inspection = self.inspections.get(inspection_id)
        if not inspection:
            raise ValueError(f"検査記録が見つかりません: {inspection_id}")
            
        if inspection.overall_result != QualityResult.REWORK_REQUIRED:
            raise ValueError("再加工が必要な検査結果ではありません")
            
        # 再加工タスクを作成
        rework_task_id = str(uuid.uuid4())
        
        rework_cost = await self._calculate_rework_cost(inspection)
        self.rework_costs[rework_task_id] = rework_cost
        
        self.rework_queue.append({
            "task_id": rework_task_id,
            "lot_id": lot_id,
            "inspection_id": inspection_id,
            "instructions": inspection.rework_instructions,
            "estimated_cost": rework_cost,
            "created_at": datetime.now()
        })
        
        # 統計更新
        self.stats["total_quality_cost"] += rework_cost
        
        # イベント発行
        await self._emit_event("rework_process_started", {
            "task_id": rework_task_id,
            "lot_id": lot_id,
            "instructions": inspection.rework_instructions,
            "estimated_cost": rework_cost
        })
        
        return rework_task_id
        
    async def _calculate_rework_cost(self, inspection: QualityInspection) -> float:
        """再加工コストを計算"""
        base_rework_cost = 300  # 基本再加工コスト（円）
        
        # 不良の重要度と数による調整
        severity_multiplier = {
            "minor": 1.0,
            "major": 1.5,
            "critical": 2.0
        }
        
        total_multiplier = 1.0
        for defect in inspection.defect_details:
            severity = defect.get("severity", "minor")
            total_multiplier += severity_multiplier.get(severity, 1.0) * 0.3
            
        return base_rework_cost * total_multiplier
        
    def get_quality_dashboard(self) -> Dict[str, Any]:
        """品質ダッシュボードデータを取得"""
        return {
            "summary": {
                "first_pass_yield": round(self.stats["first_pass_yield"], 2),
                "defect_rate": (
                    self.stats["defect_count"] / self.stats["total_inspections"] * 100
                    if self.stats["total_inspections"] > 0 else 0
                ),
                "rework_rate": (
                    self.stats["rework_count"] / self.stats["total_inspections"] * 100
                    if self.stats["total_inspections"] > 0 else 0
                ),
                "scrap_rate": (
                    self.stats["scrap_count"] / self.stats["total_inspections"] * 100
                    if self.stats["total_inspections"] > 0 else 0
                ),
                "dpmo": round(self.stats["dpmo"], 0),
                "total_quality_cost": round(self.stats["total_quality_cost"], 0)
            },
            "control_charts": {
                chart_id: {
                    "parameter": chart.parameter_name,
                    "out_of_control_count": len(chart.out_of_control_points),
                    "latest_value": (
                        chart.data_points[-1][1] if chart.data_points else None
                    )
                }
                for chart_id, chart in self.control_charts.items()
            },
            "defect_analysis": self._analyze_defect_trends(),
            "process_capability": self.process_capability
        }
        
    def _analyze_defect_trends(self) -> Dict[str, Any]:
        """不良傾向分析"""
        # 不良タイプ別集計
        defect_by_type = defaultdict(int)
        defect_by_category = defaultdict(int)
        defect_by_process = defaultdict(int)
        
        for defect in self.defect_records.values():
            defect_by_type[defect.defect_type] += 1
            defect_by_category[defect.defect_category] += 1
            defect_by_process[defect.process_id] += 1
            
        return {
            "by_type": dict(defect_by_type),
            "by_category": dict(defect_by_category),
            "by_process": dict(defect_by_process),
            "total_defects": len(self.defect_records)
        }
        
    async def _emit_event(self, event_type: str, data: Dict[str, Any] = None):
        """イベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            data=data or {}
        )
        await self.event_manager.emit_event(event)
