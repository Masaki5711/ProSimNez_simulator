"""
プロジェクト情報取得API
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import json
import os

router = APIRouter()

@router.get("/projects")
async def get_all_projects():
    """全プロジェクト一覧を取得"""
    try:
        projects_file = "backend/data/projects/projects.json"
        if not os.path.exists(projects_file):
            return {}
            
        with open(projects_file, 'r', encoding='utf-8') as f:
            projects = json.load(f)
        
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"プロジェクト一覧取得エラー: {str(e)}")

@router.get("/projects/{project_id}")
async def get_project_details(project_id: str):
    """特定のプロジェクト詳細を取得"""
    try:
        # プロジェクト基本情報
        projects_file = "backend/data/projects/projects.json"
        with open(projects_file, 'r', encoding='utf-8') as f:
            projects = json.load(f)
            
        if project_id not in projects:
            raise HTTPException(status_code=404, detail=f"プロジェクト {project_id} が見つかりません")
        
        project_info = projects[project_id]
        
        # ネットワークデータ
        network_file = f"backend/data/projects/network_{project_id}.json"
        try:
            with open(network_file, 'r', encoding='utf-8') as f:
                network_data = json.load(f)
        except FileNotFoundError:
            network_data = {
                "nodes": [],
                "edges": [],
                "products": [],
                "bom_items": []
            }
        
        # 統計情報
        stats = {
            "total_nodes": len(network_data.get("nodes", [])),
            "total_edges": len(network_data.get("edges", [])),
            "processes": len([n for n in network_data.get("nodes", []) if n.get("type") == "process"]),
            "buffers": len([n for n in network_data.get("nodes", []) if n.get("type") in ["store", "buffer"]]),
            "products": len(network_data.get("products", []))
        }
        
        return {
            "project_info": project_info,
            "network_data": network_data,
            "statistics": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"プロジェクト詳細取得エラー: {str(e)}")

@router.get("/projects/{project_id}/simulation-ready")
async def check_simulation_ready(project_id: str):
    """シミュレーション実行可能かチェック"""
    try:
        project_details = await get_project_details(project_id)
        network_data = project_details["network_data"]
        stats = project_details["statistics"]
        
        # 基本的なチェック
        issues = []
        is_ready = True
        
        if stats["total_nodes"] == 0:
            issues.append("ノードが存在しません")
            is_ready = False
        
        if stats["processes"] == 0:
            issues.append("工程が存在しません")
            is_ready = False
            
        if stats["total_edges"] == 0 and stats["total_nodes"] > 1:
            issues.append("ノード間の接続が存在しません")
            is_ready = False
        
        # 接続性チェック（簡易版）
        nodes = network_data.get("nodes", [])
        edges = network_data.get("edges", [])
        
        # 孤立したノードをチェック
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge.get("source"))
            connected_nodes.add(edge.get("target"))
        
        isolated_nodes = []
        for node in nodes:
            if node["id"] not in connected_nodes and len(nodes) > 1:
                isolated_nodes.append(node["id"])
        
        if isolated_nodes:
            issues.append(f"孤立したノード: {', '.join(isolated_nodes)}")
            is_ready = False
        
        return {
            "project_id": project_id,
            "is_simulation_ready": is_ready,
            "issues": issues,
            "statistics": stats,
            "recommendation": "すべての問題を修正してからシミュレーションを実行してください" if not is_ready else "シミュレーション実行可能です"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション可能性チェックエラー: {str(e)}")

