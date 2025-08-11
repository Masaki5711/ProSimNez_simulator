"""
ネットワーク管理のAPIエンドポイント
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import json
import os

from app.models.factory import Factory
from app.models.process import Process, Equipment
from app.models.buffer import Buffer
from app.models.product import Product

router = APIRouter()

class NetworkData(BaseModel):
    """ネットワークデータ"""
    factory: Dict[str, Any]

@router.get("/sample")
async def get_sample_network():
    """基本的なサンプルネットワークを取得"""
    # サンプルネットワークデータ（IE指標付き）
    sample_network = {
        "processes": {
            "PROC_PART_A": {
                "id": "PROC_PART_A",
                "name": "部品A機械加工",
                "type": "machining", 
                "position": {"x": 100, "y": 100},
                "equipmentCount": 2,
                "operatorCount": 1,
                "cycleTime": 60,
                "setupTime": 300,
                "availability": 85,
                "inputBufferCapacity": 50,
                "outputBufferCapacity": 100,
                "defectRate": 2.0,
                "reworkRate": 1.0,
                "operatingCost": 120,
                "inputs": [],
                "outputs": ["PART_A"]
            },
            "PROC_PART_B": {
                "id": "PROC_PART_B",
                "name": "部品B機械加工",
                "type": "machining",
                "position": {"x": 100, "y": 300},
                "equipmentCount": 1,
                "operatorCount": 1,
                "cycleTime": 90,
                "setupTime": 600,
                "availability": 80,
                "inputBufferCapacity": 30,
                "outputBufferCapacity": 60,
                "defectRate": 3.0,
                "reworkRate": 1.5,
                "operatingCost": 150,
                "inputs": [],
                "outputs": ["PART_B"]
            },
            "PROC_SUB_ASSY": {
                "id": "PROC_SUB_ASSY",
                "name": "サブアッシ組立",
                "type": "assembly",
                "position": {"x": 400, "y": 200},
                "equipmentCount": 1,
                "operatorCount": 2,
                "cycleTime": 120,
                "setupTime": 900,
                "availability": 90,
                "inputBufferCapacity": 40,
                "outputBufferCapacity": 40,
                "defectRate": 1.0,
                "reworkRate": 0.5,
                "operatingCost": 200,
                "inputs": ["PART_A", "PART_B"],
                "outputs": ["SUB_ASSY_1"]
            },
            "PROC_FINAL": {
                "id": "PROC_FINAL",
                "name": "最終組立・検査",
                "type": "assembly",
                "position": {"x": 700, "y": 200},
                "equipmentCount": 1,
                "operatorCount": 3,
                "cycleTime": 180,
                "setupTime": 1200,
                "availability": 95,
                "inputBufferCapacity": 30,
                "outputBufferCapacity": 50,
                "defectRate": 0.5,
                "reworkRate": 0.2,
                "operatingCost": 300,
                "inputs": ["SUB_ASSY_1", "PART_A"],
                "outputs": ["PRODUCT_X"]
            },
            "PROC_INSPECTION": {
                "id": "PROC_INSPECTION",
                "name": "最終検査",
                "type": "inspection",
                "position": {"x": 900, "y": 200},
                "equipmentCount": 1,
                "operatorCount": 1,
                "cycleTime": 30,
                "setupTime": 60,
                "availability": 98,
                "inputBufferCapacity": 20,
                "outputBufferCapacity": 50,
                "defectRate": 0,
                "reworkRate": 0,
                "operatingCost": 80,
                "inputs": ["PRODUCT_X"],
                "outputs": ["PRODUCT_X_INSPECTED"]
            },
            "PROC_SHIPPING": {
                "id": "PROC_SHIPPING",
                "name": "出荷準備",
                "type": "shipping",
                "position": {"x": 1100, "y": 200},
                "equipmentCount": 1,
                "operatorCount": 2,
                "cycleTime": 300,
                "setupTime": 1800,
                "availability": 95,
                "inputBufferCapacity": 200,
                "outputBufferCapacity": 0,
                "defectRate": 0,
                "reworkRate": 0,
                "operatingCost": 250,
                "inputs": ["PRODUCT_X_INSPECTED"],
                "outputs": []
            }
        },
        "connections": {
            "CONN_1": {
                "id": "CONN_1",
                "source": "PROC_PART_A",
                "target": "PROC_SUB_ASSY",
                "transportTime": 30,
                "transportLotSize": 20,
                "transportCost": 50,
                "distance": 15,
                "transportType": "conveyor"
            },
            "CONN_2": {
                "id": "CONN_2", 
                "source": "PROC_PART_B",
                "target": "PROC_SUB_ASSY",
                "transportTime": 45,
                "transportLotSize": 10,
                "transportCost": 100,
                "distance": 20,
                "transportType": "agv"
            },
            "CONN_3": {
                "id": "CONN_3",
                "source": "PROC_SUB_ASSY",
                "target": "PROC_FINAL",
                "transportTime": 45,
                "transportLotSize": 5,
                "transportCost": 80,
                "distance": 25,
                "transportType": "conveyor"
            },
            "CONN_4": {
                "id": "CONN_4",
                "source": "PROC_PART_A",
                "target": "PROC_FINAL",
                "transportTime": 60,
                "transportLotSize": 10,
                "transportCost": 120,
                "distance": 40,
                "transportType": "manual"
            },
            "CONN_5": {
                "id": "CONN_5",
                "source": "PROC_FINAL",
                "target": "PROC_INSPECTION",
                "transportTime": 15,
                "transportLotSize": 1,
                "transportCost": 20,
                "distance": 10,
                "transportType": "conveyor"
            },
            "CONN_6": {
                "id": "CONN_6",
                "source": "PROC_INSPECTION",
                "target": "PROC_SHIPPING",
                "transportTime": 30,
                "transportLotSize": 50,
                "transportCost": 150,
                "distance": 20,
                "transportType": "forklift"
            }
        }
    }
    
    return sample_network

@router.post("/save")
async def save_network(network_data: NetworkData):
    """ネットワークを保存"""
    try:
        # config/ディレクトリに保存
        config_dir = "config"
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)
            
        file_path = os.path.join(config_dir, "network.json")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(network_data.dict(), f, ensure_ascii=False, indent=2)
            
        return {"message": "ネットワークが保存されました", "file_path": file_path}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存エラー: {str(e)}")

@router.get("/load")
async def load_network():
    """保存されたネットワークを読み込み"""
    try:
        file_path = os.path.join("config", "network.json")
        
        if not os.path.exists(file_path):
            # ファイルが存在しない場合はサンプルを返す
            return await get_sample_network()
            
        with open(file_path, 'r', encoding='utf-8') as f:
            network_data = json.load(f)
            
        return network_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"読み込みエラー: {str(e)}")

@router.get("/validate")
async def validate_network(network_data: NetworkData):
    """ネットワークの妥当性を検証"""
    try:
        # 基本的な妥当性チェック
        errors = []
        warnings = []
        
        factory_data = network_data.factory
        
        # 工程の検証
        if "processes" not in factory_data:
            errors.append("工程データが見つかりません")
        else:
            processes = factory_data["processes"]
            
            # 孤立した工程をチェック
            connected_processes = set()
            if "connections" in factory_data:
                for conn in factory_data["connections"].values():
                    connected_processes.add(conn.get("source"))
                    connected_processes.add(conn.get("target"))
                    
            for process_id in processes.keys():
                if process_id not in connected_processes:
                    warnings.append(f"工程 {process_id} が他の工程と接続されていません")
        
        # 接続の検証
        if "connections" in factory_data:
            connections = factory_data["connections"]
            processes = factory_data.get("processes", {})
            
            for conn_id, conn in connections.items():
                source = conn.get("source")
                target = conn.get("target")
                
                if source not in processes:
                    errors.append(f"接続 {conn_id}: 送り元工程 {source} が存在しません")
                if target not in processes:
                    errors.append(f"接続 {conn_id}: 送り先工程 {target} が存在しません")
                    
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"検証エラー: {str(e)}")

@router.get("/templates")
async def get_network_templates():
    """ネットワークテンプレート一覧を取得"""
    templates = [
        {
            "id": "simple_line",
            "name": "シンプルライン",
            "description": "直線的な生産ライン",
            "process_count": 3
        },
        {
            "id": "mixed_flow",
            "name": "混流ライン",
            "description": "複数製品の混流生産ライン",
            "process_count": 6
        },
        {
            "id": "sub_assembly",
            "name": "サブアッシ統合",
            "description": "サブアッシ工程を含む生産ライン",
            "process_count": 8
        }
    ]
    
    return {"templates": templates}

@router.get("/demo/automotive")
async def get_automotive_demo():
    """自動車部品製造ラインのデモネットワーク"""
    
    demo_network = {
        "processes": {
            "PROC_STEEL_CUT": {
                "id": "PROC_STEEL_CUT",
                "name": "鋼材切断",
                "type": "machining",
                "position": {"x": 50, "y": 50},
                "equipmentCount": 2,
                "operatorCount": 1,
                "cycleTime": 45,
                "setupTime": 240,
                "availability": 88,
                "inputBufferCapacity": 200,
                "outputBufferCapacity": 150,
                "defectRate": 1.5,
                "reworkRate": 0.5,
                "operatingCost": 95,
                "inputs": [],
                "outputs": ["STEEL_BLANK"]
            },
            "PROC_ALUMINUM_CUT": {
                "id": "PROC_ALUMINUM_CUT",
                "name": "アルミ切断",
                "type": "machining",
                "position": {"x": 50, "y": 200},
                "equipmentCount": 1,
                "operatorCount": 1,
                "cycleTime": 35,
                "setupTime": 180,
                "availability": 92,
                "inputBufferCapacity": 100,
                "outputBufferCapacity": 80,
                "defectRate": 1.0,
                "reworkRate": 0.3,
                "operatingCost": 85,
                "inputs": [],
                "outputs": ["ALUMINUM_BLANK"]
            },
            "PROC_STEEL_MACHINING": {
                "id": "PROC_STEEL_MACHINING",
                "name": "鋼材機械加工",
                "type": "machining",
                "position": {"x": 250, "y": 50},
                "equipmentCount": 3,
                "operatorCount": 2,
                "cycleTime": 75,
                "setupTime": 450,
                "availability": 85,
                "inputBufferCapacity": 80,
                "outputBufferCapacity": 60,
                "defectRate": 2.5,
                "reworkRate": 1.2,
                "operatingCost": 140,
                "inputs": ["STEEL_BLANK"],
                "outputs": ["STEEL_PART"]
            },
            "PROC_ALUMINUM_MACHINING": {
                "id": "PROC_ALUMINUM_MACHINING",
                "name": "アルミ機械加工",
                "type": "machining",
                "position": {"x": 250, "y": 200},
                "equipmentCount": 2,
                "operatorCount": 1,
                "cycleTime": 55,
                "setupTime": 360,
                "availability": 90,
                "inputBufferCapacity": 60,
                "outputBufferCapacity": 45,
                "defectRate": 1.8,
                "reworkRate": 0.8,
                "operatingCost": 110,
                "inputs": ["ALUMINUM_BLANK"],
                "outputs": ["ALUMINUM_PART"]
            },
            "PROC_SURFACE_TREATMENT": {
                "id": "PROC_SURFACE_TREATMENT",
                "name": "表面処理",
                "type": "inspection",
                "position": {"x": 450, "y": 125},
                "equipmentCount": 1,
                "operatorCount": 1,
                "cycleTime": 90,
                "setupTime": 300,
                "availability": 93,
                "inputBufferCapacity": 40,
                "outputBufferCapacity": 40,
                "defectRate": 0.8,
                "reworkRate": 2.0,
                "operatingCost": 75,
                "inputs": ["STEEL_PART", "ALUMINUM_PART"],
                "outputs": ["TREATED_STEEL", "TREATED_ALUMINUM"]
            },
            "PROC_PRELIMINARY_ASSY": {
                "id": "PROC_PRELIMINARY_ASSY",
                "name": "予備組立",
                "type": "assembly",
                "position": {"x": 650, "y": 125},
                "equipmentCount": 2,
                "operatorCount": 3,
                "cycleTime": 180,
                "setupTime": 720,
                "availability": 87,
                "inputBufferCapacity": 25,
                "outputBufferCapacity": 20,
                "defectRate": 1.5,
                "reworkRate": 3.0,
                "operatingCost": 220,
                "inputs": ["TREATED_STEEL", "TREATED_ALUMINUM"],
                "outputs": ["PRELIM_ASSY"]
            },
            "PROC_FINAL_ASSY": {
                "id": "PROC_FINAL_ASSY",
                "name": "最終組立",
                "type": "assembly",
                "position": {"x": 850, "y": 125},
                "equipmentCount": 1,
                "operatorCount": 4,
                "cycleTime": 300,
                "setupTime": 900,
                "availability": 90,
                "inputBufferCapacity": 15,
                "outputBufferCapacity": 10,
                "defectRate": 1.0,
                "reworkRate": 4.0,
                "operatingCost": 350,
                "inputs": ["PRELIM_ASSY"],
                "outputs": ["FINAL_PRODUCT"]
            },
            "PROC_QUALITY_INSPECTION": {
                "id": "PROC_QUALITY_INSPECTION",
                "name": "品質検査",
                "type": "inspection",
                "position": {"x": 1050, "y": 125},
                "equipmentCount": 2,
                "operatorCount": 2,
                "cycleTime": 60,
                "setupTime": 180,
                "availability": 96,
                "inputBufferCapacity": 10,
                "outputBufferCapacity": 8,
                "defectRate": 0.3,
                "reworkRate": 12.0,
                "operatingCost": 120,
                "inputs": ["FINAL_PRODUCT"],
                "outputs": ["INSPECTED_PRODUCT"]
            },
            "PROC_WAREHOUSE": {
                "id": "PROC_WAREHOUSE",
                "name": "倉庫保管",
                "type": "storage",
                "position": {"x": 1250, "y": 50},
                "equipmentCount": 0,
                "operatorCount": 1,
                "cycleTime": 10,
                "setupTime": 0,
                "availability": 99,
                "inputBufferCapacity": 1000,
                "outputBufferCapacity": 1000,
                "defectRate": 0,
                "reworkRate": 0,
                "operatingCost": 15,
                "inputs": ["INSPECTED_PRODUCT"],
                "outputs": ["STORED_PRODUCT"]
            },
            "PROC_SHIPPING_DOCK": {
                "id": "PROC_SHIPPING_DOCK",
                "name": "出荷場",
                "type": "shipping",
                "position": {"x": 1250, "y": 200},
                "equipmentCount": 2,
                "operatorCount": 3,
                "cycleTime": 30,
                "setupTime": 60,
                "availability": 94,
                "inputBufferCapacity": 200,
                "outputBufferCapacity": 0,
                "defectRate": 0,
                "reworkRate": 0,
                "operatingCost": 80,
                "inputs": ["STORED_PRODUCT"],
                "outputs": []
            }
        },
        "connections": {
            "CONN_STEEL_TO_MACHINING": {
                "id": "CONN_STEEL_TO_MACHINING",
                "source": "PROC_STEEL_CUT",
                "target": "PROC_STEEL_MACHINING",
                "transportTime": 60,
                "transportLotSize": 50,
                "transportCost": 80,
                "distance": 25,
                "transportType": "conveyor"
            },
            "CONN_ALUMINUM_TO_MACHINING": {
                "id": "CONN_ALUMINUM_TO_MACHINING",
                "source": "PROC_ALUMINUM_CUT",
                "target": "PROC_ALUMINUM_MACHINING",
                "transportTime": 45,
                "transportLotSize": 30,
                "transportCost": 60,
                "distance": 20,
                "transportType": "conveyor"
            },
            "CONN_STEEL_TO_TREATMENT": {
                "id": "CONN_STEEL_TO_TREATMENT",
                "source": "PROC_STEEL_MACHINING",
                "target": "PROC_SURFACE_TREATMENT",
                "transportTime": 120,
                "transportLotSize": 20,
                "transportCost": 100,
                "distance": 30,
                "transportType": "agv"
            },
            "CONN_ALUMINUM_TO_TREATMENT": {
                "id": "CONN_ALUMINUM_TO_TREATMENT",
                "source": "PROC_ALUMINUM_MACHINING",
                "target": "PROC_SURFACE_TREATMENT",
                "transportTime": 90,
                "transportLotSize": 15,
                "transportCost": 75,
                "distance": 25,
                "transportType": "agv"
            },
            "CONN_TREATMENT_TO_PRELIM": {
                "id": "CONN_TREATMENT_TO_PRELIM",
                "source": "PROC_SURFACE_TREATMENT",
                "target": "PROC_PRELIMINARY_ASSY",
                "transportTime": 180,
                "transportLotSize": 10,
                "transportCost": 50,
                "distance": 15,
                "transportType": "manual"
            },
            "CONN_PRELIM_TO_FINAL": {
                "id": "CONN_PRELIM_TO_FINAL",
                "source": "PROC_PRELIMINARY_ASSY",
                "target": "PROC_FINAL_ASSY",
                "transportTime": 240,
                "transportLotSize": 5,
                "transportCost": 40,
                "distance": 12,
                "transportType": "manual"
            },
            "CONN_FINAL_TO_INSPECTION": {
                "id": "CONN_FINAL_TO_INSPECTION",
                "source": "PROC_FINAL_ASSY",
                "target": "PROC_QUALITY_INSPECTION",
                "transportTime": 300,
                "transportLotSize": 3,
                "transportCost": 30,
                "distance": 10,
                "transportType": "manual"
            },
            "CONN_INSPECTION_TO_WAREHOUSE": {
                "id": "CONN_INSPECTION_TO_WAREHOUSE",
                "source": "PROC_QUALITY_INSPECTION",
                "target": "PROC_WAREHOUSE",
                "transportTime": 180,
                "transportLotSize": 20,
                "transportCost": 90,
                "distance": 35,
                "transportType": "forklift"
            },
            "CONN_WAREHOUSE_TO_SHIPPING": {
                "id": "CONN_WAREHOUSE_TO_SHIPPING",
                "source": "PROC_WAREHOUSE",
                "target": "PROC_SHIPPING_DOCK",
                "transportTime": 600,
                "transportLotSize": 100,
                "transportCost": 200,
                "distance": 50,
                "transportType": "forklift"
            }
        }
    }
    
    return {"factory": demo_network}