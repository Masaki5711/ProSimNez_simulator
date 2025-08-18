#!/usr/bin/env python3
"""
ネットワークベースシミュレーションのテストスクリプト
"""
import requests
import json
import time
from datetime import datetime

# APIベースURL
BASE_URL = "http://localhost:8000"

def test_sample_data():
    """サンプルデータの取得とテスト"""
    print("🧪 サンプルデータの取得テスト")
    
    try:
        response = requests.get(f"{BASE_URL}/network-simulation/sample-data")
        if response.status_code == 200:
            data = response.json()
            print("✅ サンプルデータ取得成功")
            print(f"📊 ノード数: {len(data['sample_data']['nodes'])}")
            print(f"🔗 エッジ数: {len(data['sample_data']['edges'])}")
            print(f"📦 製品数: {len(data['sample_data']['products'])}")
            print(f"📋 BOM数: {len(data['sample_data']['bom_items'])}")
            
            # サンプルデータをファイルに保存
            with open("sample_network.json", "w", encoding="utf-8") as f:
                json.dump(data['sample_data'], f, ensure_ascii=False, indent=2)
            print("💾 サンプルデータを sample_network.json に保存しました")
            
            return data['sample_data']
        else:
            print(f"❌ サンプルデータ取得失敗: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

def test_validation(network_data):
    """ネットワークデータの検証テスト"""
    print("\n🔍 ネットワークデータの検証テスト")
    
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
            return False
            
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def test_simulation_start(network_data):
    """シミュレーション開始テスト"""
    print("\n🚀 シミュレーション開始テスト")
    
    try:
        # シミュレーション設定
        config = {
            "start_time": datetime.now().isoformat(),
            "duration": 300,  # 5分間
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

def test_simulation_status(simulation_id):
    """シミュレーション状態の監視テスト"""
    print(f"\n📊 シミュレーション状態の監視テスト (ID: {simulation_id})")
    
    try:
        for i in range(10):  # 10回チェック
            response = requests.get(f"{BASE_URL}/network-simulation/status")
            
            if response.status_code == 200:
                status = response.json()
                print(f"⏰ チェック {i+1}: 状態={status['status']}")
                
                if 'current_time' in status:
                    print(f"  🕐 現在時刻: {status['current_time']}")
                
                if 'production_summary' in status:
                    prod_summary = status['production_summary']
                    print(f"  📦 総生産数: {prod_summary.get('total_production', 0)}")
                
                if 'scheduling_analysis' in status:
                    sched_analysis = status['scheduling_analysis']
                    print(f"  🎯 スケジューリング分析: {len(sched_analysis)}工程")
                
                # シミュレーションが完了したら終了
                if status['status'] == 'stopped':
                    print("✅ シミュレーション完了")
                    break
                    
            else:
                print(f"❌ 状態取得失敗: {response.status_code}")
            
            time.sleep(5)  # 5秒待機
            
    except Exception as e:
        print(f"❌ エラー: {e}")

def test_simulation_results(simulation_id):
    """シミュレーション結果の取得テスト"""
    print(f"\n📋 シミュレーション結果の取得テスト (ID: {simulation_id})")
    
    try:
        response = requests.get(f"{BASE_URL}/network-simulation/results")
        
        if response.status_code == 200:
            results = response.json()
            print("✅ 結果取得成功")
            print(f"📊 総イベント数: {results.get('total_events', 0)}")
            print(f"⏱️ 実行時間: {results.get('duration', 0)}秒")
            
            # 生産サマリー
            if 'production_summary' in results:
                prod_summary = results['production_summary']
                print(f"📦 総生産数: {prod_summary.get('total_production', 0)}")
                print(f"🏭 工程別生産数: {prod_summary.get('process_production', {})}")
            
            # スケジューリング分析
            if 'scheduling_analysis' in results:
                sched_analysis = results['scheduling_analysis']
                print(f"🎯 スケジューリング分析: {len(sched_analysis)}工程")
                for process_id, analysis in sched_analysis.items():
                    print(f"  - {process_id}: {analysis.get('status', 'unknown')}")
            
            # 結果をファイルに保存
            with open(f"simulation_results_{simulation_id[:8]}.json", "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"💾 結果を simulation_results_{simulation_id[:8]}.json に保存しました")
            
        else:
            print(f"❌ 結果取得失敗: {response.status_code}")
            
    except Exception as e:
        print(f"❌ エラー: {e}")

def main():
    """メイン実行関数"""
    print("🚀 ネットワークベースシミュレーションテスト開始")
    print("=" * 50)
    
    # 1. サンプルデータの取得
    network_data = test_sample_data()
    if not network_data:
        print("❌ サンプルデータの取得に失敗しました")
        return
    
    # 2. ネットワークデータの検証
    if not test_validation(network_data):
        print("❌ ネットワークデータの検証に失敗しました")
        return
    
    # 3. シミュレーションの開始
    simulation_id = test_simulation_start(network_data)
    if not simulation_id:
        print("❌ シミュレーションの開始に失敗しました")
        return
    
    # 4. シミュレーション状態の監視
    test_simulation_status(simulation_id)
    
    # 5. シミュレーション結果の取得
    test_simulation_results(simulation_id)
    
    print("\n" + "=" * 50)
    print("✅ テスト完了！")

if __name__ == "__main__":
    main()
