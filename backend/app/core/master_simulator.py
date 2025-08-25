"""
マスターシミュレータ
全シミュレーションコンポーネントを統合し、包括的な生産シミュレーションを実行
"""
import asyncio
import simpy
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import uuid
import json
import logging

from app.models.factory import Factory
from app.models.event import SimulationEvent
from app.core.project_data_converter import convert_project_to_simulation_model
from app.core.event_manager import EventManager, EventPriority
from app.core.resource_manager import ResourceManager
from app.core.enhanced_simulator import EnhancedSimulationEngine
from app.core.process_simulator import DetailedProcessSimulator, ProcessingJob
from app.core.material_flow_manager import MaterialFlowManager
from app.core.transport_simulator import TransportSimulator
from app.core.quality_manager import QualityManager, InspectionType
from app.core.scheduler import ProductionScheduler, ProductionOrder, SchedulingStrategy
from app.websocket.realtime_manager import RealtimeDataManager

logger = logging.getLogger(__name__)

@dataclass
class SimulationConfig:
    """シミュレーション設定"""
    simulation_id: str
    project_id: str = "1"  # デフォルトプロジェクトID
    name: str = "生産シミュレーション"
    description: str = ""
    duration_hours: float = 24.0  # シミュレーション時間（時間）
    time_scale: float = 1.0       # 時間スケール（1.0=リアルタイム）
    random_seed: Optional[int] = None
    
    # 各サブシステムの有効化
    enable_detailed_process: bool = True
    enable_material_flow: bool = True
    enable_transport: bool = True
    enable_quality: bool = True
    enable_scheduling: bool = True
    
    # 新しい機能の有効化
    enable_store_schedule_control: bool = True  # ストアスケジュール制御
    enable_process_quality_control: bool = True  # 工程品質制御
    enable_transport_capacity_control: bool = True  # 搬送能力制御
    enable_branch_output: bool = True  # 分岐出力制御
    enable_push_pull_kanban: bool = True  # プッシュ/プル/かんばん制御
    
    # 出力設定
    save_detailed_logs: bool = True
    real_time_monitoring: bool = True
    export_results: bool = True

@dataclass
class SimulationResults:
    """シミュレーション結果"""
    simulation_id: str
    start_time: datetime
    end_time: datetime
    duration_hours: float
    
    # 全体KPI
    overall_kpis: Dict[str, Any] = field(default_factory=dict)
    
    # 各サブシステムの結果
    process_results: Dict[str, Any] = field(default_factory=dict)
    material_results: Dict[str, Any] = field(default_factory=dict)
    transport_results: Dict[str, Any] = field(default_factory=dict)
    quality_results: Dict[str, Any] = field(default_factory=dict)
    schedule_results: Dict[str, Any] = field(default_factory=dict)
    
    # 詳細データ
    event_log: List[SimulationEvent] = field(default_factory=list)
    time_series_data: Dict[str, List[Tuple[datetime, float]]] = field(default_factory=dict)
    
    # 分析結果
    bottleneck_analysis: List[Dict[str, Any]] = field(default_factory=list)
    improvement_recommendations: List[str] = field(default_factory=list)

