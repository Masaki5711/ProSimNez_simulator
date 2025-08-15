"""
詳細工程シミュレーション
設備・作業者管理、段取り時間処理、品質チェック機能を含む
"""
import asyncio
import simpy
import random
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass

from app.models.process import Process, Equipment
from app.models.product import Product, Lot
from app.models.buffer import Buffer
from app.models.event import SimulationEvent
from app.core.resource_manager import ResourceManager, Equipment as ResourceEquipment, Worker
from app.core.event_manager import EventManager, EventPriority

class ProcessState(Enum):
    """工程状態"""
    IDLE = "idle"
    RUNNING = "running"
    SETUP = "setup"
    BLOCKED = "blocked"
    BREAKDOWN = "breakdown"
    MAINTENANCE = "maintenance"

class QualityLevel(Enum):
    """品質レベル"""
    GOOD = "good"
    DEFECT = "defect"
    REWORK = "rework"

@dataclass
class ProcessingJob:
    """加工ジョブ"""
    job_id: str
    lot: Lot
    product: Product
    processing_time: float
    setup_time: float
    quality_requirements: List[Dict[str, Any]]
    priority: int = 0
    scheduled_start: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None

@dataclass
class SetupOperation:
    """段取り作業"""
    operation_id: str
    from_product_id: Optional[str]
    to_product_id: str
    setup_time: float
    required_tools: List[str]
    required_skills: List[str]
    steps: List[Dict[str, Any]]

@dataclass
class QualityCheck:
    """品質チェック"""
    check_id: str
    check_type: str  # "dimensional", "visual", "functional", "material"
    specification: Dict[str, Any]
    sampling_rate: float  # サンプリング率 (0.0-1.0)
    check_time: float  # チェック時間(秒)

