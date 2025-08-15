"""
フェーズ2シミュレーション機能テスト用API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import asyncio
import uuid
import random

from app.models.factory import Factory
from app.models.product import Product
from app.models.process import Process, Equipment
from app.models.buffer import Buffer
from app.core.event_manager import EventManager
from app.core.resource_manager import ResourceManager
from app.core.material_flow_manager import MaterialFlowManager
from app.core.quality_manager import QualityManager, InspectionType
from app.core.scheduler import ProductionScheduler

router = APIRouter()

class TestSimulationRequest(BaseModel):
    """テストシミュレーション要求"""
    test_type: str  # "material", "quality", "scheduling", "all"
    duration_minutes: int = 5
    
class TestResults(BaseModel):
    """テスト結果"""
    test_type: str
    status: str
    results: Dict[str, Any]
    events: List[Dict[str, Any]]
    timestamp: str

# テスト用のグローバル変数
test_factory: Optional[Factory] = None
test_systems: Dict[str, Any] = {}

def create_test_factory() -> Factory:
    """テスト用の工場を作成"""
    factory = Factory(
        id="test_factory",
        name="フェーズ2テスト工場",
        description="フェーズ2機能テスト用工場"
    )
    
    # 簡単な製品を作成
    product_a = Product(
        id="TEST_PRODUCT_A",
        name="テスト製品A",
        type="component",
        processing_time=30.0
    )
    
    product_b = Product(
        id="TEST_PRODUCT_B", 
        name="テスト製品B",
        type="finished_product",
        processing_time=60.0
    )
    
    factory.add_product(product_a)
    factory.add_product(product_b)
    
    # 工程を作成
    equipment1 = Equipment(
        id="eq1",
        name="テスト設備1", 
        process_id="test_process_1",
        capacity=1
    )
    
    process1 = Process(
        id="test_process_1",
        name="テスト工程1",
        type="machining"
    )
    process1.add_equipment(equipment1)
    process1.processing_time["TEST_PRODUCT_A"] = 30.0
    process1.processing_time["TEST_PRODUCT_B"] = 60.0
    
    factory.add_process(process1)
    
    # バッファを作成
    buffer1 = Buffer(
        id="test_buffer_1",
        name="テストバッファ1",
        capacity=100
    )
    
    factory.add_buffer(buffer1)
    
    return factory

async def initialize_test_systems():
    """テストシステムを初期化"""
    global test_factory, test_systems
    
    test_factory = create_test_factory()
    
    # 基盤システム
    event_manager = EventManager()
    resource_manager = ResourceManager()
    
    # フェーズ2システム
    test_systems = {
        "event_manager": event_manager,
        "resource_manager": resource_manager,
        "material_flow": MaterialFlowManager(test_factory, event_manager),
        "quality_manager": QualityManager(event_manager),
        "scheduler": ProductionScheduler(test_factory, event_manager)
    }

@router.post("/start", response_model=TestResults)
async def start_test_simulation(request: TestSimulationRequest):
    """テストシミュレーションを開始"""
    try:
        # システムを初期化
        await initialize_test_systems()
        
        test_id = str(uuid.uuid4())
        events = []
        
        if request.test_type == "material" or request.test_type == "all":
            material_results = await test_material_flow()
            events.extend(material_results["events"])
            
        if request.test_type == "quality" or request.test_type == "all":
            quality_results = await test_quality_management()
            events.extend(quality_results["events"])
            
        if request.test_type == "scheduling" or request.test_type == "all":
            scheduling_results = await test_scheduling()
            events.extend(scheduling_results["events"])
            
        # 結果をまとめ
        results = {
            "test_id": test_id,
            "material_flow": material_results if request.test_type in ["material", "all"] else None,
            "quality": quality_results if request.test_type in ["quality", "all"] else None,
            "scheduling": scheduling_results if request.test_type in ["scheduling", "all"] else None,
            "summary": {
                "total_events": len(events),
                "test_duration_minutes": request.duration_minutes,
                "systems_tested": request.test_type
            }
        }
        
        return TestResults(
            test_type=request.test_type,
            status="completed",
            results=results,
            events=events,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"テスト実行エラー: {str(e)}")

async def test_material_flow() -> Dict[str, Any]:
    """材料フロー管理のテスト"""
    material_manager = test_systems["material_flow"]
    events = []
    
    try:
        # 1. 材料要求を作成
        request_id = await material_manager.request_material(
            process_id="test_process_1",
            product_id="TEST_PRODUCT_A",
            quantity=10,
            required_by=datetime.now() + timedelta(hours=2)
        )
        
        events.append({
            "event": "material_requested",
            "request_id": request_id,
            "quantity": 10,
            "timestamp": datetime.now().isoformat()
        })
        
        # 2. 在庫状況を確認
        inventory_status = material_manager.get_inventory_status()
        
        # 3. かんばん状況を確認
        kanban_status = material_manager.get_kanban_status()
        
        # 4. MRP計算をテスト
        production_plan = {
            "TEST_PRODUCT_A": 20,
            "TEST_PRODUCT_B": 15
        }
        
        material_requirements = await material_manager.calculate_material_requirements(production_plan)
        
        events.append({
            "event": "mrp_calculated",
            "requirements": material_requirements,
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "status": "success",
            "data": {
                "material_request_id": request_id,
                "inventory_status": inventory_status,
                "kanban_status": kanban_status,
                "material_requirements": material_requirements
            },
            "events": events
        }
        
    except Exception as e:
        events.append({
            "event": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return {
            "status": "error",
            "error": str(e),
            "events": events
        }

async def test_quality_management() -> Dict[str, Any]:
    """品質管理のテスト"""
    quality_manager = test_systems["quality_manager"]
    events = []
    
    try:
        # 1. 品質検査を実行
        inspection_results = []
        
        for i in range(5):  # 5回の検査をシミュレート
            lot_id = f"test_lot_{i+1}"
            
            inspection_id = await quality_manager.perform_quality_inspection(
                lot_id=lot_id,
                product_id="TEST_PRODUCT_A",
                process_id="test_process_1",
                inspection_type=InspectionType.IN_PROCESS,
                inspector_id="test_inspector"
            )
            
            inspection_results.append(inspection_id)
            
            events.append({
                "event": "quality_inspection_completed",
                "inspection_id": inspection_id,
                "lot_id": lot_id,
                "timestamp": datetime.now().isoformat()
            })
            
        # 2. 品質ダッシュボードを取得
        quality_dashboard = quality_manager.get_quality_dashboard()
        
        # 3. 工程能力を計算
        process_capability = await quality_manager.calculate_process_capability(
            "test_process_1", "TEST_PRODUCT_A"
        )
        
        events.append({
            "event": "process_capability_calculated",
            "capability": process_capability,
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "status": "success",
            "data": {
                "inspection_ids": inspection_results,
                "quality_dashboard": quality_dashboard,
                "process_capability": process_capability
            },
            "events": events
        }
        
    except Exception as e:
        events.append({
            "event": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return {
            "status": "error",
            "error": str(e),
            "events": events
        }

async def test_scheduling() -> Dict[str, Any]:
    """スケジューリングのテスト"""
    scheduler = test_systems["scheduler"]
    events = []
    
    try:
        # 1. 生産オーダーを作成
        order_ids = []
        
        for i in range(3):
            product_id = "TEST_PRODUCT_A" if i % 2 == 0 else "TEST_PRODUCT_B"
            quantity = random.randint(10, 30)
            due_date = datetime.now() + timedelta(hours=random.randint(8, 48))
            
            order_id = await scheduler.create_production_order(
                product_id=product_id,
                quantity=quantity,
                due_date=due_date,
                priority=random.randint(1, 5)
            )
            
            order_ids.append(order_id)
            
            events.append({
                "event": "production_order_created",
                "order_id": order_id,
                "product_id": product_id,
                "quantity": quantity,
                "timestamp": datetime.now().isoformat()
            })
            
        # 2. スケジュール状況を取得
        schedule_status = scheduler.get_schedule_status()
        
        # 3. ボトルネック分析を実行
        bottleneck_analysis = await scheduler.analyze_bottlenecks()
        
        events.append({
            "event": "bottleneck_analysis_completed",
            "bottlenecks": len(bottleneck_analysis),
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "status": "success",
            "data": {
                "order_ids": order_ids,
                "schedule_status": schedule_status,
                "bottleneck_analysis": [analysis.__dict__ for analysis in bottleneck_analysis]
            },
            "events": events
        }
        
    except Exception as e:
        events.append({
            "event": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return {
            "status": "error",
            "error": str(e),
            "events": events
        }

@router.get("/status")
async def get_test_status():
    """テスト状況を取得"""
    global test_systems, test_factory
    
    if not test_factory or not test_systems:
        return {
            "status": "not_initialized",
            "message": "テストシステムが初期化されていません"
        }
        
    return {
        "status": "ready",
        "factory": {
            "id": test_factory.id,
            "name": test_factory.name,
            "products": len(test_factory.products),
            "processes": len(test_factory.processes),
            "buffers": len(test_factory.buffers)
        },
        "systems": list(test_systems.keys()),
        "timestamp": datetime.now().isoformat()
    }

@router.get("/systems/material-flow")
async def get_material_flow_status():
    """材料フロー管理の状況"""
    if "material_flow" not in test_systems:
        raise HTTPException(status_code=404, detail="材料フローシステムが初期化されていません")
        
    material_manager = test_systems["material_flow"]
    
    return {
        "inventory_status": material_manager.get_inventory_status(),
        "kanban_status": material_manager.get_kanban_status(),
        "timestamp": datetime.now().isoformat()
    }

@router.get("/systems/quality")
async def get_quality_status():
    """品質管理の状況"""
    if "quality_manager" not in test_systems:
        raise HTTPException(status_code=404, detail="品質管理システムが初期化されていません")
        
    quality_manager = test_systems["quality_manager"]
    
    return {
        "quality_dashboard": quality_manager.get_quality_dashboard(),
        "timestamp": datetime.now().isoformat()
    }

@router.get("/systems/scheduling")
async def get_scheduling_status():
    """スケジューリングの状況"""
    if "scheduler" not in test_systems:
        raise HTTPException(status_code=404, detail="スケジューラが初期化されていません")
        
    scheduler = test_systems["scheduler"]
    
    return {
        "schedule_status": scheduler.get_schedule_status(),
        "timestamp": datetime.now().isoformat()
    }

@router.post("/demo/quick-test")
async def run_quick_demo():
    """クイックデモテストを実行"""
    try:
        # システム初期化
        await initialize_test_systems()
        
        results = {}
        
        # 材料フローのクイックテスト
        material_manager = test_systems["material_flow"]
        request_id = await material_manager.request_material(
            process_id="test_process_1",
            product_id="TEST_PRODUCT_A", 
            quantity=5,
            required_by=datetime.now() + timedelta(hours=1)
        )
        results["material_request"] = request_id
        
        # 品質検査のクイックテスト
        quality_manager = test_systems["quality_manager"]
        inspection_id = await quality_manager.perform_quality_inspection(
            lot_id="demo_lot_1",
            product_id="TEST_PRODUCT_A",
            process_id="test_process_1", 
            inspection_type=InspectionType.IN_PROCESS
        )
        results["quality_inspection"] = inspection_id
        
        # スケジューリングのクイックテスト
        scheduler = test_systems["scheduler"]
        order_id = await scheduler.create_production_order(
            product_id="TEST_PRODUCT_A",
            quantity=10,
            due_date=datetime.now() + timedelta(hours=8)
        )
        results["production_order"] = order_id
        
        return {
            "status": "success",
            "message": "クイックデモテスト完了",
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"デモテストエラー: {str(e)}")
