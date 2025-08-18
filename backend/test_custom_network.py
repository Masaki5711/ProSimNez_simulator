#!/usr/bin/env python3
"""
カスタムネットワークデータのテストスクリプト
"""
import requests
import json
import time
from datetime import datetime

# APIベースURL
BASE_URL = "http://localhost:8000"

def load_custom_network_data():
    """カスタムネットワークデータを読み込み"""
    print("📁 カスタムネットワークデータの読み込み")
    
    try:
        with open("custom_network_example.json", "r", encoding="utf-8") as f:
            network_data = json.load(f)
        
        print("✅ カスタムネットワークデータ読み込み成功")
        print(f"📊 ノード数: {len(network_data['nodes'])}")
        print(f"🔗 エッジ数: {len(network_data['edges'])}")
        print(f"📦 製品数: {len(network_data['products'])}")
        print(f"📋 BOM数: {len(network_data['bom_items'])}")
        
        # ノードの詳細表示
        print("\n🏭 工程ノード詳細:")
        for node in network_data['nodes']:
            data = node['data']
            print(f"  - {data['label']} ({node['type']})")
            print(f"    サイクルタイム: {data['cycleTime']}秒")
            print(f"    スケジューリング: {data.get('schedulingMode', 'push')}")
            if data.get('kanbanEnabled'):
                print(f"    かんばん: 有効 (カード数: {data['kanbanCardCount']})")
            print()
        
        return network_data
        
    except FileNotFoundError:
        print("❌ ファイルが見つかりません: custom_network_example.json")
        return None
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