class MasterSimulator:
    """マスターシミュレータ"""
    
    def __init__(self, factory: Factory):
        self.factory = factory
        
        # SimPy環境
        self.env: Optional[simpy.Environment] = None
        
        # 設定と状態
        self.config: Optional[SimulationConfig] = None
        self.is_running = False
        self.is_paused = False
        self.current_results: Optional[SimulationResults] = None
        
        # 基盤システム
        self.event_manager = EventManager()
        self.resource_manager = ResourceManager()
        self.realtime_manager: Optional[RealtimeDataManager] = None
        
        # コアシミュレーションシステム
        self.process_simulators: Dict[str, DetailedProcessSimulator] = {}
        self.material_flow_manager: Optional[MaterialFlowManager] = None
        self.transport_simulator: Optional[TransportSimulator] = None
        self.quality_manager: Optional[QualityManager] = None
        self.scheduler: Optional[ProductionScheduler] = None
        
        # 統計とKPI
        self.kpi_collectors: Dict[str, Any] = {}
        self.performance_metrics: Dict[str, List[float]] = defaultdict(list)
        
        # 初期化
        self._initialize_base_systems()
        
    def _initialize_base_systems(self):
        """基盤システムを初期化"""
        # リソースマネージャーにファクトリーリソースを登録
        self._register_factory_resources()
        
        # イベントハンドラーを設定
        self._setup_event_handlers()
        
    def _register_factory_resources(self):
        """ファクトリーのリソースをリソースマネージャーに登録"""
        # 工程の設備を登録
        for process_id, process in self.factory.processes.items():
            for equipment_id, equipment in process.equipments.items():
                self.resource_manager.add_equipment(
                    equipment_id=equipment_id,
                    process_id=process_id,
                    capacity=equipment.capacity,
                    name=equipment.name
                )
                
        # デフォルトの作業者を追加
        for i in range(10):  # 10人の作業者
            worker_id = f"worker_{i+1}"
            self.resource_manager.add_worker(
                worker_id=worker_id,
                name=f"作業者{i+1}",
                skills=["machining", "assembly", "inspection"],
                shift_start_time="08:00",
                shift_end_time="17:00"
            )
            
    def _setup_event_handlers(self):
        """イベントハンドラーを設定"""
        # KPI計算用のイベントハンドラー
        self.event_manager.add_handler("processing_completed", self._handle_processing_completed)
        self.event_manager.add_handler("quality_inspection_completed", self._handle_quality_inspection)
        self.event_manager.add_handler("transport_task_completed", self._handle_transport_completed)
        self.event_manager.add_handler("material_delivered", self._handle_material_delivered)
        
    async def configure_simulation(self, config: SimulationConfig):
        """シミュレーションを設定"""
        self.config = config
        
        # プロジェクトデータからファクトリーを生成
        logger.info(f"プロジェクトID {config.project_id} からファクトリーを生成中...")
        self.factory = await convert_project_to_simulation_model(config.project_id)
        
        # ファクトリーリソースを再登録
        self._register_factory_resources()
        
        # SimPy環境を作成
        self.env = simpy.Environment()
        
        # ランダムシードを設定
        if config.random_seed:
            import random
            random.seed(config.random_seed)
            
        # サブシステムを初期化
        await self._initialize_subsystems()
        
        # KPIコレクターを初期化
        self._initialize_kpi_collectors()
        
        logger.info(f"マスターシミュレータ設定完了: {config.simulation_id} (プロジェクト: {config.project_id})")
        
    async def _initialize_subsystems(self):
        """サブシステムを初期化"""
        if not self.config:
            raise ValueError("シミュレーション設定が必要です")
            
        # 材料フロー管理システム
        if self.config.enable_material_flow:
            self.material_flow_manager = MaterialFlowManager(
                self.factory, self.event_manager
            )
            
        # 搬送シミュレータ
        if self.config.enable_transport:
            self.transport_simulator = TransportSimulator(
                self.resource_manager, self.event_manager, self.env
            )
            
        # 品質管理システム
        if self.config.enable_quality:
            self.quality_manager = QualityManager(self.event_manager)
            
        # スケジューラ
        if self.config.enable_scheduling:
            self.scheduler = ProductionScheduler(self.factory, self.event_manager)
            
        # 詳細工程シミュレータ
        if self.config.enable_detailed_process:
            for process_id, process in self.factory.processes.items():
                self.process_simulators[process_id] = DetailedProcessSimulator(
                    process, self.resource_manager, self.event_manager, self.env
                )
                
        # リアルタイムデータマネージャー
        if self.config.real_time_monitoring:
            self.realtime_manager = RealtimeDataManager()
            await self.realtime_manager.initialize()
            
    def _initialize_kpi_collectors(self):
        """KPIコレクターを初期化"""
        self.kpi_collectors = {
            "throughput": ThroughputCollector(),
            "utilization": UtilizationCollector(),
            "quality": QualityKPICollector(),
            "inventory": InventoryKPICollector(),
            "delivery": DeliveryPerformanceCollector()
        }
        
    async def start_simulation(self, config: SimulationConfig) -> bool:
        """シミュレーション開始"""
        try:
            logger.info(f"シミュレーション開始: {config.name}")
            
            # 設定を保存
            self.config = config
            
            # SimPy環境を初期化
            self.env = simpy.Environment()
            
            # リアルタイム管理を初期化
            if config.real_time_monitoring:
                self.realtime_manager = RealtimeDataManager()
                await self.realtime_manager.initialize()
            
            # 生産計画の読み込みとバックワード・スケジューリング
            if config.enable_scheduling:
                await self._load_production_plans_and_schedule()
            
            # 各サブシステムを初期化
            await self._initialize_subsystems()
            
            # シミュレーション開始
            self.is_running = True
            self.is_paused = False
            
            # メインループを開始
            await self._run_main_loop()
            
            return True
            
        except Exception as e:
            logger.error(f"シミュレーション開始エラー: {e}")
            return False
    
    async def _load_production_plans_and_schedule(self):
        """生産計画の読み込みとバックワード・スケジューリング"""
        try:
            logger.info("生産計画の読み込みとバックワード・スケジューリングを開始")
            
            # 完成品ストアから生産計画を読み込み
            production_plans = self.factory.get_all_production_plans()
            
            if not production_plans:
                logger.warning("生産計画が見つかりません")
                return
            
            logger.info(f"生産計画数: {len(production_plans)}")
            
            # 各計画の詳細をログ出力
            for plan in production_plans:
                logger.info(f"計画: {plan.id}, 製品: {plan.product_id}, 数量: {plan.quantity}, 納期: {plan.due_date}")
            
            # バックワード・スケジューリングを実行
            scheduler = ProductionScheduler(
                factory=self.factory,
                event_manager=self.event_manager,
                resource_manager=self.resource_manager
            )
            
            # バックワード・スケジューリング戦略を設定
            scheduler.set_scheduling_strategy(SchedulingStrategy.BACKWARD)
            
            # スケジューリング実行
            await scheduler.schedule()
            
            logger.info("バックワード・スケジューリング完了")
            
            # スケジュール結果をログ出力
            scheduled_operations = scheduler.get_scheduled_operations()
            logger.info(f"スケジュール済み作業数: {len(scheduled_operations)}")
            
            # 各工程のスケジュールを確認
            for process_id, operations in scheduler.resource_schedules.items():
                logger.info(f"工程 {process_id}: {len(operations)} 件の作業がスケジュール済み")
                for op in operations:
                    logger.info(f"  - {op.operation_id}: {op.scheduled_start} -> {op.scheduled_end}")
            
        except Exception as e:
            logger.error(f"生産計画読み込み・スケジューリングエラー: {e}")
            raise
    
    def _main_simulation_loop(self):
        """メインシミュレーションループ"""
        while True:
            try:
                # 定期的にシステム状態をチェック
                if self.is_paused:
                    yield self.env.timeout(1.0)
                    continue
                    
                # 生産オーダーの自動生成（デモ用）
                if self.scheduler and self.env.now % 3600 < 1:  # 1時間ごと
                    yield from self._generate_demo_orders()
                    
                # 材料補充チェック
                if self.material_flow_manager:
                    yield from self._check_material_replenishment()
                    
                # 予防保全チェック
                yield from self._check_preventive_maintenance()
                
                # リアルタイムデータ送信
                if self.realtime_manager:
                    yield from self._send_realtime_data()
                    
                # 次のチェックまで待機
                yield self.env.timeout(60.0)  # 1分間隔
                
            except Exception as e:
                print(f"メインループエラー: {e}")
                yield self.env.timeout(10.0)
                
    def _generate_demo_orders(self):
        """デモ用の生産オーダーを生成"""
        if not self.scheduler:
            return
            
        # ランダムに生産オーダーを生成
        import random
        
        products = list(self.factory.products.keys())
        if products:
            product_id = random.choice(products)
            quantity = random.randint(10, 50)
            due_date = datetime.now() + timedelta(hours=random.randint(8, 72))
            
            # 非同期で生産オーダーを作成
            asyncio.create_task(
                self.scheduler.create_production_order(
                    product_id=product_id,
                    quantity=quantity,
                    due_date=due_date,
                    priority=random.randint(1, 5)
                )
            )
            
        yield self.env.timeout(0)
        
    def _check_material_replenishment(self):
        """材料補充をチェック"""
        # 在庫レベルが低い場合は自動発注
        if self.material_flow_manager:
            inventory_status = self.material_flow_manager.get_inventory_status()
            
            for alert in inventory_status.get("alerts", []):
                if alert["type"] == "low_stock":
                    # 自動発注
                    product_id = alert["product_id"]
                    quantity = alert.get("reorder_quantity", 50)
                    
                    asyncio.create_task(
                        self.material_flow_manager.request_material(
                            process_id="warehouse",
                            product_id=product_id,
                            quantity=quantity,
                            required_by=datetime.now() + timedelta(hours=24)
                        )
                    )
                    
        yield self.env.timeout(0)
        
    def _check_preventive_maintenance(self):
        """予防保全をチェック"""
        # 設備の稼働時間をチェックして予防保全を実施
        for process_simulator in self.process_simulators.values():
            stats = process_simulator.get_kpis()
            
            # 稼働時間が長い場合は保全を実施
            if stats.get("utilization", 0) > 85:
                # 予防保全のスケジューリング（簡略化）
                pass
                
        yield self.env.timeout(0)
        
    def _send_realtime_data(self):
        """リアルタイムデータを送信"""
        if not self.realtime_manager:
            return
            
        # 現在のKPIデータを収集
        current_kpis = self._collect_current_kpis()
        
        # リアルタイム送信
        asyncio.create_task(
            self.realtime_manager.broadcast_kpis(current_kpis)
        )
        
        yield self.env.timeout(0)
        
    def _kpi_monitoring_loop(self):
        """KPI監視ループ"""
        while True:
            try:
                # KPIを計算して記録
                current_kpis = self._collect_current_kpis()
                
                for kpi_name, value in current_kpis.items():
                    if isinstance(value, (int, float)):
                        self.performance_metrics[kpi_name].append(value)
                        
                # 時系列データに記録
                current_time = datetime.now()
                for kpi_name, value in current_kpis.items():
                    if isinstance(value, (int, float)):
                        if kpi_name not in self.current_results.time_series_data:
                            self.current_results.time_series_data[kpi_name] = []
                        self.current_results.time_series_data[kpi_name].append((current_time, value))
                        
                yield self.env.timeout(300.0)  # 5分間隔
                
            except Exception as e:
                print(f"KPI監視エラー: {e}")
                yield self.env.timeout(60.0)
                
    def _collect_current_kpis(self) -> Dict[str, Any]:
        """現在のKPIを収集"""
        kpis = {
            "simulation_time": self.env.now if self.env else 0,
            "timestamp": datetime.now().isoformat()
        }
        
        # 工程KPI
        total_utilization = 0
        active_processes = 0
        
        for process_id, simulator in self.process_simulators.items():
            process_kpis = simulator.get_kpis()
            kpis[f"process_{process_id}_utilization"] = process_kpis.get("utilization", 0)
            kpis[f"process_{process_id}_throughput"] = process_kpis.get("throughput", 0)
            kpis[f"process_{process_id}_quality_rate"] = process_kpis.get("quality_rate", 100)
            
            total_utilization += process_kpis.get("utilization", 0)
            active_processes += 1
            
        # 全体利用率
        if active_processes > 0:
            kpis["overall_utilization"] = total_utilization / active_processes
            
        # 品質KPI
        if self.quality_manager:
            quality_dashboard = self.quality_manager.get_quality_dashboard()
            kpis["first_pass_yield"] = quality_dashboard["summary"]["first_pass_yield"]
            kpis["defect_rate"] = quality_dashboard["summary"]["defect_rate"]
            kpis["dpmo"] = quality_dashboard["summary"]["dpmo"]
            
        # 在庫KPI
        if self.material_flow_manager:
            inventory_status = self.material_flow_manager.get_inventory_status()
            kpis["stockout_alerts"] = len([
                alert for alert in inventory_status.get("alerts", [])
                if alert["type"] == "low_stock"
            ])
            
        # 搬送KPI
        if self.transport_simulator:
            transport_status = self.transport_simulator.get_transport_status()
            kpis["transport_utilization"] = transport_status["performance"]["resource_utilization"]
            kpis["active_transport_tasks"] = transport_status["tasks"]["active"]
            
        # スケジュールKPI
        if self.scheduler:
            schedule_status = self.scheduler.get_schedule_status()
            kpis["on_time_delivery_rate"] = schedule_status["performance"]["on_time_delivery_rate"]
            kpis["active_operations"] = schedule_status["summary"]["active_operations"]
            
        return kpis
        
    async def _collect_final_results(self):
        """最終結果を収集"""
        if not self.current_results:
            return
            
        # 全体KPIを計算
        self.current_results.overall_kpis = self._calculate_overall_kpis()
        
        # 各サブシステムの結果を収集
        if self.process_simulators:
            self.current_results.process_results = {
                process_id: simulator.get_kpis()
                for process_id, simulator in self.process_simulators.items()
            }
            
        if self.quality_manager:
            self.current_results.quality_results = self.quality_manager.get_quality_dashboard()
            
        if self.transport_simulator:
            self.current_results.transport_results = self.transport_simulator.get_transport_status()
            
        if self.material_flow_manager:
            self.current_results.material_results = {
                "inventory_status": self.material_flow_manager.get_inventory_status(),
                "kanban_status": self.material_flow_manager.get_kanban_status()
            }
            
        if self.scheduler:
            self.current_results.schedule_results = self.scheduler.get_schedule_status()
            
        # ボトルネック分析
        if self.scheduler:
            bottleneck_analyses = await self.scheduler.analyze_bottlenecks()
            self.current_results.bottleneck_analysis = [
                analysis.__dict__ for analysis in bottleneck_analyses
            ]
            
        # 改善提案を生成
        self.current_results.improvement_recommendations = await self._generate_improvement_recommendations()
        
        # イベントログを収集
        self.current_results.event_log = self.event_manager.get_event_history()
        
    def _calculate_overall_kpis(self) -> Dict[str, Any]:
        """全体KPIを計算"""
        kpis = {}
        
        # 平均値を計算
        for metric_name, values in self.performance_metrics.items():
            if values:
                kpis[f"avg_{metric_name}"] = sum(values) / len(values)
                kpis[f"max_{metric_name}"] = max(values)
                kpis[f"min_{metric_name}"] = min(values)
                
        return kpis
        
    async def _generate_improvement_recommendations(self) -> List[str]:
        """改善提案を生成"""
        recommendations = []
        
        # 利用率ベースの提案
        avg_utilization = self.performance_metrics.get("overall_utilization", [])
        if avg_utilization and sum(avg_utilization) / len(avg_utilization) > 90:
            recommendations.append("全体的な設備利用率が高すぎます。能力増強を検討してください。")
            
        # 品質ベースの提案
        avg_defect_rate = self.performance_metrics.get("defect_rate", [])
        if avg_defect_rate and sum(avg_defect_rate) / len(avg_defect_rate) > 5:
            recommendations.append("不良率が高めです。品質管理プロセスの見直しを推奨します。")
            
        # 在庫ベースの提案
        stockout_alerts = self.performance_metrics.get("stockout_alerts", [])
        if stockout_alerts and sum(stockout_alerts) / len(stockout_alerts) > 3:
            recommendations.append("在庫切れが頻発しています。発注点の見直しが必要です。")
            
        return recommendations
        
    async def pause_simulation(self):
        """シミュレーションを一時停止"""
        if self.is_running and not self.is_paused:
            self.is_paused = True
            
            # イベント発行
            await self.event_manager.emit_event(SimulationEvent(
                timestamp=datetime.now(),
                event_type="simulation_paused",
                data={"simulation_id": self.config.simulation_id if self.config else "unknown"}
            ))
            
    async def resume_simulation(self):
        """シミュレーションを再開"""
        if self.is_running and self.is_paused:
            self.is_paused = False
            
            # イベント発行
            await self.event_manager.emit_event(SimulationEvent(
                timestamp=datetime.now(),
                event_type="simulation_resumed", 
                data={"simulation_id": self.config.simulation_id if self.config else "unknown"}
            ))
            
    async def stop_simulation(self):
        """シミュレーションを停止"""
        if self.is_running:
            self.is_running = False
            self.is_paused = False
            
            # 最終結果を収集
            await self._collect_final_results()
            
            # イベント発行
            await self.event_manager.emit_event(SimulationEvent(
                timestamp=datetime.now(),
                event_type="simulation_stopped",
                data={"simulation_id": self.config.simulation_id if self.config else "unknown"}
            ))
            
    def get_simulation_status(self) -> Dict[str, Any]:
        """シミュレーション状況を取得"""
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "config": self.config.__dict__ if self.config else None,
            "current_time": self.env.now if self.env else 0,
            "progress_percent": (
                (self.env.now / (self.config.duration_hours * 3600) * 100)
                if self.env and self.config else 0
            ),
            "current_kpis": self._collect_current_kpis() if self.is_running else {}
        }
        
    def get_simulation_results(self) -> Optional[SimulationResults]:
        """シミュレーション結果を取得"""
        return self.current_results
    
    def get_real_time_data(self) -> Dict[str, Any]:
        """リアルタイムシミュレーションデータを取得"""
        try:
            if not self.env:
                return {"status": "not_initialized"}
            
            # シミュレーション時刻
            simulation_time = f"Day {int(self.env.now // (24 * 3600))}, {int((self.env.now % (24 * 3600)) // 3600):02d}:{int((self.env.now % 3600) // 60):02d}:{int(self.env.now % 60):02d}"
            
            # バッファ状態
            buffer_states = {}
            for buffer_id, buffer in self.factory.buffers.items():
                buffer_states[buffer_id] = {
                    "name": buffer.name,
                    "current_quantity": buffer.current_quantity,
                    "capacity": buffer.capacity,
                    "utilization": (buffer.current_quantity / buffer.capacity * 100) if buffer.capacity > 0 else 0,
                    "buffer_type": buffer.buffer_type
                }
            
            # 設備状態
            equipment_states = {}
            for process_id, process in self.factory.processes.items():
                process_equipment = {}
                for equipment in process.equipments:
                    process_equipment[equipment.id] = {
                        "name": equipment.name,
                        "status": equipment.status,
                        "capacity": equipment.capacity
                    }
                if process_equipment:
                    equipment_states[process_id] = {
                        "name": process.name,
                        "equipments": process_equipment
                    }
            
            # 最近のイベント（イベントマネージャーから取得）
            recent_events = []
            if self.event_manager:
                try:
                    recent_events = self.event_manager.get_recent_events(limit=10)
                except:
                    recent_events = []
            
            return {
                "status": "running" if self.is_running else "stopped",
                "simulation_time": simulation_time,
                "buffer_states": buffer_states,
                "equipment_states": equipment_states,
                "recent_events": [
                    {
                        "timestamp": event.get("timestamp", ""),
                        "type": event.get("event_type", ""),
                        "description": event.get("description", ""),
                        "source": event.get("source", "")
                    }
                    for event in recent_events
                ]
            }
            
        except Exception as e:
            logger.error(f"リアルタイムデータ取得エラー: {e}")
            return {"status": "error", "message": str(e)}
    
    def get_current_statistics(self) -> Dict[str, Any]:
        """現在の統計データを取得"""
        try:
            stats = {
                "total_production": 0,
                "equipment_utilization": 0.0,
                "average_lead_time": 0.0,
                "quality_rate": 100.0,
                "throughput": 0.0,
                "wip_count": 0
            }
            
            # 生産数をバッファから計算
            if "finished_goods" in self.factory.buffers:
                stats["total_production"] = self.factory.buffers["finished_goods"].current_quantity
            elif "shipping" in self.factory.buffers:
                stats["total_production"] = self.factory.buffers["shipping"].current_quantity
            
            # 設備稼働率を計算
            total_equipment = 0
            running_equipment = 0
            for process in self.factory.processes.values():
                for equipment in process.equipments:
                    total_equipment += 1
                    if equipment.status == "running":
                        running_equipment += 1
            
            if total_equipment > 0:
                stats["equipment_utilization"] = (running_equipment / total_equipment) * 100
            
            # 仕掛品数を計算
            for buffer in self.factory.buffers.values():
                if buffer.buffer_type == "intermediate":
                    stats["wip_count"] += buffer.current_quantity
            
            # スループットを計算（時間当たりの生産数）
            if self.env and self.env.now > 0:
                stats["throughput"] = (stats["total_production"] / (self.env.now / 3600)) if self.env.now > 0 else 0
            
            return stats
            
        except Exception as e:
            logger.error(f"統計データ取得エラー: {e}")
            return {
                "total_production": 0,
                "equipment_utilization": 0.0,
                "average_lead_time": 0.0,
                "quality_rate": 100.0,
                "throughput": 0.0,
                "wip_count": 0
            }
        
    async def _handle_processing_completed(self, event: SimulationEvent):
        """工程完了イベントハンドラー"""
        # スループット統計を更新
        if "throughput" in self.kpi_collectors:
            self.kpi_collectors["throughput"].record_completion(event)
            
    async def _handle_quality_inspection(self, event: SimulationEvent):
        """品質検査イベントハンドラー"""
        # 品質統計を更新
        if "quality" in self.kpi_collectors:
            self.kpi_collectors["quality"].record_inspection(event)
            
    async def _handle_transport_completed(self, event: SimulationEvent):
        """搬送完了イベントハンドラー"""
        # 搬送効率統計を更新
        pass
        
    async def _handle_material_delivered(self, event: SimulationEvent):
        """材料配送イベントハンドラー"""
        # 在庫統計を更新
        if "inventory" in self.kpi_collectors:
            self.kpi_collectors["inventory"].record_delivery(event)


# KPIコレクタークラス（簡略化）
class ThroughputCollector:
    def __init__(self):
        self.completions = []
        
    def record_completion(self, event: SimulationEvent):
        self.completions.append(event.timestamp)

class UtilizationCollector:
    def __init__(self):
        self.utilization_data = defaultdict(list)

class QualityKPICollector:
    def __init__(self):
        self.inspection_results = []
        
    def record_inspection(self, event: SimulationEvent):
        self.inspection_results.append(event.data)

class InventoryKPICollector:
    def __init__(self):
        self.deliveries = []
        
    def record_delivery(self, event: SimulationEvent):
        self.deliveries.append(event.timestamp)

class DeliveryPerformanceCollector:
    def __init__(self):
        self.delivery_performance = []
