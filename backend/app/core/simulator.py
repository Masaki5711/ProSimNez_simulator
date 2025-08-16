"""
離散イベントシミュレーションエンジン
"""
import simpy
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
import asyncio
import json
import os

from app.models.factory import Factory
from app.models.process import Process
from app.models.product import Product
from app.models.event import SimulationEvent

class SimulationEngine:
    """シミュレーションエンジンクラス"""
    
    def __init__(self, factory: Factory, start_time: datetime, speed: float = 1.0):
        self.factory = factory
        self.env = simpy.Environment()
        self.start_time = start_time
        self.current_time = start_time
        self.speed = speed
        self.is_running = False
        self.is_paused = False
        
        # イベントリスナー
        self.event_listeners: List[Callable] = []
        
        # データ収集用
        self.inventory_history = []
        self.equipment_history = []
        self.event_log = []
        
        # フェーズ２テスト詳細ログ用
        self.phase2_test_log = {
            "test_start_time": None,
            "test_end_time": None,
            "configuration": {},
            "detailed_events": [],
            "process_states": [],
            "buffer_states": [],
            "equipment_states": [],
            "production_metrics": {},
            "performance_metrics": {},
            "errors_and_warnings": []
        }
        
    def add_event_listener(self, listener: Callable):
        """イベントリスナーを追加"""
        self.event_listeners.append(listener)
        
    def remove_event_listener(self, listener: Callable):
        """イベントリスナーを削除"""
        if listener in self.event_listeners:
            self.event_listeners.remove(listener)
            
    async def notify_listeners(self, event: SimulationEvent):
        """全リスナーにイベントを通知"""
        # フェーズ２テストログに記録
        self.log_phase2_event(event)
        
        for listener in self.event_listeners:
            if asyncio.iscoroutinefunction(listener):
                await listener(event)
            else:
                listener(event)
                
    def log_phase2_event(self, event: SimulationEvent):
        """フェーズ２テスト用の詳細イベントログ記録"""
        event_record = {
            "timestamp": event.timestamp.isoformat(),
            "simulation_time": self.env.now,
            "event_type": event.event_type,
            "process_id": getattr(event, 'process_id', None),
            "equipment_id": getattr(event, 'equipment_id', None),
            "product_id": getattr(event, 'product_id', None),
            "data": event.data or {},
            "description": self._generate_event_description(event)
        }
        self.phase2_test_log["detailed_events"].append(event_record)
        
    def _generate_event_description(self, event: SimulationEvent) -> str:
        """イベントの詳細説明を生成"""
        event_type = event.event_type
        process_id = getattr(event, 'process_id', 'Unknown')
        equipment_id = getattr(event, 'equipment_id', 'Unknown')
        
        descriptions = {
            "process_start": f"工程 {process_id} の設備 {equipment_id} で加工開始",
            "process_complete": f"工程 {process_id} の設備 {equipment_id} で加工完了",
            "buffer_add": f"バッファに製品追加",
            "buffer_remove": f"バッファから製品取得",
            "equipment_breakdown": f"設備 {equipment_id} が故障",
            "equipment_repair": f"設備 {equipment_id} が修理完了",
            "production_complete": f"製品生産完了",
            "quality_check": f"品質検査実行"
        }
        
        return descriptions.get(event_type, f"イベントタイプ: {event_type}")
        
    def capture_system_state(self):
        """現在のシステム状態をキャプチャ"""
        current_time = self.get_current_datetime()
        
        # プロセス状態を記録
        process_states = []
        for process_id, process in self.factory.processes.items():
            equipment_states = []
            for eq_id, equipment in process.equipments.items():
                equipment_states.append({
                    "equipment_id": eq_id,
                    "status": equipment.status,
                    "utilization": getattr(equipment, 'utilization', 0),
                    "current_product": getattr(equipment, 'current_product', None)
                })
            
            process_states.append({
                "process_id": process_id,
                "process_name": process.name,
                "process_type": process.type,
                "equipment_states": equipment_states,
                "input_buffer_id": process.input_buffer_id,
                "output_buffer_id": process.output_buffer_id
            })
        
        # バッファ状態を記録
        buffer_states = []
        for buffer_id, buffer in self.factory.buffers.items():
            buffer_states.append({
                "buffer_id": buffer_id,
                "buffer_name": buffer.name,
                "capacity": buffer.capacity,
                "current_stock": sum(sum(lot["quantity"] for lot in lots) for lots in buffer.inventory.values()),
                "inventory_details": buffer.inventory,
                "location_type": buffer.location_type,
                "buffer_type": buffer.buffer_type
            })
        
        # 記録
        state_record = {
            "timestamp": current_time.isoformat(),
            "simulation_time": self.env.now,
            "process_states": process_states,
            "buffer_states": buffer_states
        }
        
        self.phase2_test_log["process_states"].append(state_record)
        self.phase2_test_log["buffer_states"].append(state_record)
                
    def get_current_datetime(self) -> datetime:
        """現在のシミュレーション時刻を取得"""
        return self.start_time + timedelta(seconds=self.env.now)
        
    def run_process(self, process: Process):
        """工程プロセスを実行"""
        def process_runner():
            while True:
                try:
                    # 設備が利用可能になるまで待機
                    equipment = process.get_available_equipment()
                    if not equipment:
                        yield self.env.timeout(5)  # 5秒待機
                        continue
                    
                    # 設備を占有
                    equipment.status = "running"
                    
                    # 加工開始イベント
                    event = SimulationEvent(
                        timestamp=self.get_current_datetime(),
                        event_type="process_start",
                        process_id=process.id,
                        equipment_id=equipment.id,
                        data={"equipment_status": equipment.status}
                    )
                    asyncio.create_task(self.notify_listeners(event))
                    
                    # 加工時間をシミュレート（30-180秒の範囲）
                    processing_time = list(process.processing_time.values())[0] if process.processing_time else 60
                    yield self.env.timeout(processing_time)
                    
                    # 設備を解放
                    equipment.status = "idle"
                    
                    # 完了イベント
                    event = SimulationEvent(
                        timestamp=self.get_current_datetime(),
                        event_type="process_complete",
                        process_id=process.id,
                        equipment_id=equipment.id,
                        data={"equipment_status": equipment.status}
                    )
                    asyncio.create_task(self.notify_listeners(event))
                    
                    # 出力バッファに製品を追加
                    if process.output_buffer_id and process.output_buffer_id in self.factory.buffers:
                        product_id = list(process.processing_time.keys())[0] if process.processing_time else "SAMPLE_PRODUCT"
                        self.factory.buffers[process.output_buffer_id].add_lot(
                            product_id, 
                            f"LOT_{int(self.env.now)}_{equipment.id}",
                            1,
                            process.id
                        )
                    
                except Exception as e:
                    print(f"工程 {process.id} でエラー: {e}")
                    yield self.env.timeout(10)  # エラー時は10秒待機
                
        return self.env.process(process_runner())
        
    def initialize_simulation(self):
        """シミュレーションを初期化"""
        # 各工程のプロセスを開始
        for process in self.factory.processes.values():
            self.run_process(process)
            
    async def start(self, duration: Optional[float] = None):
        """シミュレーションを開始"""
        self.is_running = True
        self.is_paused = False
        
        # シミュレーションの初期化
        self.initialize_simulation()
        
        # シミュレーションループ
        try:
            last_broadcast = 0
            last_state_capture = 0
            broadcast_interval = 5  # 5秒ごとに状態をブロードキャスト
            state_capture_interval = 30  # 30秒ごとにフェーズ２テスト用状態キャプチャ
            
            while self.is_running:
                if not self.is_paused:
                    # 1秒分のシミュレーションを実行
                    next_time = self.env.now + 1
                    if duration and next_time > duration:
                        break
                        
                    self.env.run(until=next_time)
                    
                    # 定期的に状態更新を通知
                    if self.env.now - last_broadcast >= broadcast_interval:
                        await self.broadcast_state()
                        last_broadcast = self.env.now
                    
                    # フェーズ２テスト用の定期的な状態キャプチャ
                    if self.env.now - last_state_capture >= state_capture_interval:
                        self.capture_system_state()
                        last_state_capture = self.env.now
                    
                # 速度調整
                await asyncio.sleep(1.0 / self.speed if not self.is_paused else 0.1)
                    
        except Exception as e:
            print(f"シミュレーションエラー: {e}")
        finally:
            self.is_running = False
            
    async def pause(self):
        """シミュレーションを一時停止"""
        self.is_paused = True
        
    async def resume(self):
        """シミュレーションを再開"""
        self.is_paused = False
        
    async def stop(self):
        """シミュレーションを停止"""
        self.is_running = False
        
    def set_speed(self, speed: float):
        """シミュレーション速度を設定"""
        self.speed = max(0.1, min(speed, 100.0))  # 0.1倍〜100倍の範囲
        
    async def broadcast_state(self):
        """現在の状態をブロードキャスト"""
        state = {
            "timestamp": self.get_current_datetime().isoformat(),
            "inventories": self.get_current_inventories(),
            "equipment_states": self.get_equipment_states(),
            "kpis": self.calculate_kpis()
        }
        
        event = SimulationEvent(
            timestamp=self.get_current_datetime(),
            event_type="state_update",
            data=state
        )
        await self.notify_listeners(event)
        
    def get_current_inventories(self) -> Dict:
        """現在の在庫状態を取得"""
        inventories = {}
        for buffer_id, buffer in self.factory.buffers.items():
            inventories[buffer_id] = {
                "products": buffer.get_inventory_levels(),
                "total": buffer.get_total_quantity()
            }
        return inventories
        
    def get_equipment_states(self) -> Dict:
        """設備の状態を取得"""
        states = {}
        for process_id, process in self.factory.processes.items():
            states[process_id] = {
                "equipments": {
                    eq_id: eq.get_state() 
                    for eq_id, eq in process.equipments.items()
                }
            }
        return states
        
    def calculate_kpis(self) -> Dict:
        """KPIを計算"""
        total_production = 0
        total_inventory = 0
        running_equipment = 0
        total_equipment = 0
        
        # 生産数を計算（完成品バッファの在庫）
        for buffer_id, buffer in self.factory.buffers.items():
            if "FINAL" in buffer_id:
                total_production += buffer.get_total_quantity()
            total_inventory += buffer.get_total_quantity()
        
        # 設備稼働率を計算
        for process in self.factory.processes.values():
            for equipment in process.equipments.values():
                total_equipment += 1
                if equipment.status == "running":
                    running_equipment += 1
        
        equipment_utilization = (running_equipment / total_equipment * 100) if total_equipment > 0 else 0
        
        # 簡易的な在庫回転率（実行時間に基づく）
        runtime_hours = self.env.now / 3600 if self.env.now > 0 else 0.01
        inventory_turnover = total_production / runtime_hours if runtime_hours > 0 else 0
        
        # 平均リードタイム（簡易計算）
        average_lead_time = (self.env.now / 60) if total_production > 0 else 0  # 分単位
        
        return {
            "total_production": int(total_production),
            "average_lead_time": round(average_lead_time, 1),
            "equipment_utilization": round(equipment_utilization, 1),
            "inventory_turnover": round(inventory_turnover, 2)
        }
        
    def start_phase2_test(self, config: dict):
        """フェーズ２テスト開始時の初期化"""
        self.phase2_test_log["test_start_time"] = datetime.now().isoformat()
        self.phase2_test_log["configuration"] = config
        print(f"🚀 フェーズ２テスト開始: {self.phase2_test_log['test_start_time']}")
        
    def end_phase2_test(self):
        """フェーズ２テスト終了時の処理"""
        self.phase2_test_log["test_end_time"] = datetime.now().isoformat()
        
        # 最終パフォーマンスメトリクスを計算
        self.phase2_test_log["performance_metrics"] = self.get_kpis()
        
        # 生産メトリクスを計算
        total_events = len(self.phase2_test_log["detailed_events"])
        process_events = sum(1 for event in self.phase2_test_log["detailed_events"] 
                           if event["event_type"] in ["process_start", "process_complete"])
        
        self.phase2_test_log["production_metrics"] = {
            "total_events": total_events,
            "process_events": process_events,
            "simulation_duration_seconds": self.env.now,
            "simulation_duration_minutes": round(self.env.now / 60, 2),
            "events_per_minute": round(total_events / (self.env.now / 60), 2) if self.env.now > 0 else 0
        }
        
        print(f"✅ フェーズ２テスト終了: {self.phase2_test_log['test_end_time']}")
        print(f"📊 総イベント数: {total_events}")
        print(f"⏰ シミュレーション時間: {round(self.env.now / 60, 2)} 分")
        
    def generate_phase2_test_report(self, output_dir: str = "reports") -> str:
        """フェーズ２テスト結果のMDレポートを生成"""
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"phase2_test_report_{timestamp}.md"
        filepath = os.path.join(output_dir, filename)
        
        # MDコンテンツを生成
        md_content = self._generate_md_content()
        
        # ファイルに書き込み
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md_content)
            
        print(f"📄 フェーズ２テストレポートを生成しました: {filepath}")
        return filepath
        
    def _generate_md_content(self) -> str:
        """MDファイルのコンテンツを生成"""
        log = self.phase2_test_log
        
        md_content = f"""# フェーズ２テスト実行レポート

## 🔍 テスト概要

| 項目 | 値 |
|------|------|
| テスト開始時刻 | {log.get('test_start_time', 'N/A')} |
| テスト終了時刻 | {log.get('test_end_time', 'N/A')} |
| シミュレーション時間 | {log.get('production_metrics', {}).get('simulation_duration_minutes', 0)} 分 |
| 総イベント数 | {log.get('production_metrics', {}).get('total_events', 0)} |
| 工程イベント数 | {log.get('production_metrics', {}).get('process_events', 0)} |

## ⚙️ 設定情報

```json
{json.dumps(log.get('configuration', {}), indent=2, ensure_ascii=False)}
```

## 📊 パフォーマンスメトリクス

| メトリクス | 値 |
|------------|------|
| 総生産量 | {log.get('performance_metrics', {}).get('total_production', 0)} |
| 平均リードタイム | {log.get('performance_metrics', {}).get('average_lead_time', 0)} 分 |
| 設備稼働率 | {log.get('performance_metrics', {}).get('equipment_utilization', 0)}% |
| 在庫回転率 | {log.get('performance_metrics', {}).get('inventory_turnover', 0)} |

## 📈 生産メトリクス

| メトリクス | 値 |
|------------|------|
| 分あたりイベント数 | {log.get('production_metrics', {}).get('events_per_minute', 0)} |
| シミュレーション効率 | {self._calculate_simulation_efficiency()}% |

## 📋 詳細イベントログ

### イベント統計
"""

        # イベントタイプ別の統計
        event_types = {}
        for event in log.get('detailed_events', []):
            event_type = event.get('event_type', 'unknown')
            event_types[event_type] = event_types.get(event_type, 0) + 1
            
        md_content += "\n| イベントタイプ | 回数 |\n|---------------|------|\n"
        for event_type, count in sorted(event_types.items()):
            md_content += f"| {event_type} | {count} |\n"

        # 時系列イベント詳細
        md_content += "\n### 時系列イベント詳細\n\n"
        md_content += "| 時刻 | シミュレーション時間 | イベントタイプ | 説明 | 詳細データ |\n"
        md_content += "|------|---------------------|----------------|------|------------|\n"
        
        for event in log.get('detailed_events', []):
            timestamp = event.get('timestamp', '')[:19]  # 秒まで表示
            sim_time = f"{event.get('simulation_time', 0):.1f}s"
            event_type = event.get('event_type', '')
            description = event.get('description', '')
            data_str = str(event.get('data', {}))[:50] + "..." if len(str(event.get('data', {}))) > 50 else str(event.get('data', {}))
            
            md_content += f"| {timestamp} | {sim_time} | {event_type} | {description} | {data_str} |\n"

        # システム状態の記録
        md_content += "\n## 🏭 システム状態履歴\n\n"
        
        if log.get('process_states'):
            md_content += "### 工程状態履歴\n\n"
            for i, state in enumerate(log.get('process_states', [])[:5]):  # 最初の5つの状態のみ表示
                md_content += f"#### 状態記録 {i+1} ({state.get('timestamp', '')[:19]})\n\n"
                for process in state.get('process_states', []):
                    md_content += f"**工程**: {process.get('process_name', '')} ({process.get('process_id', '')})\n"
                    md_content += f"- タイプ: {process.get('process_type', '')}\n"
                    for equipment in process.get('equipment_states', []):
                        md_content += f"- 設備 {equipment.get('equipment_id', '')}: {equipment.get('status', '')} (稼働率: {equipment.get('utilization', 0)}%)\n"
                    md_content += "\n"

        if log.get('buffer_states'):
            md_content += "### バッファ状態履歴\n\n"
            for i, state in enumerate(log.get('buffer_states', [])[:5]):  # 最初の5つの状態のみ表示
                md_content += f"#### バッファ状態 {i+1} ({state.get('timestamp', '')[:19]})\n\n"
                for buffer in state.get('buffer_states', []):
                    md_content += f"**バッファ**: {buffer.get('buffer_name', '')} ({buffer.get('buffer_id', '')})\n"
                    md_content += f"- 容量: {buffer.get('capacity', 'unlimited')}\n"
                    md_content += f"- 現在在庫: {buffer.get('current_stock', 0)}\n"
                    md_content += f"- タイプ: {buffer.get('buffer_type', '')}\n\n"

        # エラーと警告
        if log.get('errors_and_warnings'):
            md_content += "## ⚠️ エラーと警告\n\n"
            for error in log.get('errors_and_warnings', []):
                md_content += f"- **{error.get('level', 'ERROR')}**: {error.get('message', '')}\n"
        else:
            md_content += "## ✅ エラーと警告\n\n"
            md_content += "エラーや警告はありませんでした。\n"

        # まとめ
        md_content += f"""
## 📋 テスト結果サマリー

このフェーズ２テストでは、以下の結果が得られました：

- **実行時間**: {log.get('production_metrics', {}).get('simulation_duration_minutes', 0)} 分
- **総イベント数**: {log.get('production_metrics', {}).get('total_events', 0)}
- **生産性**: {log.get('performance_metrics', {}).get('total_production', 0)} 製品
- **システム効率**: {self._calculate_simulation_efficiency()}%

---
*レポート生成時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

        return md_content
        
    def _calculate_simulation_efficiency(self) -> float:
        """シミュレーション効率を計算"""
        total_events = len(self.phase2_test_log.get('detailed_events', []))
        simulation_time = self.env.now
        
        if simulation_time > 0:
            efficiency = min(100, (total_events / simulation_time) * 100)
            return round(efficiency, 1)
        return 0.0