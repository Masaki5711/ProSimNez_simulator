"""
新しいシミュレーションシステムのセットアップスクリプト
"""
import asyncio
import json
from pathlib import Path

from app.core.data_integration import DataIntegrationEngine, DynamicConfigurationManager
from app.core.enhanced_simulator import EnhancedSimulationEngine
from app.core.persistence_manager import PersistenceManager
from app.websocket.realtime_manager import RealtimeDataManager
from app.tools.enhanced_fact_checker import EnhancedFactChecker

async def setup_simulation_system():
    """新しいシミュレーションシステムをセットアップ"""
    
    print("ProSimNez 強化シミュレーションシステム セットアップ開始...")
    
    # 1. データ統合エンジンの初期化
    print("1. データ統合エンジンを初期化中...")
    integration_engine = DataIntegrationEngine()
    config_manager = DynamicConfigurationManager(integration_engine)
    
    # 2. 永続化マネージャーの初期化
    print("2. 永続化マネージャーを初期化中...")
    persistence_manager = PersistenceManager()
    await persistence_manager.initialize()
    
    # 3. リアルタイムデータマネージャーの初期化
    print("3. リアルタイムデータマネージャーを初期化中...")
    realtime_manager = RealtimeDataManager()
    await realtime_manager.initialize()
    
    # 4. 強化ファクトチェッカーの初期化
    print("4. 強化ファクトチェッカーを初期化中...")
    fact_checker = EnhancedFactChecker()
    
    # 5. サンプルプロジェクトの作成
    print("5. サンプルプロジェクトを作成中...")
    sample_project = await create_sample_project(integration_engine)
    
    # 6. システムテスト
    print("6. システムテストを実行中...")
    await test_system_integration(
        sample_project,
        integration_engine,
        persistence_manager,
        realtime_manager,
        fact_checker
    )
    
    print("✅ セットアップが完了しました!")
    print("\n📊 システム概要:")
    print("- 非同期シミュレーションエンジン")
    print("- リアルタイムデータ同期 (WebSocket + Redis)")
    print("- フロントエンドデータ統合")
    print("- データ永続化とバージョン管理")
    print("- 強化ファクトチェック機能")
    
    return {
        "integration_engine": integration_engine,
        "config_manager": config_manager,
        "persistence_manager": persistence_manager,
        "realtime_manager": realtime_manager,
        "fact_checker": fact_checker
    }

