"""
強化された非同期シミュレーションエンジン v2
Witness風離散イベントシミュレーション
- ネットワークデータから工場モデルを構築
- 時間加速による高速シミュレーション
- 搬送状態トラッキング
- 時系列データ収集
- WebSocket経由でリアルタイムイベント配信
"""
import asyncio
import random
import math
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from collections import defaultdict
import uuid

from app.models.factory import Factory
from app.models.process import Process, Equipment as ProcessEquipment
from app.models.buffer import Buffer
from app.models.product import Product
from app.models.event import SimulationEvent
from app.core.event_manager import EventManager, EventPriority

logger = logging.getLogger(__name__)


class SimulationState:
    """シミュレーション状態管理"""

    def __init__(self):
        self.simulation_id: str = str(uuid.uuid4())
        self.status = "idle"
        self.progress = 0.0
        self.current_time = 0.0
        self.target_duration = 0.0
        self.start_timestamp: Optional[datetime] = None
        self.end_timestamp: Optional[datetime] = None
        self.error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "simulation_id": self.simulation_id,
            "status": self.status,
            "progress": self.progress,
            "current_time": self.current_time,
            "target_duration": self.target_duration,
            "start_timestamp": self.start_timestamp.isoformat() if self.start_timestamp else None,
            "end_timestamp": self.end_timestamp.isoformat() if self.end_timestamp else None,
            "error_message": self.error_message,
        }


# ── 搬送ジョブ ──
class TransportJob:
    __slots__ = ("id", "conn_id", "source", "target", "product_id",
                 "quantity", "start_time", "arrive_time", "transport_type")

    def __init__(self, conn_id, source, target, product_id, quantity,
                 start_time, arrive_time, transport_type):
        self.id = str(uuid.uuid4())[:8]
        self.conn_id = conn_id
        self.source = source
        self.target = target
        self.product_id = product_id
        self.quantity = quantity
        self.start_time = start_time
        self.arrive_time = arrive_time
        self.transport_type = transport_type