def test_custom_network_validation(network_data):
    """カスタムネットワークデータの検証テスト"""
    print("🔍 カスタムネットワークデータの検証テスト")
    
    try:
        response = requests.post(
            f"{BASE_URL}/network-simulation/validate",
            json={"network_data": network_data}
        )
        
        if response.status_code == 200:
            validation_result = response.json()
            print("✅ 検証完了")
            print(f"📊 検証結果: {validation_result['is_valid']}")
            print(f"📋 ノード数: {validation_result['summary']['total_nodes']}")
            print(f"🔗 エッジ数: {validation_result['summary']['total_edges']}")
            print(f"⚙️ 工程ノード数: {validation_result['summary']['process_nodes']}")
            
            if validation_result['errors']:
                print("⚠️ エラー:")
                for error in validation_result['errors']:
                    print(f"  - {error['message']}")
            
            if validation_result['warnings']:
                print("⚠️ 警告:")
                for warning in validation_result['warnings']:
                    print(f"  - {warning['message']}")
            
            return validation_result['is_valid']
        else:
            print(f"❌ 検証失敗: {response.status_code}")
            print(f"エラー内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def test_custom_simulation_start(network_data):
    """カスタムネットワークでのシミュレーション開始テスト"""
    print("🚀 カスタムネットワークシミュレーション開始テスト")
    
    try:
        # シミュレーション設定
        config = {
            "start_time": datetime.now().isoformat(),
            "duration": 600,  # 10分間（より長い時間でテスト）
            "network_data": network_data,
            "enable_scheduling_control": True,
            "enable_real_time_update": True
        }
        
        response = requests.post(
            f"{BASE_URL}/start-network-simulation",
            json=config
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ シミュレーション開始成功")
            print(f"🆔 シミュレーションID: {result['simulation_id']}")
            print(f"⏰ 開始時刻: {result['start_time']}")
            print(f"⏱️ 実行時間: {result['duration']}秒")
            return result['simulation_id']
        else:
            print(f"❌ シミュレーション開始失敗: {response.status_code}")
            print(f"エラー内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

def monitor_custom_simulation(simulation_id):
    """カスタムシミュレーションの詳細監視"""
    print(f"📊 カスタムシミュレーション監視 (ID: {simulation_id})")
    
    try:
        for i in range(20):  # 20回チェック（より長く監視）
            response = requests.get(f"{BASE_URL}/network-simulation/status")
            
            if response.status_code == 200:
                status = response.json()
                print(f"⏰ チェック {i+1}: 状態={status['status']}")
                
                if 'current_time' in status:
                    print(f"  🕐 現在時刻: {status['current_time']}")
                
                if 'production_summary' in status:
                    prod_summary = status['production_summary']
                    print(f"  📦 総生産数: {prod_summary.get('total_production', 0)}")
                    
                    # 工程別生産数の詳細表示
                    if 'process_production' in prod_summary:
                        print("  🏭 工程別生産数:")
                        for process_id, count in prod_summary['process_production'].items():
                            print(f"    - {process_id}: {count}")
                
                if 'scheduling_analysis' in status:
                    sched_analysis = status['scheduling_analysis']
                    print(f"  🎯 スケジューリング分析: {len(sched_analysis)}工程")
                    
                    # スケジューリング分析の詳細表示
                    for process_id, analysis in sched_analysis.items():
                        if 'input_materials' in analysis:
                            print(f"    📋 {process_id}:")
                            for material in analysis['input_materials']:
                                print(f"      - {material['material_id']}: {material['scheduling_mode']} (在庫: {material['current_stock']})")
                
                # シミュレーションが完了したら終了
                if status['status'] == 'stopped':
                    print("✅ シミュレーション完了")
                    break
                    
            else:
                print(f"❌ 状態取得失敗: {response.status_code}")
            
            time.sleep(10)  # 10秒待機（より長い間隔）
            
    except Exception as e:
        print(f"❌ エラー: {e}")

def analyze_custom_simulation_results(simulation_id):
    """カスタムシミュレーション結果の詳細分析"""
    print(f"📋 カスタムシミュレーション結果分析 (ID: {simulation_id})")
    
    try:
        response = requests.get(f"{BASE_URL}/network-simulation/results")
        
        if response.status_code == 200:
            results = response.json()
            print("✅ 結果取得成功")
            print(f"📊 総イベント数: {results.get('total_events', 0)}")
            print(f"⏱️ 実行時間: {results.get('duration', 0)}秒")
            
            # 生産サマリーの詳細分析
            if 'production_summary' in results:
                prod_summary = results['production_summary']
                print(f"\n📦 生産サマリー:")
                print(f"  総生産数: {prod_summary.get('total_production', 0)}")
                
                if 'process_production' in prod_summary:
                    print("  🏭 工程別生産数:")
                    for process_id, count in prod_summary['process_production'].items():
                        print(f"    - {process_id}: {count}")
                
                if 'buffer_inventory' in prod_summary:
                    print("  📦 バッファ在庫:")
                    for buffer_id, inventory in prod_summary['buffer_inventory'].items():
                        print(f"    - {buffer_id}: {inventory}")
            
            # スケジューリング分析の詳細
            if 'scheduling_analysis' in results:
                sched_analysis = results['scheduling_analysis']
                print(f"\n🎯 スケジューリング分析:")
                for process_id, analysis in sched_analysis.items():
                    print(f"  📋 {process_id}:")
                    print(f"    状態: {analysis.get('status', 'unknown')}")
                    print(f"    最終更新: {analysis.get('last_update', 'N/A')}")
                    
                    if 'input_materials' in analysis:
                        print("    入力材料:")
                        for material in analysis['input_materials']:
                            print(f"      - {material['material_id']}: {material['scheduling_mode']}")
                            print(f"        在庫: {material['current_stock']}/{material['required_quantity']}")
            
            # ネットワーク性能の分析
            if 'network_performance' in results:
                perf = results['network_performance']
                print(f"\n🌐 ネットワーク性能:")
                print(f"  総工程数: {perf.get('total_processes', 0)}")
                print(f"  総バッファ数: {perf.get('total_buffers', 0)}")
                print(f"  総接続数: {perf.get('total_connections', 0)}")
                print(f"  かんばん使用: {perf.get('kanban_usage', 0)}")
                
                if 'scheduling_modes' in perf:
                    print("  スケジューリング方式:")
                    for mode, count in perf['scheduling_modes'].items():
                        print(f"    - {mode}: {count}")
            
            # 結果をファイルに保存
            filename = f"custom_simulation_results_{simulation_id[:8]}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"\n💾 結果を {filename} に保存しました")
            
        else:
            print(f"❌ 結果取得失敗: {response.status_code}")
            
    except Exception as e:
        print(f"❌ エラー: {e}")

def main():
    """メイン実行関数"""
    print("🚀 カスタムネットワークベースシミュレーションテスト開始")
    print("=" * 60)
    
    # 1. カスタムネットワークデータの読み込み
    network_data = load_custom_network_data()
    if not network_data:
        print("❌ カスタムネットワークデータの読み込みに失敗しました")
        return
    
    # 2. カスタムネットワークデータの検証
    if not test_custom_network_validation(network_data):
        print("❌ カスタムネットワークデータの検証に失敗しました")
        return
    
    # 3. カスタムネットワークでのシミュレーション開始
    simulation_id = test_custom_simulation_start(network_data)
    if not simulation_id:
        print("❌ カスタムネットワークシミュレーションの開始に失敗しました")
        return
    
    # 4. カスタムシミュレーションの詳細監視
    monitor_custom_simulation(simulation_id)
    
    # 5. カスタムシミュレーション結果の詳細分析
    analyze_custom_simulation_results(simulation_id)
    
    print("\n" + "=" * 60)
    print("✅ カスタムネットワークテスト完了！")
    print("\n💡 カスタムネットワークの特徴:")
    print("  - 5つの工程（加工センター2、組立ライン1、品質検査1、包装1）")
    print("  - 4つの接続（コンベヤ、AGV、手動搬送）")
    print("  - 3つのスケジューリング方式（プッシュ、プル、ハイブリッド）")
    print("  - かんばん制御（加工センター2、組立ライン1）")

if __name__ == "__main__":
    main()