class DetailedProcessSimulator:
    """詳細工程シミュレータ"""
    
    def __init__(self, process: Process, resource_manager: ResourceManager, 
                 event_manager: EventManager, env: simpy.Environment):
        self.process = process
        self.resource_manager = resource_manager
        self.event_manager = event_manager
        self.env = env
        
        # 工程状態
        self.state = ProcessState.IDLE
        self.current_job: Optional[ProcessingJob] = None
        self.current_setup: Optional[SetupOperation] = None
        self.job_queue: List[ProcessingJob] = []
        
        # 統計情報
        self.stats = {
            "total_jobs_processed": 0,
            "total_processing_time": 0.0,
            "total_setup_time": 0.0,
            "total_idle_time": 0.0,
            "total_blocked_time": 0.0,
            "defect_count": 0,
            "rework_count": 0,
            "breakdown_count": 0
        }
        
        # 品質チェック設定
        self.quality_checks = self._initialize_quality_checks()
        
        # 段取り履歴
        self.setup_history: List[SetupOperation] = []
        
        # 最後に加工した製品
        self.last_processed_product_id: Optional[str] = None
        
        # 故障・メンテナンススケジュール
        self.maintenance_schedule: List[Dict[str, Any]] = []
        self.breakdown_probability = 0.001  # 1時間あたり0.1%の故障確率
        
    def _initialize_quality_checks(self) -> List[QualityCheck]:
        """品質チェックを初期化"""
        checks = []
        
        # プロセスタイプに応じたデフォルト品質チェック
        if self.process.type == "machining":
            checks.append(QualityCheck(
                check_id="dimensional_check",
                check_type="dimensional",
                specification={"tolerance": 0.1, "unit": "mm"},
                sampling_rate=0.1,  # 10%サンプリング
                check_time=30.0
            ))
        elif self.process.type == "assembly":
            checks.append(QualityCheck(
                check_id="functional_check",
                check_type="functional",
                specification={"test_parameters": ["torque", "alignment"]},
                sampling_rate=0.2,  # 20%サンプリング
                check_time=60.0
            ))
        elif self.process.type == "inspection":
            checks.append(QualityCheck(
                check_id="comprehensive_check",
                check_type="visual",
                specification={"defect_types": ["scratch", "dent", "color"]},
                sampling_rate=1.0,  # 100%チェック
                check_time=45.0
            ))
            
        return checks
        
    async def run_simulation(self):
        """工程シミュレーションのメインループ"""
        # SimPyプロセスとして実行
        def process_simulation():
            while True:
                try:
                    # 状態に応じた処理
                    if self.state == ProcessState.IDLE:
                        yield from self._handle_idle_state()
                    elif self.state == ProcessState.SETUP:
                        yield from self._handle_setup_state()
                    elif self.state == ProcessState.RUNNING:
                        yield from self._handle_running_state()
                    elif self.state == ProcessState.BLOCKED:
                        yield from self._handle_blocked_state()
                    elif self.state == ProcessState.BREAKDOWN:
                        yield from self._handle_breakdown_state()
                    elif self.state == ProcessState.MAINTENANCE:
                        yield from self._handle_maintenance_state()
                        
                    # 故障チェック
                    if random.random() < self.breakdown_probability / 3600:
                        yield from self._trigger_breakdown()
                        
                    # 短い間隔で状態をチェック
                    yield self.env.timeout(1.0)  # 1秒間隔
                    
                except Exception as e:
                    # SimPyプロセス内ではasyncio.create_taskを使用
                    asyncio.create_task(self._emit_error_event(str(e)))
                    yield self.env.timeout(10.0)  # エラー時は10秒待機
                    
        return self.env.process(process_simulation())
        
    def _handle_idle_state(self):
        """アイドル状態の処理"""
        # 処理待ちジョブがあるかチェック
        if self.job_queue:
            next_job = self.job_queue[0]
            
            # 段取りが必要かチェック
            if self._is_setup_required(next_job):
                self._start_setup(next_job)
            else:
                self._start_processing(next_job)
        else:
            # ジョブがない場合は待機
            yield self.env.timeout(5.0)
            self.stats["total_idle_time"] += 5.0
            
    def _handle_setup_state(self):
        """段取り状態の処理"""
        if self.current_setup:
            # 段取り時間の経過を待つ
            yield self.env.timeout(self.current_setup.setup_time)
            
            # 段取り完了
            self._complete_setup()
            
    def _handle_running_state(self):
        """加工中状態の処理"""
        if self.current_job:
            # 加工時間の経過を待つ
            yield self.env.timeout(self.current_job.processing_time)
            
            # 品質チェック
            quality_result = self._perform_quality_check(self.current_job)
            
            # 加工完了
            self._complete_processing(quality_result)
            
    def _handle_blocked_state(self):
        """ブロック状態の処理"""
        # 出力バッファの空きを待つ
        output_buffer = self._get_output_buffer()
        if output_buffer and output_buffer.get_total_quantity() < output_buffer.capacity:
            self.state = ProcessState.IDLE
        else:
            yield self.env.timeout(10.0)  # 10秒待機
            self.stats["total_blocked_time"] += 10.0
            
    def _handle_breakdown_state(self):
        """故障状態の処理"""
        # 故障修理時間（30分〜2時間）
        repair_time = random.uniform(1800, 7200)
        yield self.env.timeout(repair_time)
        
        # 修理完了
        self.state = ProcessState.IDLE
        self.stats["breakdown_count"] += 1
        
        asyncio.create_task(self._emit_event("breakdown_resolved", {
            "repair_time": repair_time
        }))
        
    def _handle_maintenance_state(self):
        """メンテナンス状態の処理"""
        # 予定メンテナンス時間
        maintenance_time = 3600  # 1時間
        yield self.env.timeout(maintenance_time)
        
        # メンテナンス完了
        self.state = ProcessState.IDLE
        
        asyncio.create_task(self._emit_event("maintenance_completed", {
            "maintenance_time": maintenance_time
        }))
        
    def _is_setup_required(self, job: ProcessingJob) -> bool:
        """段取りが必要かチェック"""
        if self.last_processed_product_id is None:
            return True  # 初回は必ず段取りが必要
            
        return self.last_processed_product_id != job.product.id
        
    def _start_setup(self, job: ProcessingJob):
        """段取り開始"""
        setup_time = self._calculate_setup_time(
            self.last_processed_product_id, 
            job.product.id
        )
        
        self.current_setup = SetupOperation(
            operation_id=f"setup_{self.env.now}",
            from_product_id=self.last_processed_product_id,
            to_product_id=job.product.id,
            setup_time=setup_time,
            required_tools=[],
            required_skills=["setup"],
            steps=[]
        )
        
        self.state = ProcessState.SETUP
        
        asyncio.create_task(self._emit_event("setup_started", {
            "setup_operation": self.current_setup.__dict__,
            "estimated_duration": setup_time
        }))
        
    def _complete_setup(self):
        """段取り完了"""
        if self.current_setup:
            self.setup_history.append(self.current_setup)
            self.stats["total_setup_time"] += self.current_setup.setup_time
            
            asyncio.create_task(self._emit_event("setup_completed", {
                "setup_operation": self.current_setup.__dict__,
                "actual_duration": self.current_setup.setup_time
            }))
            
            self.current_setup = None
            
        # 次のジョブの加工を開始
        if self.job_queue:
            next_job = self.job_queue.pop(0)
            self._start_processing(next_job)
        else:
            self.state = ProcessState.IDLE
            
    def _start_processing(self, job: ProcessingJob):
        """加工開始"""
        # 出力バッファの容量チェック
        output_buffer = self._get_output_buffer()
        if output_buffer and output_buffer.get_total_quantity() >= output_buffer.capacity:
            self.state = ProcessState.BLOCKED
            return
            
        self.current_job = job
        self.current_job.actual_start = datetime.now()
        self.state = ProcessState.RUNNING
        
        asyncio.create_task(self._emit_event("processing_started", {
            "job": job.__dict__,
            "estimated_duration": job.processing_time
        }))
        
    def _complete_processing(self, quality_result: QualityLevel):
        """加工完了"""
        if self.current_job:
            self.current_job.actual_end = datetime.now()
            
            # 統計更新
            self.stats["total_jobs_processed"] += 1
            self.stats["total_processing_time"] += self.current_job.processing_time
            
            if quality_result == QualityLevel.DEFECT:
                self.stats["defect_count"] += 1
            elif quality_result == QualityLevel.REWORK:
                self.stats["rework_count"] += 1
                
            # 出力バッファに製品を追加
            self._output_product(self.current_job, quality_result)
            
            # 最後に加工した製品IDを更新
            self.last_processed_product_id = self.current_job.product.id
            
            asyncio.create_task(self._emit_event("processing_completed", {
                "job": self.current_job.__dict__,
                "quality_result": quality_result.value,
                "actual_duration": self.current_job.processing_time
            }))
            
            self.current_job = None
            
        self.state = ProcessState.IDLE
        
    def _perform_quality_check(self, job: ProcessingJob) -> QualityLevel:
        """品質チェック実行"""
        # 基本不良率を取得
        base_defect_rate = getattr(self.process, 'defect_rate', 0) / 100
        rework_rate = getattr(self.process, 'rework_rate', 0) / 100
        
        # ランダムで品質を決定
        quality_random = random.random()
        
        if quality_random < base_defect_rate:
            return QualityLevel.DEFECT
        elif quality_random < base_defect_rate + rework_rate:
            return QualityLevel.REWORK
        else:
            return QualityLevel.GOOD
            
    def _calculate_setup_time(self, from_product_id: Optional[str], 
                             to_product_id: str) -> float:
        """段取り時間を計算"""
        # 基本段取り時間
        base_setup_time = getattr(self.process, 'setup_time', 0)
        
        # 製品間の類似性による調整（簡略化）
        if from_product_id == to_product_id:
            return 0.0  # 同一製品なら段取り不要
        elif from_product_id is None:
            return base_setup_time  # 初回は基本時間
        else:
            # 製品間の段取り時間（実際には段取り時間マトリクスを使用）
            return base_setup_time * random.uniform(0.8, 1.2)
            
    def _get_output_buffer(self) -> Optional[Buffer]:
        """出力バッファを取得"""
        if self.process.output_buffer_id:
            # ResourceManagerからバッファを取得（簡略化）
            return None  # TODO: 実装
        return None
        
    def _output_product(self, job: ProcessingJob, quality_result: QualityLevel):
        """製品を出力バッファに追加"""
        # TODO: 実際のバッファへの追加実装
        pass
        
    def _trigger_breakdown(self):
        """故障を発生させる"""
        if self.state not in [ProcessState.BREAKDOWN, ProcessState.MAINTENANCE]:
            self.state = ProcessState.BREAKDOWN
            
            asyncio.create_task(self._emit_event("breakdown_occurred", {
                "breakdown_time": self.env.now,
                "previous_state": self.state.value
            }))
            
        return self.env.timeout(0)  # 即座に処理
        
    async def _emit_event(self, event_type: str, data: Dict[str, Any] = None):
        """イベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            process_id=self.process.id,
            data=data or {}
        )
        await self.event_manager.emit_event(event)
        
    async def _emit_error_event(self, error_message: str):
        """エラーイベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type="process_error",
            process_id=self.process.id,
            data={"error": error_message}
        )
        await self.event_manager.emit_event(event, EventPriority.CRITICAL)
        
    def add_job(self, job: ProcessingJob):
        """ジョブを追加"""
        # 優先度順に挿入
        inserted = False
        for i, existing_job in enumerate(self.job_queue):
            if job.priority > existing_job.priority:
                self.job_queue.insert(i, job)
                inserted = True
                break
                
        if not inserted:
            self.job_queue.append(job)
            
        asyncio.create_task(self._emit_event("job_added", {
            "job": job.__dict__,
            "queue_length": len(self.job_queue)
        }))
        
    def get_status(self) -> Dict[str, Any]:
        """工程状態を取得"""
        return {
            "process_id": self.process.id,
            "state": self.state.value,
            "current_job": self.current_job.__dict__ if self.current_job else None,
            "queue_length": len(self.job_queue),
            "last_processed_product": self.last_processed_product_id,
            "statistics": self.stats.copy()
        }
        
    def get_kpis(self) -> Dict[str, Any]:
        """KPIを計算"""
        total_time = (
            self.stats["total_processing_time"] + 
            self.stats["total_setup_time"] + 
            self.stats["total_idle_time"] + 
            self.stats["total_blocked_time"]
        )
        
        if total_time == 0:
            return {"utilization": 0, "efficiency": 0, "quality_rate": 100}
            
        # 稼働率（加工時間 / 総時間）
        utilization = (self.stats["total_processing_time"] / total_time) * 100
        
        # 効率（加工時間 / (加工時間 + 段取り時間)）
        productive_time = self.stats["total_processing_time"] + self.stats["total_setup_time"]
        efficiency = (self.stats["total_processing_time"] / productive_time * 100) if productive_time > 0 else 0
        
        # 品質率
        total_products = self.stats["total_jobs_processed"]
        good_products = total_products - self.stats["defect_count"] - self.stats["rework_count"]
        quality_rate = (good_products / total_products * 100) if total_products > 0 else 100
        
        return {
            "utilization": round(utilization, 2),
            "efficiency": round(efficiency, 2), 
            "quality_rate": round(quality_rate, 2),
            "throughput": self.stats["total_jobs_processed"],
            "breakdown_count": self.stats["breakdown_count"]
        }