class EnhancedSimulationEngine:
    """強化されたシミュレーションエンジン v2"""

    def __init__(self, factory: Factory, websocket_manager=None, redis_client=None):
        self.factory = factory
        self.state = SimulationState()
        self.event_manager = EventManager()

        # シミュレーション制御
        self.simulation_task: Optional[asyncio.Task] = None
        self.time_step = 1.0
        self.speed_factor = 60.0  # デフォルト60倍速

        # ── 工程・設備状態 ──
        self._equipment_states: Dict[str, Dict[str, Any]] = {}

        # ── 搬送状態 ──
        self._connections: List[Dict[str, Any]] = []
        self._active_transports: List[TransportJob] = []
        self._transport_stats: Dict[str, Dict[str, Any]] = {}  # conn_id -> stats

        # ── 統計 ──
        self._stats: Dict[str, Any] = {
            "total_production": 0,
            "total_defects": 0,
            "process_production": {},
            "process_defects": {},
            "process_waiting_time": {},  # 材料待ち時間
            "process_busy_time": {},
        }

        # ── 時系列データ ──
        self._time_series: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
        self._ts_interval = 10.0  # 10秒ごとに記録
        self._last_ts_time = 0.0

        # ── 開始/終了工程 ──
        self._start_processes: List[str] = []
        self._end_processes: List[str] = []

        # ── イベントハンドラー ──
        if websocket_manager:
            from app.core.event_manager import RealtimeEventHandler
            self.event_manager.register_handler(
                RealtimeEventHandler(websocket_manager, redis_client))
        from app.core.event_manager import StatisticsEventHandler
        self.event_manager.register_handler(StatisticsEventHandler())

    # ================================================================
    # ネットワーク → ファクトリー構築
    # ================================================================
    def build_factory_from_network(self, network_data: Dict[str, Any]):
        nodes = network_data.get("nodes", [])
        edges = network_data.get("edges", [])
        products = network_data.get("products", [])
        bom_items = network_data.get("bom_items", [])
        # BOMをparent_product→[{child, qty}]のマップに変換
        self._bom_map: Dict[str, List[Dict]] = {}
        for b in bom_items:
            parent = b.get("parent_product", "")
            if parent not in self._bom_map:
                self._bom_map[parent] = []
            self._bom_map[parent].append({
                "child": b.get("child_product", ""),
                "quantity": b.get("quantity", 1),
            })

        self.factory = Factory(
            id=f"sim_{self.state.simulation_id[:8]}",
            name="Simulation Factory", description="Built from network data")

        # 製品登録
        for p in products:
            self.factory.add_product(Product(
                id=p.get("id", f"P{len(self.factory.products)}"),
                name=p.get("name", "?"), type=p.get("type", "component"),
                processing_time=p.get("processing_time", 60)))

        # ノードデータを先に保存（バッファ容量等の参照用）
        self._node_data: Dict[str, Dict] = {}
        for node in nodes:
            self._node_data[node["id"]] = node.get("data", {})

        process_types = {"machining", "assembly", "inspection", "kitting", "shipping", "process"}

        for node in nodes:
            nid = node["id"]
            ntype = node.get("type", "")
            d = node.get("data", {})
            # data.typeがあればそちらを優先（ReactFlowの正規化対応）
            effective_type = d.get("type", ntype)

            if ntype in process_types or effective_type in process_types:
                ct = d.get("cycleTime", 60)
                ptimes = {f"PRODUCT_{nid}": ct}
                for pid in self.factory.products:
                    ptimes[pid] = ct

                proc = Process(id=nid, name=d.get("label", nid),
                               type=effective_type, processing_time=ptimes)
                for i in range(d.get("equipmentCount", 1)):
                    proc.add_equipment(ProcessEquipment(
                        id=f"{nid}_EQ_{i+1}",
                        name=f"{d.get('label','')} EQ{i+1}",
                        process_id=nid, capacity=1,
                        setup_time=d.get("setupTime", 0)))
                self.factory.add_process(proc)

            elif ntype in ("store", "storage", "buffer") or effective_type in ("store", "storage", "buffer"):
                self.factory.add_buffer(Buffer(
                    id=nid, name=d.get("label", nid),
                    capacity=d.get("capacity", 5000),
                    location_type="intermediate", buffer_type="buffer"))

        # 入出力バッファ自動生成（inputMaterials/outputProductsのバッファ設定を優先）
        for proc in self.factory.processes.values():
            nd = self._node_data.get(proc.id, {})

            # 入力バッファ容量: inputMaterialsのmaxLots×batchSizeの合計、またはinputBufferCapacity
            in_cap = nd.get("inputBufferCapacity")
            input_materials = nd.get("inputMaterials", [])
            if input_materials:
                total_max = 0
                for im in input_materials:
                    bs = im.get("bufferSettings", {})
                    max_lots = bs.get("maxLots", 5)
                    batch = im.get("batchSize", 1)
                    total_max += max_lots * batch
                if total_max > 0:
                    in_cap = total_max

            # 出力バッファ容量: outputProductsのmaxLotsから
            out_cap = nd.get("outputBufferCapacity")
            output_products = nd.get("outputProducts", [])
            if output_products:
                op = output_products[0]
                obs = op.get("bufferSettings", {})
                max_lots = obs.get("maxLots", 3)
                out_cap = out_cap or max_lots * op.get("outputQuantity", 1) * 5

            bid_in = f"BUF_IN_{proc.id}"
            if bid_in not in self.factory.buffers:
                self.factory.add_buffer(Buffer(
                    id=bid_in, name=f"{proc.name} 入力",
                    capacity=in_cap, location_type="process_input", buffer_type="input"))
            elif in_cap:
                self.factory.buffers[bid_in].capacity = in_cap

            bid_out = f"BUF_OUT_{proc.id}"
            if bid_out not in self.factory.buffers:
                self.factory.add_buffer(Buffer(
                    id=bid_out, name=f"{proc.name} 出力",
                    capacity=out_cap, location_type="process_output", buffer_type="output"))
            elif out_cap:
                self.factory.buffers[bid_out].capacity = out_cap

            proc.input_buffer_id = bid_in
            proc.output_buffer_id = bid_out

        # 接続（transportMethodsがあればそちらを優先）
        self._connections = []
        for e in edges:
            ed = e.get("data", {})
            methods = ed.get("transportMethods", [])
            # アクティブな搬送方式の最初のものを使用
            active_method = None
            for m in methods:
                if m.get("isActive", True):
                    active_method = m
                    break

            if active_method:
                t_time = active_method.get("transportTime", ed.get("transportTime", 10))
                t_type = active_method.get("type", ed.get("transportType", "conveyor"))
                t_cost = active_method.get("transportCost", 0)
                t_capacity = active_method.get("transportCapacity", ed.get("transportLotSize", 1))
                t_max_capacity = active_method.get("maxCapacity", 999)
                # 製品別ロットサイズ
                t_products = active_method.get("transportProducts", [])
                product_lots: Dict[str, int] = {}
                for tp in t_products:
                    product_lots[tp.get("productId", "")] = tp.get("lotSize", t_capacity)
                t_lot = t_products[0].get("lotSize", t_capacity) if t_products else t_capacity
            else:
                t_time = ed.get("transportTime", 10)
                t_type = ed.get("transportType", "conveyor")
                t_cost = 0
                t_lot = ed.get("transportLotSize", 1)
                t_capacity = t_lot
                t_max_capacity = 999
                product_lots = {}

            self._connections.append({
                "id": e.get("id", ""),
                "source": e.get("source"),
                "target": e.get("target"),
                "transport_time": t_time,
                "transport_lot_size": t_lot,
                "transport_type": t_type,
                "transport_cost": t_cost,
                "transport_capacity": t_capacity,   # 1回の搬送キャパシティ
                "max_capacity": t_max_capacity,      # 搬送手段の最大能力
                "product_lot_sizes": product_lots,   # 製品別ロットサイズ
                "distance": ed.get("distance", 10),
            })

        # ストアノードのID一覧（バッファとして登録されたノード）
        store_node_ids = set()
        for node in nodes:
            if node.get("type") in ("store", "storage", "buffer"):
                store_node_ids.add(node["id"])

        # 工程間の接続だけで開始/終了を判定（ストアからの接続は除外）
        proc_targets = {c["target"] for c in self._connections
                        if c["source"] not in store_node_ids}
        proc_sources = {c["source"] for c in self._connections
                        if c["target"] not in store_node_ids}
        self._start_processes = [p for p in self.factory.processes if p not in proc_targets]
        self._end_processes = [p for p in self.factory.processes if p not in proc_sources]

        # ストア種別ごとの初期在庫設定
        self._store_feeds: List[Dict] = []
        self._component_stores: set = set()   # 部品ストア
        self._finished_stores: set = set()    # 完成品ストア

        for nid in store_node_ids:
            nd = self._node_data.get(nid, {})
            store_type = nd.get("storeType", "component")
            buf = self.factory.buffers.get(nid)

            if store_type == "finished_product":
                # 完成品ストア: 初期在庫は0（生産で溜まる）
                self._finished_stores.add(nid)
                # capacityをバッファに設定
                if buf and nd.get("capacity"):
                    buf.capacity = nd["capacity"]
            else:
                # 部品ストア: inventoryLevelsの設定値、またはcapacityの80%を初期在庫
                self._component_stores.add(nid)
                if buf:
                    inv_levels = nd.get("inventoryLevels", [])
                    if inv_levels:
                        # inventoryLevelsから初期在庫を設定
                        total_init = sum(il.get("currentStock", 0) for il in inv_levels)
                        if total_init > 0:
                            buf.add_lot("STORED_MATERIAL", f"STORE_{nid}", total_init, "initial")
                        else:
                            # currentStockが0なら容量の80%
                            buf.add_lot("STORED_MATERIAL", f"STORE_{nid}",
                                        int(nd.get("capacity", 5000) * 0.8), "initial")
                    else:
                        buf.add_lot("STORED_MATERIAL", f"STORE_{nid}",
                                    int(nd.get("capacity", 5000) * 0.8), "initial")

        # 部品ストア→工程の接続（初期材料投入）
        for c in self._connections:
            if c["source"] in self._component_stores and c["target"] in self.factory.processes:
                self._store_feeds.append(c)
                tgt_buf = self.factory.buffers.get(f"BUF_IN_{c['target']}")
                if tgt_buf:
                    # inputMaterialsのinitialStockを合計して初期在庫に
                    tgt_nd = self._node_data.get(c["target"], {})
                    init_qty = 0
                    for im in tgt_nd.get("inputMaterials", []):
                        bs = im.get("bufferSettings", {})
                        init_qty += bs.get("initialStock", 0)
                    if init_qty == 0:
                        init_qty = (tgt_buf.capacity // 3) if tgt_buf.capacity else 30
                    tgt_buf.add_lot("RAW_MATERIAL", f"INIT_{c['target']}", init_qty, c["source"])

        # ストアから接続されていない開始工程にも初期材料投入
        for pid in self._start_processes:
            buf = self.factory.buffers.get(f"BUF_IN_{pid}")
            if buf and buf.get_total_quantity() == 0:
                init_qty = (buf.capacity // 2) if buf.capacity else 100
                buf.add_lot("RAW_MATERIAL", f"INIT_{pid}", init_qty, "supplier")

        logger.info(f"Factory: {len(self.factory.processes)}proc, "
                     f"{len(self.factory.buffers)}buf, {len(self._connections)}conn")

    # ================================================================
    # 初期化
    # ================================================================
    def _init_states(self):
        self._equipment_states.clear()
        self._active_transports.clear()
        self._transport_stats.clear()
        self._time_series.clear()
        self._last_ts_time = 0.0

        self._stats = {
            "total_production": 0, "total_defects": 0,
            "process_production": {}, "process_defects": {},
            "process_waiting_time": {}, "process_busy_time": {},
        }

        for proc in self.factory.processes.values():
            self._stats["process_production"][proc.id] = 0
            self._stats["process_defects"][proc.id] = 0
            self._stats["process_waiting_time"][proc.id] = 0.0
            self._stats["process_busy_time"][proc.id] = 0.0

            for eq_id in proc.equipments:
                self._equipment_states[eq_id] = {
                    "status": "idle", "remaining": 0.0,
                    "product_id": None, "process_id": proc.id,
                    "busy_time": 0.0, "idle_time": 0.0,
                }

        for c in self._connections:
            self._transport_stats[c["id"]] = {
                "trips": 0, "items_moved": 0,
                "source": c["source"], "target": c["target"],
                "transport_type": c["transport_type"],
                "busy_time": 0.0,
            }

    # ================================================================
    # シミュレーション制御
    # ================================================================
    async def start_simulation(self, duration: float = 3600.0) -> bool:
        try:
            if self.state.status == "running":
                return False
            self.state.status = "running"
            self.state.start_timestamp = datetime.now()
            self.state.target_duration = duration
            self.state.progress = 0.0
            self.state.current_time = 0.0
            self.state.error_message = None

            if not hasattr(self, "_connections"):
                self._connections = []
                self._start_processes = list(self.factory.processes.keys())
                self._end_processes = []

            self._init_states()
            await self.event_manager.start_processing()
            await self._emit("simulation_started", {
                "simulation_id": self.state.simulation_id, "duration": duration})

            self.simulation_task = asyncio.create_task(self._run_loop(duration))
            return True
        except Exception as e:
            self.state.status = "error"
            self.state.error_message = str(e)
            logger.error(f"Start error: {e}", exc_info=True)
            return False

    async def pause_simulation(self) -> bool:
        if self.state.status == "running":
            self.state.status = "paused"
            await self._emit("simulation_paused")
            return True
        return False

    async def resume_simulation(self) -> bool:
        if self.state.status == "paused":
            self.state.status = "running"
            await self._emit("simulation_resumed")
            return True
        return False

    async def stop_simulation(self) -> bool:
        if self.state.status in ("running", "paused"):
            self.state.status = "completed"
            self.state.end_timestamp = datetime.now()
            self.state.progress = 100.0
            await self._broadcast_state()
            await self._emit("simulation_completed", {
                "total_production": self._stats["total_production"]})
            await self._cleanup()
            return True
        return False

    def set_speed(self, factor: float):
        self.speed_factor = max(1.0, min(factor, 10000.0))

    async def _cleanup(self):
        await self.event_manager.stop_processing()
        if self.simulation_task and not self.simulation_task.done():
            self.simulation_task.cancel()

    # ================================================================
    # メインループ
    # ================================================================
    async def _run_loop(self, duration: float):
        try:
            dt = self.time_step
            while self.state.status == "running" and self.state.current_time < duration:
                while self.state.status == "paused":
                    await asyncio.sleep(0.05)
                    if self.state.status != "paused":
                        break
                if self.state.status != "running":
                    break

                await self._step(dt)
                self.state.current_time += dt
                self.state.progress = min(self.state.current_time / duration * 100, 100)

                # 時系列記録
                if self.state.current_time - self._last_ts_time >= self._ts_interval:
                    self._record_time_series()
                    self._last_ts_time = self.state.current_time

                # ブロードキャスト（5ステップごと）
                step = int(self.state.current_time / dt)
                if step % 5 == 0:
                    await self._broadcast_state()

                await asyncio.sleep(dt / self.speed_factor)

            if self.state.status == "running":
                self.state.status = "completed"
                self.state.progress = 100.0
                self.state.end_timestamp = datetime.now()
                self._record_time_series()
                await self._broadcast_state()
                await self._emit("simulation_completed", {
                    "total_production": self._stats["total_production"]})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.state.status = "error"
            self.state.error_message = str(e)
            logger.error(f"Loop error: {e}", exc_info=True)
        finally:
            await self._cleanup()

    # ================================================================
    # 1ステップ
    # ================================================================
    async def _step(self, dt: float):
        # 0) ブロック解除チェック（出力バッファに空きができたら完了処理を再試行）
        for eq_id, es in list(self._equipment_states.items()):
            if es["status"] == "blocked":
                await self._complete_process(es["process_id"], eq_id, es["product_id"])
                if es["status"] == "blocked":
                    es["idle_time"] += dt  # まだブロック中

        # 1) 設備処理進行
        for eq_id, es in self._equipment_states.items():
            if es["status"] == "running":
                es["remaining"] -= dt
                es["busy_time"] += dt
                self._stats["process_busy_time"][es["process_id"]] = (
                    self._stats["process_busy_time"].get(es["process_id"], 0) + dt)
                if es["remaining"] <= 0:
                    await self._complete_process(es["process_id"], eq_id, es["product_id"])
            elif es["status"] == "idle":
                es["idle_time"] += dt

        # 2) 材料待ち集計 & ジョブ投入
        for proc in self.factory.processes.values():
            in_buf = self.factory.buffers.get(proc.input_buffer_id)
            if in_buf and in_buf.get_total_quantity() <= 0:
                self._stats["process_waiting_time"][proc.id] = (
                    self._stats["process_waiting_time"].get(proc.id, 0) + dt)
            await self._try_start(proc)

        # 3) 搬送到着チェック（入力バッファ容量制限付き）
        arrived = [t for t in self._active_transports if self.state.current_time >= t.arrive_time]
        for t in arrived:
            tgt_buf = self.factory.buffers.get(f"BUF_IN_{t.target}")
            if not tgt_buf:
                tgt_buf = self.factory.buffers.get(t.target)
            if tgt_buf:
                # 入力バッファ容量チェック
                if tgt_buf.capacity and tgt_buf.get_total_quantity() + t.quantity > tgt_buf.capacity:
                    continue  # 満杯→搬送中のまま保留
                lot_id = f"TR_{int(self.state.current_time)}_{random.randint(100,999)}"
                tgt_buf.add_lot(t.product_id, lot_id, t.quantity, t.source)
            self._active_transports.remove(t)  # 受入成功した場合のみ削除

        # 4) ストアからの自動材料補充
        await self._replenish_from_stores()

        # 5) 搬送発送
        await self._dispatch_transports()

    async def _try_start(self, proc: Process):
        in_buf = self.factory.buffers.get(proc.input_buffer_id)
        if not in_buf or in_buf.get_total_quantity() <= 0:
            return

        nd = getattr(self, '_node_data', {}).get(proc.id, {})
        output_products_cfg = nd.get("outputProducts", [])
        output_ids = nd.get("outputs", [])
        input_materials_cfg = nd.get("inputMaterials", [])

        # ── BOM必要材料チェック（batchSizeは搬送ロットに使用、加工開始条件はBOMのみ） ──
        bom_to_consume: List[Dict] = []
        if output_ids and getattr(self, '_bom_map', {}):
            for out_pid in output_ids:
                for child in self._bom_map.get(out_pid, []):
                    # バッファ内の全製品IDの合計在庫で判定
                    avail = in_buf.get_total_quantity()
                    if avail < child["quantity"]:
                        return  # 材料不足
                    bom_to_consume.append({"pid": child["child"], "qty": child["quantity"]})

        # ── outputQuantity と cycleTime を材料設定から取得 ──
        out_qty = 1
        out_ct = None
        if output_products_cfg:
            op = output_products_cfg[0]
            out_qty = op.get("outputQuantity", 1)
            out_ct = op.get("cycleTime")

        out_pid = output_ids[0] if output_ids else f"PRODUCT_{proc.id}"

        for eq_id in proc.equipments:
            es = self._equipment_states.get(eq_id)
            if not es or es["status"] != "idle":
                continue

            # 材料消費（BOM子部品ID → RAW_MATERIAL → STORED_MATERIAL → 任意のキーの順で試行）
            if bom_to_consume:
                ok = True
                for item in bom_to_consume:
                    removed = in_buf.remove_lot(item["pid"], item["qty"], proc.id)
                    if not removed:
                        # 汎用キーで順次試行
                        for fallback_key in ["RAW_MATERIAL", "STORED_MATERIAL"] + list(in_buf.inventory.keys()):
                            removed = in_buf.remove_lot(fallback_key, item["qty"], proc.id)
                            if removed:
                                break
                    if not removed:
                        ok = False; break
                if not ok:
                    return
            else:
                pids = list(in_buf.inventory.keys())
                if not pids: break
                removed = in_buf.remove_lot(pids[0], 1, proc.id)
                if not removed: continue

            # CT決定: outputProducts[].cycleTime > process.processing_time > 60
            ct = out_ct or proc.processing_time.get(out_pid,
                  list(proc.processing_time.values())[0] if proc.processing_time else 60)

            # 段取り時間: 品種切替時のみ
            setup = 0
            if es.get("last_product_id") is not None and es["last_product_id"] != out_pid:
                for eq in proc.equipments.values():
                    if eq.id == eq_id:
                        setup = eq.setup_time or 0; break

            es["status"] = "running"
            es["remaining"] = ct + setup
            es["product_id"] = out_pid
            es["last_product_id"] = out_pid
            es["_out_qty"] = out_qty  # 完了時にこの数量を出力
            break

    async def _complete_process(self, proc_id: str, eq_id: str, product_id: str):
        proc = self.factory.processes.get(proc_id)
        if not proc:
            return
        es = self._equipment_states[eq_id]

        # 出力バッファの容量チェック（満杯ならブロック）
        out_buf = self.factory.buffers.get(proc.output_buffer_id)
        if out_buf and out_buf.capacity and out_buf.get_total_quantity() >= out_buf.capacity:
            # ブロック: 出力バッファ満杯 → 設備は完成品を持ったまま待機
            es["status"] = "blocked"
            es["remaining"] = 0  # 加工は終わっているが出せない
            if "blocked_time" not in self._stats:
                self._stats["blocked_time"] = {}
            return  # 次のステップで再チェック

        es["status"] = "idle"
        es["remaining"] = 0
        es["product_id"] = None

        # 不良判定
        nd = getattr(self, '_node_data', {}).get(proc_id, {})
        defect_rate = 0.0
        if 'qualitySettings' in nd:
            defect_rate = nd['qualitySettings'].get('defectRate', 0) / 100
        elif 'defectRate' in nd:
            defect_rate = nd.get('defectRate', 0) / 100

        is_defect = random.random() < defect_rate

        # 出力数量を取得（_try_startで設定）
        out_qty = es.get("_out_qty", 1)

        if is_defect:
            self._stats["total_defects"] += out_qty
            self._stats["process_defects"][proc_id] = (
                self._stats["process_defects"].get(proc_id, 0) + out_qty)
        else:
            if out_buf:
                nd_out = getattr(self, '_node_data', {}).get(proc_id, {})
                outputs = nd_out.get("outputs", [])
                out_pid = outputs[0] if outputs else f"PRODUCT_{proc_id}"
                lot = f"L{int(self.state.current_time)}_{random.randint(100,999)}"
                out_buf.add_lot(out_pid, lot, out_qty, proc_id)

        self._stats["total_production"] += out_qty
        self._stats["process_production"][proc_id] = (
            self._stats["process_production"].get(proc_id, 0) + out_qty)

    async def _replenish_from_stores(self):
        """部品ストアからの補充（搬送がない直接接続のみ）
        搬送接続がある場合は_dispatch_transportsが担当するので補充しない"""
        # 搬送で処理される接続をスキップ
        transport_pairs = set()
        for c in self._connections:
            transport_pairs.add((c["source"], c["target"]))

        for feed in getattr(self, "_store_feeds", []):
            if feed["source"] in getattr(self, '_finished_stores', set()):
                continue
            # 搬送接続がある場合はスキップ（搬送に任せる）
            if (feed["source"], feed["target"]) in transport_pairs:
                continue

            tgt_buf = self.factory.buffers.get(f"BUF_IN_{feed['target']}")
            if not tgt_buf:
                continue

            current_qty = tgt_buf.get_total_quantity()

            # inputMaterialsからsafetyStockとkanban設定を取得
            tgt_nd = getattr(self, '_node_data', {}).get(feed["target"], {})
            input_mats = tgt_nd.get("inputMaterials", [])

            threshold = 0
            replenish_amount = 0

            if input_mats:
                total_safety = sum(im.get("bufferSettings", {}).get("safetyStock", 0) for im in input_mats)
                total_max = sum(im.get("bufferSettings", {}).get("maxLots", 5) * im.get("batchSize", 1) for im in input_mats)

                # kanban設定があればreorderPointを使用
                for im in input_mats:
                    ks = im.get("kanbanSettings")
                    if ks and ks.get("enabled"):
                        threshold = max(threshold, ks.get("reorderPoint", total_safety))
                        replenish_amount = max(replenish_amount, ks.get("maxInventory", total_max) - current_qty)

                if threshold == 0:
                    threshold = total_safety if total_safety > 0 else (tgt_buf.capacity // 3 if tgt_buf.capacity else 20)
                if replenish_amount == 0:
                    replenish_amount = (tgt_buf.capacity - current_qty) if tgt_buf.capacity else threshold
            else:
                threshold = tgt_buf.capacity // 3 if tgt_buf.capacity else 20
                replenish_amount = threshold

            if current_qty <= threshold and replenish_amount > 0:
                store_buf = self.factory.buffers.get(feed["source"])
                if store_buf and store_buf.get_total_quantity() > 0:
                    # バッファ容量の空きを確認してから補充
                    space = (tgt_buf.capacity - current_qty) if tgt_buf.capacity else replenish_amount
                    actual_qty = min(replenish_amount, store_buf.get_total_quantity(), max(space, 0))
                    if actual_qty <= 0:
                        continue
                    # 先にadd_lotで受入可能か確認
                    lot_id = f"REPL_{int(self.state.current_time)}_{random.randint(100,999)}"
                    added = tgt_buf.add_lot("RAW_MATERIAL", lot_id, actual_qty, feed["source"])
                    if added:
                        # 成功した場合のみストアから消費
                        for pid_key in list(store_buf.inventory.keys()):
                            avail = sum(l["quantity"] for l in store_buf.inventory.get(pid_key, []))
                            store_buf.remove_lot(pid_key, min(actual_qty, avail), feed["target"])
                            break

    async def _dispatch_transports(self):
        # 分岐フロー対応: 同じ出力バッファから複数の下流がある場合、
        # ラウンドロビンカウンタで交互に送る
        if not hasattr(self, '_rr_counter'):
            self._rr_counter: Dict[str, int] = {}

        # 出力バッファ → 接続リストのマップを構築
        src_conns: Dict[str, List[Dict]] = {}
        for c in self._connections:
            src_key = f"BUF_OUT_{c['source']}"
            if src_key not in src_conns:
                src_conns[src_key] = []
            src_conns[src_key].append(c)

        for src_key, conns in src_conns.items():
            src_buf = self.factory.buffers.get(src_key)
            if not src_buf:
                # ストアバッファの場合
                alt_key = conns[0]["source"] if conns else None
                if alt_key:
                    src_buf = self.factory.buffers.get(alt_key)
            if not src_buf or src_buf.get_total_quantity() <= 0:
                continue

            if len(conns) > 1:
                # 分岐: ラウンドロビンで順番に送る
                rr = self._rr_counter.get(src_key, 0)
                c = conns[rr % len(conns)]
                self._rr_counter[src_key] = rr + 1
            else:
                c = conns[0]

            is_divergent = len(conns) > 1
            product_lots = c.get("product_lot_sizes", {})
            capacity = c.get("transport_capacity", c["transport_lot_size"])

            # この接続で現在搬送中の件数チェック
            active_count = sum(1 for t in self._active_transports if t.conn_id == c["id"])
            max_cap = c.get("max_capacity", 999)
            if active_count >= max_cap:
                continue

            # kanbanカード制限: 下流のinputMaterialsにkanban設定があれば枚数制限
            tgt_nd = getattr(self, '_node_data', {}).get(c["target"], {})
            tgt_input_mats = tgt_nd.get("inputMaterials", [])
            kanban_limit = None
            scheduling = "push"
            for im in tgt_input_mats:
                scheduling = im.get("schedulingMode", "push")
                ks = im.get("kanbanSettings")
                if ks and ks.get("enabled"):
                    kanban_limit = ks.get("cardCount", 5)
                    break

            # kanban制限: 搬送中件数がカード枚数以上なら搬送しない
            if kanban_limit is not None and active_count >= kanban_limit:
                continue

            # 搬送先バッファの空き容量チェック（ストアノードの場合はストア自体を参照）
            tgt_in_buf = self.factory.buffers.get(f"BUF_IN_{c['target']}")
            if not tgt_in_buf:
                tgt_in_buf = self.factory.buffers.get(c["target"])
            if tgt_in_buf and tgt_in_buf.capacity:
                in_transit_qty = sum(t.quantity for t in self._active_transports
                                    if t.target == c["target"])
                if tgt_in_buf.get_total_quantity() + in_transit_qty >= tgt_in_buf.capacity:
                    continue  # INバッファ＋搬送中で満杯→搬送不要

            # pull型: 下流のINバッファがsafetyStock×2以下の場合のみ搬送
            if scheduling == "pull" and tgt_in_buf:
                safety = sum(im.get("bufferSettings", {}).get("safetyStock", 0) for im in tgt_input_mats)
                if tgt_in_buf.get_total_quantity() > max(safety * 2, 5):
                    continue

            for pid in list(src_buf.inventory.keys()):
                qty = sum(l["quantity"] for l in src_buf.inventory.get(pid, []))
                # 製品別ロットサイズを取得（なければ接続のデフォルト）
                lot_size = product_lots.get(pid, c["transport_lot_size"])
                # キャパシティ制限: ロットサイズがキャパ超えなら切り詰め
                lot_size = min(lot_size, capacity)

                if is_divergent:
                    actual_lot = min(lot_size, qty) if qty > 0 else 0
                else:
                    if qty >= lot_size:
                        actual_lot = lot_size
                    else:
                        actual_lot = 0
                if actual_lot <= 0:
                    continue
                removed = src_buf.remove_lot(pid, actual_lot, c["target"])
                if removed:
                    job = TransportJob(
                        conn_id=c["id"], source=c["source"], target=c["target"],
                        product_id=pid, quantity=actual_lot,
                        start_time=self.state.current_time,
                        arrive_time=self.state.current_time + c["transport_time"],
                        transport_type=c["transport_type"])
                    self._active_transports.append(job)

                    ts = self._transport_stats.get(c["id"], {})
                    ts["trips"] = ts.get("trips", 0) + 1
                    ts["items_moved"] = ts.get("items_moved", 0) + actual_lot
                    ts["busy_time"] = ts.get("busy_time", 0) + c["transport_time"]
                break

    # ================================================================
    # 時系列記録
    # ================================================================
    def _record_time_series(self):
        t = self.state.current_time
        # バッファ在庫
        for bid, buf in self.factory.buffers.items():
            self._time_series[f"buf_{bid}"].append((t, buf.get_total_quantity()))
        # 工程稼働率（瞬間値）
        for proc in self.factory.processes.values():
            running = sum(1 for eid in proc.equipments
                          if self._equipment_states.get(eid, {}).get("status") == "running")
            total = len(proc.equipments)
            util = (running / total * 100) if total > 0 else 0
            self._time_series[f"util_{proc.id}"].append((t, util))
        # WIP合計
        total_wip = sum(b.get_total_quantity() for b in self.factory.buffers.values()
                        if b.buffer_type != "buffer")
        self._time_series["total_wip"].append((t, total_wip))
        # 搬送中件数
        self._time_series["active_transports"].append((t, len(self._active_transports)))
        # 工程ステータス（0=idle, 1=running, 2=blocked）
        for proc in self.factory.processes.values():
            states = []
            for eid in proc.equipments:
                es = self._equipment_states.get(eid, {})
                s = es.get("status", "idle")
                states.append(2 if s == "blocked" else 1 if s == "running" else 0)
            avg_state = sum(states) / len(states) if states else 0
            self._time_series[f"status_{proc.id}"].append((t, avg_state))
        # 工程別生産累計
        for proc in self.factory.processes.values():
            self._time_series[f"prod_{proc.id}"].append(
                (t, self._stats["process_production"].get(proc.id, 0)))

    # ================================================================
    # ブロードキャスト
    # ================================================================
    async def _broadcast_state(self):
        await self._emit("state_update", {
            "simulation_time": self.state.current_time,
            "current_time": self.state.current_time,
            "elapsed_time": self.state.current_time,
            "progress": self.state.progress,
            "inventories": self._collect_inventories(),
            "equipment_states": self._collect_equipment(),
            "transport_states": self._collect_transports(),
            "kpis": self._collect_kpis(),
        })

    def _collect_inventories(self) -> Dict:
        r = {}
        for bid, buf in self.factory.buffers.items():
            r[bid] = {
                "name": buf.name,
                "total": buf.get_total_quantity(),
                "capacity": buf.capacity,
                "products": buf.get_inventory_levels(),
            }
        return r

    def _collect_equipment(self) -> Dict:
        r = {}
        for proc in self.factory.processes.values():
            eqs = {}
            for eid in proc.equipments:
                es = self._equipment_states.get(eid, {})
                bt = es.get("busy_time", 0)
                it = es.get("idle_time", 0)
                total = bt + it
                eqs[eid] = {
                    "status": es.get("status", "idle"),
                    "utilization": round(bt / total * 100, 1) if total > 0 else 0,
                }
            # CTを取得
            ct = list(proc.processing_time.values())[0] if proc.processing_time else 0
            r[proc.id] = {
                "name": proc.name,
                "type": proc.type,
                "cycle_time": ct,
                "equipment_count": len(proc.equipments),
                "equipments": eqs,
                "production": self._stats["process_production"].get(proc.id, 0),
                "defects": self._stats["process_defects"].get(proc.id, 0),
                "waiting_time": round(self._stats["process_waiting_time"].get(proc.id, 0), 1),
            }
        return r

    def _collect_transports(self) -> Dict:
        active = []
        for t in self._active_transports:
            elapsed = self.state.current_time - t.start_time
            duration = t.arrive_time - t.start_time
            progress = min(elapsed / duration, 1.0) if duration > 0 else 1.0
            active.append({
                "id": t.id, "conn_id": t.conn_id,
                "source": t.source, "target": t.target,
                "product_id": t.product_id, "quantity": t.quantity,
                "progress": round(progress, 2),
                "transport_type": t.transport_type,
            })
        stats = {}
        for cid, s in self._transport_stats.items():
            stats[cid] = {
                "source": s.get("source", ""),
                "target": s.get("target", ""),
                "transport_type": s.get("transport_type", ""),
                "trips": s.get("trips", 0),
                "items_moved": s.get("items_moved", 0),
            }
        return {"active": active, "stats": stats}

    def _collect_kpis(self) -> Dict:
        tp_all = self._stats["total_production"]  # 全工程合計
        td = self._stats["total_defects"]

        # 完成品数 = 終了工程の生産数合計（もしくはストアバッファの在庫）
        finished_count = 0
        for pid in self._end_processes:
            finished_count += self._stats["process_production"].get(pid, 0)
        # ストアバッファからもカウント
        for bid, buf in self.factory.buffers.items():
            if buf.buffer_type == "buffer" and "finish" in bid.lower():
                finished_count = max(finished_count, buf.get_total_quantity())

        total_busy = sum(es.get("busy_time", 0) for es in self._equipment_states.values())
        total_all = sum(es.get("busy_time", 0) + es.get("idle_time", 0)
                        for es in self._equipment_states.values())
        util = round(total_busy / total_all * 100, 1) if total_all > 0 else 0
        hours = self.state.current_time / 3600 if self.state.current_time > 0 else 1
        quality = round((1 - td / tp_all) * 100, 1) if tp_all > 0 else 100.0

        # ボトルネック特定（工程別稼働率で判定）
        bottleneck = ""
        max_util = 0
        for proc in self.factory.processes.values():
            if not proc.equipments:
                continue
            eq_utils = []
            for eid in proc.equipments:
                es = self._equipment_states.get(eid, {})
                bt = es.get("busy_time", 0)
                it = es.get("idle_time", 0)
                total = bt + it
                eq_utils.append(bt / total * 100 if total > 0 else 0)
            avg_util = sum(eq_utils) / len(eq_utils) if eq_utils else 0
            if avg_util > max_util:
                max_util = avg_util
                bottleneck = proc.name

        return {
            "equipment_utilization": util,
            "total_production": finished_count,
            "total_process_outputs": tp_all,
            "total_defects": td,
            "throughput": round(finished_count / hours, 1),
            "quality_rate": quality,
            "average_lead_time": round(self.state.current_time / finished_count, 1) if finished_count > 0 else 0,
            "bottleneck": bottleneck,
            "bottleneck_utilization": round(max_util, 1),
            "active_transports": len(self._active_transports),
        }

    # ================================================================
    # 結果取得API
    # ================================================================
    def get_results(self) -> Dict[str, Any]:
        """シミュレーション完了後の全結果を取得"""
        kpis = self._collect_kpis()
        # 工程別詳細
        process_details = []
        for proc in self.factory.processes.values():
            bt = self._stats["process_busy_time"].get(proc.id, 0)
            eq_count = len(proc.equipments)
            total_eq_time = sum(
                self._equipment_states.get(eid, {}).get("busy_time", 0) +
                self._equipment_states.get(eid, {}).get("idle_time", 0)
                for eid in proc.equipments)
            util = round(bt / total_eq_time * 100, 1) if total_eq_time > 0 else 0
            ct = list(proc.processing_time.values())[0] if proc.processing_time else 0
            process_details.append({
                "id": proc.id,
                "name": proc.name,
                "type": proc.type,
                "cycle_time": ct,
                "equipment_count": eq_count,
                "production": self._stats["process_production"].get(proc.id, 0),
                "defects": self._stats["process_defects"].get(proc.id, 0),
                "utilization": util,
                "waiting_time": round(self._stats["process_waiting_time"].get(proc.id, 0), 1),
            })

        # 搬送詳細
        transport_details = []
        for cid, s in self._transport_stats.items():
            transport_details.append({
                "id": cid, **s,
            })

        # バッファ最終状態
        buffer_states = {}
        for bid, buf in self.factory.buffers.items():
            buffer_states[bid] = {
                "name": buf.name,
                "total": buf.get_total_quantity(),
                "capacity": buf.capacity,
            }

        # 時系列（間引き: 最大200点）
        ts_out = {}
        for key, series in self._time_series.items():
            if len(series) > 200:
                step = len(series) // 200
                ts_out[key] = series[::step]
            else:
                ts_out[key] = series

        return {
            "simulation_id": self.state.simulation_id,
            "duration": self.state.current_time,
            "kpis": kpis,
            "process_details": process_details,
            "transport_details": transport_details,
            "buffer_states": buffer_states,
            "time_series": ts_out,
        }

    def get_simulation_state(self) -> Dict[str, Any]:
        return {"state": self.state.to_dict(), "factory_id": self.factory.id}

    def get_real_time_data(self) -> Dict[str, Any]:
        return {
            "timestamp": datetime.now().isoformat(),
            "inventories": self._collect_inventories(),
            "equipment_states": self._collect_equipment(),
            "transport_states": self._collect_transports(),
            "kpis": self._collect_kpis(),
        }

    async def _emit(self, event_type: str, data: Dict[str, Any] = None):
        await self.event_manager.emit_event(SimulationEvent(
            timestamp=datetime.now(), event_type=event_type, data=data or {}))

    async def update_factory_configuration(self, new_factory: Factory):
        was_running = self.state.status == "running"
        if was_running:
            await self.pause_simulation()
        self.factory = new_factory
        self._init_states()
        if was_running:
            await self.resume_simulation()
        return True
