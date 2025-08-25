"""
ストアスケジュール制御モジュール
ストアノードのスケジュール設定に基づいてシミュレーション全体の時間制御を行う
"""
import simpy
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta, time
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class WorkingHours:
    """稼働時間設定"""
    day_of_week: int  # 0=日曜, 1=月曜, ...
    start_time: str   # "08:00"
    end_time: str     # "17:00"
    break_times: List[Tuple[str, str]]  # [("12:00", "13:00")]
    is_working_day: bool

@dataclass
class ProductionSchedule:
    """生産スケジュール"""
    id: str
    product_id: str
    product_name: str
    target_quantity: int
    start_time: str
    end_time: str
    priority: str  # 'high', 'medium', 'low'
    demand_pattern: str  # 'constant', 'peak', 'seasonal'

@dataclass
class StoreScheduleConfig:
    """ストアスケジュール設定"""
    store_id: str
    store_name: str
    store_type: str
    capacity: int
    safety_stock: int
    reorder_point: int
    auto_replenishment: bool
    production_schedules: List[ProductionSchedule]
    working_hours: List[WorkingHours]
    cycle_based_on_store: bool = True

class StoreScheduleController:
    """ストアスケジュール制御クラス"""
    
    def __init__(self, env: simpy.Environment):
        self.env = env
        self.store_configs: Dict[str, StoreScheduleConfig] = {}
        self.master_store_id: Optional[str] = None  # マスタースケジュールを持つストア
        self.current_shift: Optional[str] = None
        self.is_working_time = False
        self.daily_schedules: Dict[str, List[ProductionSchedule]] = {}
        
    def register_store_schedule(self, store_id: str, config: StoreScheduleConfig):
        """ストアスケジュール設定を登録"""
        self.store_configs[store_id] = config
        
        # マスタースケジュールストアの決定
        if config.cycle_based_on_store or self.master_store_id is None:
            self.master_store_id = store_id
            logger.info(f"Master schedule store set to: {store_id}")
            
        self._build_daily_schedules(store_id, config)
        
    def _build_daily_schedules(self, store_id: str, config: StoreScheduleConfig):
        """日別スケジュールの構築"""
        self.daily_schedules[store_id] = []
        
        for schedule in config.production_schedules:
            # 優先度と需要パターンに基づいてスケジュールを調整
            adjusted_schedule = self._adjust_schedule_for_demand(schedule)
            self.daily_schedules[store_id].append(adjusted_schedule)
            
    def _adjust_schedule_for_demand(self, schedule: ProductionSchedule) -> ProductionSchedule:
        """需要パターンに基づくスケジュール調整"""
        if schedule.demand_pattern == 'peak':
            # ピーク需要の場合、開始時間を早める
            start_hour = max(6, int(schedule.start_time.split(':')[0]) - 1)
            schedule.start_time = f"{start_hour:02d}:00"
        elif schedule.demand_pattern == 'seasonal':
            # 季節変動の場合、数量を調整
            schedule.target_quantity = int(schedule.target_quantity * 1.2)
            
        return schedule
        
    def start_schedule_control(self):
        """スケジュール制御開始"""
        if self.master_store_id:
            config = self.store_configs[self.master_store_id]
            self.env.process(self._run_schedule_control(config))
            
    def _run_schedule_control(self, config: StoreScheduleConfig):
        """スケジュール制御メインループ"""
        try:
            while True:
                current_time = self._get_simulation_datetime()
                day_of_week = current_time.weekday() + 1  # Monday = 1
                
                # 該当日の稼働時間取得
                working_hours = self._get_working_hours_for_day(config, day_of_week)
                
                if working_hours and working_hours.is_working_day:
                    # 稼働日の場合
                    yield from self._handle_working_day(config, working_hours, current_time)
                else:
                    # 非稼働日の場合
                    yield from self._handle_non_working_day()
                    
        except Exception as e:
            logger.error(f"Schedule control error: {e}")
            
    def _get_working_hours_for_day(self, config: StoreScheduleConfig, day_of_week: int) -> Optional[WorkingHours]:
        """指定日の稼働時間取得"""
        for wh in config.working_hours:
            if wh.day_of_week == day_of_week:
                return wh
        return None
        
    def _handle_working_day(self, config: StoreScheduleConfig, working_hours: WorkingHours, current_time: datetime):
        """稼働日の処理"""
        self.is_working_time = True
        
        # 開始時刻まで待機
        start_time = self._parse_time(working_hours.start_time)
        if current_time.time() < start_time:
            wait_seconds = self._time_until(current_time, start_time)
            yield self.env.timeout(wait_seconds)
            
        # 生産スケジュール実行
        yield from self._execute_production_schedules(config)
        
        # 休憩時間の処理
        for break_start, break_end in working_hours.break_times:
            yield from self._handle_break_time(break_start, break_end)
            
        # 終了時刻まで稼働
        end_time = self._parse_time(working_hours.end_time)
        current_sim_time = self._get_simulation_datetime()
        if current_sim_time.time() < end_time:
            wait_seconds = self._time_until(current_sim_time, end_time)
            yield self.env.timeout(wait_seconds)
            
        self.is_working_time = False
        
    def _handle_non_working_day(self):
        """非稼働日の処理"""
        self.is_working_time = False
        # 24時間待機
        yield self.env.timeout(24 * 3600)
        
    def _execute_production_schedules(self, config: StoreScheduleConfig):
        """生産スケジュール実行"""
        schedules = self.daily_schedules.get(config.store_id, [])
        
        # 優先度順にソート
        schedules.sort(key=lambda s: {'high': 1, 'medium': 2, 'low': 3}[s.priority])
        
        for schedule in schedules:
            yield from self._execute_single_schedule(config, schedule)
            
    def _execute_single_schedule(self, config: StoreScheduleConfig, schedule: ProductionSchedule):
        """単一スケジュール実行"""
        logger.info(f"Executing schedule: {schedule.product_name} (qty: {schedule.target_quantity})")
        
        # スケジュール開始時刻まで待機
        start_time = self._parse_time(schedule.start_time)
        current_time = self._get_simulation_datetime()
        
        if current_time.time() < start_time:
            wait_seconds = self._time_until(current_time, start_time)
            yield self.env.timeout(wait_seconds)
            
        # 生産指示の発行
        self._issue_production_order(config, schedule)
        
        # スケジュール終了時刻まで監視
        end_time = self._parse_time(schedule.end_time)
        current_sim_time = self._get_simulation_datetime()
        if current_sim_time.time() < end_time:
            wait_seconds = self._time_until(current_sim_time, end_time)
            yield self.env.timeout(wait_seconds)
            
    def _issue_production_order(self, config: StoreScheduleConfig, schedule: ProductionSchedule):
        """生産指示発行"""
        order_data = {
            'store_id': config.store_id,
            'product_id': schedule.product_id,
            'product_name': schedule.product_name,
            'target_quantity': schedule.target_quantity,
            'priority': schedule.priority,
            'demand_pattern': schedule.demand_pattern,
            'due_time': schedule.end_time,
        }
        
        # イベント発行
        self._emit_event('production_order_issued', order_data)
        
    def _handle_break_time(self, break_start: str, break_end: str):
        """休憩時間処理"""
        current_time = self._get_simulation_datetime()
        start_time = self._parse_time(break_start)
        end_time = self._parse_time(break_end)
        
        # 休憩開始時刻まで待機
        if current_time.time() < start_time:
            wait_seconds = self._time_until(current_time, start_time)
            yield self.env.timeout(wait_seconds)
            
        # 休憩中フラグ設定
        self.is_working_time = False
        self._emit_event('break_started', {'start': break_start, 'end': break_end})
        
        # 休憩時間待機
        break_duration = self._time_difference(start_time, end_time)
        yield self.env.timeout(break_duration)
        
        # 休憩終了
        self.is_working_time = True
        self._emit_event('break_ended', {'start': break_start, 'end': break_end})
        
    def get_current_working_status(self) -> Dict[str, Any]:
        """現在の稼働状況取得"""
        return {
            'is_working_time': self.is_working_time,
            'current_shift': self.current_shift,
            'master_store_id': self.master_store_id,
            'simulation_time': self._get_simulation_datetime().isoformat(),
        }
        
    def get_store_demand_forecast(self, store_id: str) -> Dict[str, Any]:
        """ストアの需要予測取得"""
        if store_id not in self.store_configs:
            return {}
            
        config = self.store_configs[store_id]
        schedules = self.daily_schedules.get(store_id, [])
        
        total_demand = sum(s.target_quantity for s in schedules)
        peak_hours = [s.start_time for s in schedules if s.demand_pattern == 'peak']
        
        return {
            'store_id': store_id,
            'daily_demand': total_demand,
            'peak_hours': peak_hours,
            'priority_products': [s.product_name for s in schedules if s.priority == 'high'],
            'current_inventory': config.capacity - config.safety_stock,  # 簡易計算
            'reorder_needed': total_demand > config.reorder_point,
        }
        
    def _get_simulation_datetime(self) -> datetime:
        """シミュレーション時刻取得"""
        # シミュレーション開始を今日の0時とする
        base_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return base_date + timedelta(seconds=self.env.now)
        
    def _parse_time(self, time_str: str) -> time:
        """時刻文字列をtimeオブジェクトに変換"""
        hour, minute = map(int, time_str.split(':'))
        return time(hour, minute)
        
    def _time_until(self, current_datetime: datetime, target_time: time) -> float:
        """指定時刻までの秒数計算"""
        target_datetime = current_datetime.replace(
            hour=target_time.hour, 
            minute=target_time.minute, 
            second=0, 
            microsecond=0
        )
        
        if target_datetime <= current_datetime:
            # 翌日の同時刻
            target_datetime += timedelta(days=1)
            
        return (target_datetime - current_datetime).total_seconds()
        
    def _time_difference(self, start_time: time, end_time: time) -> float:
        """2つの時刻の差を秒で計算"""
        start_seconds = start_time.hour * 3600 + start_time.minute * 60
        end_seconds = end_time.hour * 3600 + end_time.minute * 60
        
        if end_seconds <= start_seconds:
            end_seconds += 24 * 3600  # 翌日
            
        return end_seconds - start_seconds
        
    def _emit_event(self, event_type: str, data: Dict[str, Any]):
        """イベント発行"""
        event_data = {
            'timestamp': self.env.now,
            'type': event_type,
            'data': data,
            'simulation_time': self._get_simulation_datetime().isoformat(),
        }
        logger.info(f"Store schedule event: {event_type} - {data}")