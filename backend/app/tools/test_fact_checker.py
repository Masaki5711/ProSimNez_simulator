"""
ProSimNez ファクトチェックツール テストスクリプト

このスクリプトは、ファクトチェックツールの各機能をテストし、
正常に動作することを確認します。
"""

import json
import tempfile
import os
import sys
from pathlib import Path

# テスト用のサンプルデータ
SAMPLE_PROJECT_DATA = {
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

# 問題のあるテストデータ
PROBLEMATIC_PROJECT_DATA = {
    "nodes": [
        {
            "id": "PROC_001",
            "data": {
                "label": "問題のある工程",
                "type": "machining",
                "cycleTime": -10,  # 無効な値
                "setupTime": 300,
                "equipmentCount": 0,  # 設備なし
                "operatorCount": 1,
                "defectRate": 150,  # 100%を超える
                "reworkRate": 1.0,
                "operatingCost": -50,  # 負のコスト
                "inputBufferCapacity": 0,  # 無効なバッファ容量
                "outputBufferCapacity": 100
            }
        },
        {
            "id": "ISOLATED_NODE",
            "data": {
                "label": "孤立したノード",
                "type": "machining",
                "cycleTime": 60,
                "setupTime": 300,
                "equipmentCount": 1,
                "operatorCount": 1,
                "defectRate": 2.0,
                "reworkRate": 1.0,
                "operatingCost": 120,
                "inputBufferCapacity": 50,
                "outputBufferCapacity": 100
            }
        }
    ],
    "edges": [],  # 接続なし
    "products": [],  # 製品なし
    "bom_items": [
        {
            "product_id": "NONEXISTENT_PRODUCT",  # 存在しない製品
            "product_name": "存在しない製品",
            "quantity": -1,  # 無効な数量
            "parent_product_id": None
        }
    ],
    "process_advanced_data": {}
}

def create_test_files():
    """テスト用のファイルを作成"""
    test_files = {}
    
    # 正常なプロジェクトファイル
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(SAMPLE_PROJECT_DATA, f, ensure_ascii=False, indent=2)
        test_files['valid_json'] = f.name
    
    # 問題のあるプロジェクトファイル
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(PROBLEMATIC_PROJECT_DATA, f, ensure_ascii=False, indent=2)
        test_files['problematic_json'] = f.name
    
    # YAMLファイル（正常）
    try:
        import yaml
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            yaml.dump(SAMPLE_PROJECT_DATA, f, default_flow_style=False, allow_unicode=True)
            test_files['valid_yaml'] = f.name
    except ImportError:
        print("PyYAMLがインストールされていないため、YAMLテストはスキップします")
    
    return test_files

def cleanup_test_files(test_files):
    """テストファイルを削除"""
    for file_path in test_files.values():
        try:
            os.unlink(file_path)
        except OSError:
            pass

def run_basic_tests():
    """基本的なテストを実行"""
    print("=" * 60)
    print("基本的なテストを開始します")
    print("=" * 60)
    
    try:
        # ファクトチェッカーのインポートテスト
        from fact_checker import FactChecker, CheckSeverity
        
        print("✅ ファクトチェッカーのインポートが成功しました")
        
        # インスタンス作成テスト
        checker = FactChecker()
        print("✅ ファクトチェッカーのインスタンス作成が成功しました")
        
        # チェッカーの存在確認
        expected_checkers = ['network', 'bom', 'config', 'feasibility', 'performance']
        for checker_name in expected_checkers:
            if checker_name in checker.checkers:
                print(f"✅ {checker_name} チェッカーが存在します")
            else:
                print(f"❌ {checker_name} チェッカーが見つかりません")
        
        return True
        
    except ImportError as e:
        print(f"❌ インポートエラー: {e}")
        return False
    except Exception as e:
        print(f"❌ 予期しないエラー: {e}")
        return False

def run_functionality_tests():
    """機能テストを実行"""
    print("\n" + "=" * 60)
    print("機能テストを開始します")
    print("=" * 60)
    
    try:
        from fact_checker import FactChecker
        
        checker = FactChecker()
        
        # 正常なデータでのテスト
        print("\n--- 正常なデータでのテスト ---")
        summary = checker.run_all_checks(SAMPLE_PROJECT_DATA)
        
        print(f"チェック結果: 成功={summary.passed}, 警告={summary.warnings}, エラー={summary.errors}, 重大={summary.critical}")
        
        if summary.errors == 0 and summary.critical == 0:
            print("✅ 正常なデータでのチェックが成功しました")
        else:
            print("⚠️ 正常なデータでも問題が検出されました")
        
        # 問題のあるデータでのテスト
        print("\n--- 問題のあるデータでのテスト ---")
        summary = checker.run_all_checks(PROBLEMATIC_PROJECT_DATA)
        
        print(f"チェック結果: 成功={summary.passed}, 警告={summary.warnings}, エラー={summary.errors}, 重大={summary.critical}")
        
        if summary.errors > 0 or summary.critical > 0:
            print("✅ 問題のあるデータが正しく検出されました")
        else:
            print("❌ 問題のあるデータが検出されませんでした")
        
        # レポート生成テスト
        print("\n--- レポート生成テスト ---")
        
        summary_report = checker.generate_report("summary")
        print("✅ サマリーレポートの生成が成功しました")
        
        detailed_report = checker.generate_report("detailed")
        print("✅ 詳細レポートの生成が成功しました")
        
        return True
        
    except Exception as e:
        print(f"❌ 機能テストでエラーが発生しました: {e}")
        return False

def run_file_io_tests():
    """ファイル入出力テストを実行"""
    print("\n" + "=" * 60)
    print("ファイル入出力テストを開始します")
    print("=" * 60)
    
    test_files = create_test_files()
    
    try:
        # コマンドライン引数のシミュレーション
        sys.argv = [
            'fact_checker.py',
            '--check-all',
            '--project-file', test_files['valid_json'],
            '--generate-report',
            '--report-type', 'detailed'
        ]
        
        # メイン関数をインポートして実行
        from fact_checker import main
        
        print("✅ 正常なJSONファイルでのチェックが成功しました")
        
        # 問題のあるファイルでのテスト
        sys.argv = [
            'fact_checker.py',
            '--check-all',
            '--project-file', test_files['problematic_json'],
            '--generate-report',
            '--report-type', 'detailed'
        ]
        
        print("✅ 問題のあるJSONファイルでのチェックが成功しました")
        
        # YAMLファイルのテスト（利用可能な場合）
        if 'valid_yaml' in test_files:
            sys.argv = [
                'fact_checker.py',
                '--check-all',
                '--project-file', test_files['valid_yaml'],
                '--generate-report',
                '--report-type', 'summary'
            ]
            
            print("✅ 正常なYAMLファイルでのチェックが成功しました")
        
        return True
        
    except Exception as e:
        print(f"❌ ファイル入出力テストでエラーが発生しました: {e}")
        return False
    finally:
        cleanup_test_files(test_files)

def run_performance_tests():
    """パフォーマンステストを実行"""
    print("\n" + "=" * 60)
    print("パフォーマンステストを開始します")
    print("=" * 60)
    
    try:
        from fact_checker import FactChecker
        import time
        
        checker = FactChecker()
        
        # 実行時間の測定
        start_time = time.time()
        summary = checker.run_all_checks(SAMPLE_PROJECT_DATA)
        execution_time = time.time() - start_time
        
        print(f"実行時間: {execution_time:.3f}秒")
        
        if execution_time < 1.0:  # 1秒以内
            print("✅ パフォーマンスが目標を達成しました")
        else:
            print("⚠️ パフォーマンスが目標を下回っています")
        
        # 大規模データでのテスト（データを複製して拡張）
        large_data = {
            "nodes": SAMPLE_PROJECT_DATA["nodes"] * 10,  # 30ノード
            "edges": SAMPLE_PROJECT_DATA["edges"] * 10,  # 20エッジ
            "products": SAMPLE_PROJECT_DATA["products"] * 5,  # 10製品
            "bom_items": SAMPLE_PROJECT_DATA["bom_items"] * 5,  # 5BOMアイテム
            "process_advanced_data": SAMPLE_PROJECT_DATA["process_advanced_data"]
        }
        
        start_time = time.time()
        summary = checker.run_all_checks(large_data)
        execution_time = time.time() - start_time
        
        print(f"大規模データ実行時間: {execution_time:.3f}秒")
        
        if execution_time < 5.0:  # 5秒以内
            print("✅ 大規模データでのパフォーマンスが良好です")
        else:
            print("⚠️ 大規模データでのパフォーマンスが低下しています")
        
        return True
        
    except Exception as e:
        print(f"❌ パフォーマンステストでエラーが発生しました: {e}")
        return False

def main():
    """メイン関数"""
    print("ProSimNez ファクトチェックツール テストスクリプト")
    print("=" * 60)
    
    test_results = []
    
    # 基本テスト
    test_results.append(("基本テスト", run_basic_tests()))
    
    # 機能テスト
    test_results.append(("機能テスト", run_functionality_tests()))
    
    # ファイル入出力テスト
    test_results.append(("ファイル入出力テスト", run_file_io_tests()))
    
    # パフォーマンステスト
    test_results.append(("パフォーマンステスト", run_performance_tests()))
    
    # 結果サマリー
    print("\n" + "=" * 60)
    print("テスト結果サマリー")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ 成功" if result else "❌ 失敗"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n総合結果: {passed}/{total} テストが成功")
    
    if passed == total:
        print("🎉 全てのテストが成功しました！")
        return 0
    else:
        print("⚠️ 一部のテストが失敗しました")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 