async def create_sample_project(integration_engine: DataIntegrationEngine):
    """サンプルプロジェクトを作成"""
    
    sample_network_data = {
        "nodes": [
            {
                "id": "process_1",
                "data": {
                    "label": "材料投入",
                    "type": "store",
                    "cycleTime": 10,
                    "setupTime": 0,
                    "equipmentCount": 1,
                    "operatorCount": 1,
                    "inputBufferCapacity": 1000,
                    "outputBufferCapacity": 100,
                    "defectRate": 0,
                    "reworkRate": 0,
                    "operatingCost": 50,
                    "inputs": [],
                    "outputs": ["material_a"]
                }
            },
            {
                "id": "process_2", 
                "data": {
                    "label": "機械加工",
                    "type": "machining",
                    "cycleTime": 60,
                    "setupTime": 300,
                    "equipmentCount": 2,
                    "operatorCount": 1,
                    "inputBufferCapacity": 50,
                    "outputBufferCapacity": 50,
                    "defectRate": 2,
                    "reworkRate": 1,
                    "operatingCost": 100,
                    "inputs": ["material_a"],
                    "outputs": ["part_b"]
                }
            },
            {
                "id": "process_3",
                "data": {
                    "label": "組立",
                    "type": "assembly",
                    "cycleTime": 120,
                    "setupTime": 600,
                    "equipmentCount": 1,
                    "operatorCount": 2,
                    "inputBufferCapacity": 30,
                    "outputBufferCapacity": 30,
                    "defectRate": 1,
                    "reworkRate": 0.5,
                    "operatingCost": 150,
                    "inputs": ["part_b"],
                    "outputs": ["product_c"]
                }
            },
            {
                "id": "process_4",
                "data": {
                    "label": "検査",
                    "type": "inspection",
                    "cycleTime": 30,
                    "setupTime": 180,
                    "equipmentCount": 1,
                    "operatorCount": 1,
                    "inputBufferCapacity": 20,
                    "outputBufferCapacity": 20,
                    "defectRate": 0,
                    "reworkRate": 0,
                    "operatingCost": 80,
                    "inputs": ["product_c"],
                    "outputs": ["inspected_product"]
                }
            },
            {
                "id": "process_5",
                "data": {
                    "label": "完成品ストア",
                    "type": "store",
                    "cycleTime": 5,
                    "setupTime": 0,
                    "equipmentCount": 1,
                    "operatorCount": 0,
                    "inputBufferCapacity": 200,
                    "outputBufferCapacity": 0,
                    "defectRate": 0,
                    "reworkRate": 0,
                    "operatingCost": 20,
                    "inputs": ["inspected_product"],
                    "outputs": []
                }
            }
        ],
        "edges": [
            {
                "id": "edge_1",
                "source": "process_1",
                "target": "process_2",
                "transportTime": 30,
                "transportLotSize": 10,
                "transportCost": 5,
                "distance": 20,
                "transportType": "manual"
            },
            {
                "id": "edge_2", 
                "source": "process_2",
                "target": "process_3",
                "transportTime": 60,
                "transportLotSize": 5,
                "transportCost": 8,
                "distance": 30,
                "transportType": "agv"
            },
            {
                "id": "edge_3",
                "source": "process_3",
                "target": "process_4", 
                "transportTime": 45,
                "transportLotSize": 3,
                "transportCost": 6,
                "distance": 25,
                "transportType": "conveyor"
            },
            {
                "id": "edge_4",
                "source": "process_4",
                "target": "process_5",
                "transportTime": 15,
                "transportLotSize": 1,
                "transportCost": 3,
                "distance": 10,
                "transportType": "manual"
            }
        ],
        "products": [
            {
                "id": "material_a",
                "name": "原材料A",
                "code": "MAT-A001",
                "type": "raw_material",
                "version": "1.0",
                "description": "基本原材料",
                "unitCost": 10.0,
                "leadTime": 1.0,
                "supplier": "サプライヤーA",
                "storageConditions": "常温",
                "qualityGrade": "A"
            },
            {
                "id": "part_b",
                "name": "部品B",
                "code": "PART-B001",
                "type": "component",
                "version": "1.0", 
                "description": "加工部品",
                "unitCost": 25.0,
                "leadTime": 2.0,
                "supplier": "",
                "storageConditions": "常温",
                "qualityGrade": "A"
            },
            {
                "id": "product_c",
                "name": "製品C",
                "code": "PROD-C001",
                "type": "sub_assembly",
                "version": "1.0",
                "description": "組立製品",
                "unitCost": 50.0,
                "leadTime": 4.0,
                "supplier": "",
                "storageConditions": "常温",
                "qualityGrade": "A"
            },
            {
                "id": "inspected_product",
                "name": "検査済み製品",
                "code": "INSP-001",
                "type": "finished_product",
                "version": "1.0",
                "description": "検査済み完成品",
                "unitCost": 80.0,
                "leadTime": 5.0,
                "supplier": "",
                "storageConditions": "常温",
                "qualityGrade": "A"
            }
        ],
        "bom_items": [
            {
                "id": "bom_1",
                "parentProductId": "part_b",
                "childProductId": "material_a",
                "quantity": 1,
                "unit": "個",
                "position": "",
                "isOptional": False,
                "effectiveDate": "2024-01-01T00:00:00Z",
                "alternativeProducts": [],
                "notes": ""
            },
            {
                "id": "bom_2",
                "parentProductId": "product_c", 
                "childProductId": "part_b",
                "quantity": 2,
                "unit": "個",
                "position": "",
                "isOptional": False,
                "effectiveDate": "2024-01-01T00:00:00Z",
                "alternativeProducts": [],
                "notes": ""
            }
        ],
        "process_advanced_data": {}
    }
    
    # プロジェクトデータを変換
    project_id = "sample_project_001"
    transformation_result = await integration_engine.transform_network_data(
        sample_network_data, 
        project_id
    )
    
    return {
        "project_id": project_id,
        "network_data": sample_network_data,
        "transformation_result": transformation_result
    }

async def test_system_integration(sample_project, integration_engine, persistence_manager, 
                                realtime_manager, fact_checker):
    """システム統合テスト"""
    
    project_id = sample_project["project_id"]
    transformation_result = sample_project["transformation_result"]
    
    # 1. ファクトチェックテスト
    print("  - ファクトチェック実行中...")
    fact_check_result = await fact_checker.comprehensive_check(transformation_result)
    print(f"    ✓ チェック完了: {fact_check_result['summary']['total_issues']}件の問題")
    
    # 2. 永続化テスト
    print("  - データ永続化テスト中...")
    version = await persistence_manager.save_project(
        project_id,
        transformation_result,
        "system_test",
        "システムテスト用サンプルプロジェクト"
    )
    print(f"    ✓ バージョン {version.version_number} で保存完了")
    
    # 3. シミュレーション作成テスト
    print("  - シミュレーションエンジンテスト中...")
    simulator = EnhancedSimulationEngine(
        transformation_result.factory,
        websocket_manager=realtime_manager.websocket_manager,
        redis_client=realtime_manager.redis_cache
    )
    
    # 短時間テスト実行
    success = await simulator.start_simulation(10.0)  # 10秒間
    if success:
        await asyncio.sleep(2)  # 2秒間実行
        await simulator.stop_simulation()
        print("    ✓ シミュレーション実行テスト完了")
    else:
        print("    ⚠ シミュレーション開始に失敗")
        
    # 4. データ読み込みテスト
    print("  - データ読み込みテスト中...")
    loaded_result = await persistence_manager.load_project(project_id)
    if loaded_result:
        print("    ✓ データ読み込み完了")
    else:
        print("    ⚠ データ読み込みに失敗")

if __name__ == "__main__":
    asyncio.run(setup_simulation_system())



