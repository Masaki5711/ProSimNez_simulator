#!/usr/bin/env python3
"""
ProSimNez ファクトチェックツール 実行例

このスクリプトは、ファクトチェックツールの基本的な使用方法を示します。
"""

import json
import sys
import os
from pathlib import Path

# プロジェクトルートのパスを設定
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root / "backend"))

def create_sample_project_file():
    """サンプルプロジェクトファイルを作成"""
    sample_data = {
        "nodes": [
            {
                "id": "PROC_001",
                "data": {
                    "label": "機械加工工程",
                    "type": "machining",
                    "cycleTime": 60,
                    "setupTime": 300,
                    "equipmentCount": 2,
                    "operatorCount": 1,
                    "defectRate": 2.0,
                    "reworkRate": 1.0,
                    "operatingCost": 120,
                    "inputBufferCapacity": 50,
                    "outputBufferCapacity": 100
                }
            },
            {
                "id": "PROC_002",
                "data": {
                    "label": "組立工程",
                    "type": "assembly",
                    "cycleTime": 120,
                    "setupTime": 600,
                    "equipmentCount": 1,
                    "operatorCount": 2,
                    "defectRate": 1.0,
                    "reworkRate": 0.5,
                    "operatingCost": 150,
                    "inputBufferCapacity": 30,
                    "outputBufferCapacity": 50
                }
            },
            {
                "id": "STORE_001",
                "data": {
                    "label": "最終製品ストア",
                    "type": "store",
                    "cycleTime": 5,
                    "setupTime": 0,
                    "equipmentCount": 0,
                    "operatorCount": 0,
                    "defectRate": 0,
                    "reworkRate": 0,
                    "operatingCost": 10,
                    "inputBufferCapacity": 1000,
                    "outputBufferCapacity": 0
                }
            }
        ],
        "edges": [
            {
                "id": "EDGE_001",
                "source": "PROC_001",
                "target": "PROC_002",
                "data": {
                    "transportTime": 30,
                    "transportLotSize": 10,
                    "transportCost": 50
                }
            },
            {
                "id": "EDGE_002",
                "source": "PROC_002",
                "target": "STORE_001",
                "data": {
                    "transportTime": 15,
                    "transportLotSize": 5,
                    "transportCost": 25
                }
            }
        ],
        "products": [
            {
                "id": "PRODUCT_A",
                "name": "製品A",
                "type": "finished_product",
                "unitCost": 1000
            },
            {
                "id": "MATERIAL_001",
                "name": "材料1",
                "type": "raw_material",
                "unitCost": 100
            }
        ],
        "bom_items": [
            {
                "product_id": "PRODUCT_A",
                "product_name": "製品A",
                "quantity": 1,
                "parent_product_id": None
            }
        ],
        "process_advanced_data": {
            "PROC_001": {
                "id": "PROC_001",
                "label": "機械加工工程",
                "type": "machining",
                "inputMaterials": [
                    {
                        "materialId": "MATERIAL_001",
                        "materialName": "材料1",
                        "requiredQuantity": 1
                    }
                ],
                "outputProducts": [
                    {
                        "productId": "PRODUCT_A",
                        "productName": "製品A",
                        "outputQuantity": 1
                    }
                ]
            },
            "PROC_002": {
                "id": "PROC_002",
                "label": "組立工程",
                "type": "assembly",
                "inputMaterials": [
                    {
                        "materialId": "PRODUCT_A",
                        "materialName": "製品A",
                        "requiredQuantity": 1
                    }
                ],
                "outputProducts": [
                    {
                        "productId": "PRODUCT_A",
                        "productName": "製品A",
                        "outputQuantity": 1
                    }
                ]
            }
        }
    }
    
    # サンプルファイルを作成
    sample_file_path = project_root / "config" / "sample_project.json"
    sample_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(sample_file_path, 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ サンプルプロジェクトファイルを作成しました: {sample_file_path}")
    return sample_file_path

def run_fact_checker_examples():
    """ファクトチェッカーの実行例"""
    print("=" * 60)
    print("ProSimNez ファクトチェックツール 実行例")
    print("=" * 60)
    
    # サンプルファイルを作成
    sample_file = create_sample_project_file()
    
    print("\n📋 実行例:")
    print("-" * 40)
    
    # 例1: 全てのチェックを実行
    print("1. 全てのチェックを実行:")
    print(f"   cd backend")
    print(f"   python -m app.tools.fact_checker --check-all --project-file {sample_file}")
    
    # 例2: 特定のチェック項目のみ実行
    print("\n2. ネットワーク整合性チェックのみ:")
    print(f"   cd backend")
    print(f"   python -m app.tools.fact_checker --check-network --project-file {sample_file}")
    
    # 例3: レポート生成
    print("\n3. 詳細レポートを生成:")
    print(f"   cd backend")
    print(f"   python -m app.tools.fact_checker --check-all --project-file {sample_file} --generate-report --report-type detailed")
    
    # 例4: ファイルに保存
    print("\n4. レポートをファイルに保存:")
    print(f"   cd backend")
    print(f"   python -m app.tools.fact_checker --check-all --project-file {sample_file} --generate-report --report-type detailed --output-file check_report.txt")
    
    print("\n🚀 実際に実行してみましょう！")
    print("上記のコマンドのいずれかを実行してください。")
    
    return sample_file

def run_quick_check():
    """クイックチェックを実行"""
    print("\n" + "=" * 60)
    print("クイックチェックを実行します")
    print("=" * 60)
    
    try:
        # ファクトチェッカーをインポート
        from app.tools.fact_checker import FactChecker
        
        # サンプルデータを読み込み
        sample_file = create_sample_project_file()
        with open(sample_file, 'r', encoding='utf-8') as f:
            sample_data = json.load(f)
        
        # チェッカーを実行
        checker = FactChecker()
        summary = checker.run_all_checks(sample_data)
        
        print(f"✅ チェック完了!")
        print(f"   成功: {summary.passed}")
        print(f"   警告: {summary.warnings}")
        print(f"   エラー: {summary.errors}")
        print(f"   重大: {summary.critical}")
        print(f"   実行時間: {summary.execution_time:.3f}秒")
        
        # サマリーレポートを表示
        print("\n📊 サマリーレポート:")
        print("-" * 40)
        report = checker.generate_report("summary")
        print(report)
        
        return True
        
    except ImportError as e:
        print(f"❌ インポートエラー: {e}")
        print("ファクトチェッカーツールが正しくインストールされていない可能性があります。")
        return False
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        return False

def main():
    """メイン関数"""
    print("ProSimNez ファクトチェックツール 実行例")
    
    # 実行例を表示
    sample_file = run_fact_checker_examples()
    
    # クイックチェックを実行
    if run_quick_check():
        print("\n🎉 クイックチェックが成功しました！")
        print("これで、ファクトチェックツールが正常に動作することが確認できました。")
    else:
        print("\n⚠️ クイックチェックで問題が発生しました。")
        print("上記のコマンド例を手動で実行してみてください。")
    
    print(f"\n📁 サンプルファイル: {sample_file}")
    print("このファイルを削除しても構いません。")

if __name__ == "__main__":
    main() 