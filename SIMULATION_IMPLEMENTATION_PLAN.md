# ProSimNez シミュレーター実装計画書

## プロジェクト概要

ProSimNezは、製造業における複雑な工程ネットワークのシミュレーションを行うツールです。各工程の条件や搬送条件を加味して、ものの流れを時間軸で可視化し、生産性の最適化を支援します。

## 現在の実装状況分析

### フロントエンド（React + TypeScript）
- **NetworkEditor**: 工程ネットワークの視覚的編集機能
- **工程ノード**: 機械加工、組立、検査、保管、ストアの5種類
- **接続管理**: 工程間の搬送条件設定
- **材料管理**: BOMベースの材料フロー管理
- **品質管理**: 良品・不良品の追跡システム

### バックエンド（Python + FastAPI）
- **SimPyベース**: 基本的な離散イベントシミュレーションエンジン
- **データモデル**: Factory, Process, Product, Buffer等の基本構造
- **WebSocket**: リアルタイム通信の基盤

### データ構造
- **工程データ**: サイクルタイム、段取り時間、設備数、作業者数
- **搬送データ**: 搬送時間、ロットサイズ、コスト、距離
- **製品データ**: BOM、品質情報、コスト情報

## シミュレーター実装計画

### Phase 1: 基盤システムの構築（Week 1-2）

#### 1.1 シミュレーションエンジンの強化
**現在の状態**: 基本的なSimPyベースのエンジンが存在
**実装すべき機能**:
```python
class EnhancedSimulationEngine:
    def __init__(self, factory_config, simulation_config):
        self.env = simpy.Environment()
        self.time_manager = TimeManager()
        self.event_queue = PriorityEventQueue()
        self.resource_manager = ResourceManager()
        self.statistics_collector = StatisticsCollector()
    
    async def run_simulation(self):
        """非同期シミュレーション実行"""
        # 初期化処理
        await self.initialize_simulation()
        
        # メインループ
        while self.env.now < self.simulation_duration:
            await self.process_events()
            await self.update_statistics()
            await self.notify_clients()
            
        return self.get_simulation_results()
```

#### 1.2 データモデルの統合
**実装すべき機能**:
- フロントエンドのNetworkEditorデータとの完全統合
- リアルタイムデータ同期（WebSocket + Redis）
- データ永続化とバージョン管理
- 設定変更の即座反映

#### 1.3 設定ファイルシステム
**実装すべき機能**:
```yaml
# simulation_config.yaml
simulation:
  duration_minutes: 480
  speed: 1.0
  time_step: 1.0
  
processes:
  machining:
    default_cycle_time: 60
    default_setup_time: 300
    equipment_types: ["CNC", "Lathe", "Mill"]
    
  assembly:
    default_cycle_time: 120
    default_setup_time: 600
    operator_skills: ["basic", "advanced"]
    
transport:
  conveyor:
    speed: 0.5  # m/s
    capacity: 100  # items/hour
    
  agv:
    speed: 1.0  # m/s
    battery_life: 8  # hours
```

### Phase 2: コアシミュレーション機能（Week 3-4）

#### 2.1 工程シミュレーション
**実装すべき機能**:
```python
class ProcessSimulator:
    def __init__(self, process_data, equipment_data):
        self.process = process_data
        self.equipment = equipment_data
        self.input_buffer = Buffer()
        self.output_buffer = Buffer()
        self.operators = []
        
    async def simulate_process(self):
        """工程の詳細シミュレーション"""
        while True:
            # 入力バッファから材料を取得
            material = await self.input_buffer.get_material()
            if not material:
                await self.env.timeout(1)
                continue
                
            # 設備の利用可能性をチェック
            equipment = await self.get_available_equipment()
            
            # 段取り時間
            if self.needs_setup(material):
                await self.perform_setup(equipment)
                
            # 加工実行
            processing_time = self.calculate_processing_time(material)
            await self.env.timeout(processing_time)
            
            # 品質チェック
            quality_result = await self.quality_check(material)
            
            # 出力バッファに製品を追加
            await self.output_buffer.add_product(material, quality_result)
```

#### 2.2 材料フロー管理
**実装すべき機能**:
```python
class MaterialFlowManager:
    def __init__(self, bom_data, inventory_data):
        self.bom = bom_data
        self.inventory = inventory_data
        self.kanban_system = KanbanSystem()
        
    async def manage_material_flow(self):
        """材料フローの管理"""
        # BOMに基づく材料要求
        material_requirements = self.calculate_requirements()
        
        # 在庫チェック
        available_materials = self.check_inventory(material_requirements)
        
        # 不足材料の調達
        if not available_materials:
            await self.trigger_procurement(material_requirements)
            
        # かんばんカードの管理
        await self.manage_kanban_cards()
```

#### 2.3 搬送・物流シミュレーション
**実装すべき機能**:
```python
class TransportSimulator:
    def __init__(self, transport_config):
        self.transport_type = transport_config.type
        self.speed = transport_config.speed
        self.capacity = transport_config.capacity
        self.current_load = 0
        
    async def simulate_transport(self, source, destination, materials):
        """搬送のシミュレーション"""
        # 搬送時間の計算
        distance = self.calculate_distance(source, destination)
        transport_time = distance / self.speed
        
        # ロットサイズの最適化
        optimal_lot_size = self.optimize_lot_size(materials)
        
        # 搬送実行
        await self.env.timeout(transport_time)
        
        # 搬送完了イベント
        await self.notify_transport_complete(materials)
```

### Phase 3: 高度なシミュレーション機能（Week 5-6）

#### 3.1 品質管理シミュレーション
**実装すべき機能**:
```python
class QualityManagementSimulator:
    def __init__(self, quality_config):
        self.defect_rates = quality_config.defect_rates
        self.inspection_methods = quality_config.inspection_methods
        self.rework_processes = quality_config.rework_processes
        
    async def simulate_quality_check(self, product, process):
        """品質チェックのシミュレーション"""
        # 不良率の確率的判定
        defect_probability = self.calculate_defect_probability(product, process)
        is_defective = random.random() < defect_probability
        
        if is_defective:
            # 不良品の処理
            defect_type = self.classify_defect(product)
            rework_required = self.check_rework_requirement(defect_type)
            
            if rework_required:
                await self.schedule_rework(product, defect_type)
            else:
                await self.dispose_defective_product(product)
        
        return QualityResult(
            is_defective=is_defective,
            defect_type=defect_type if is_defective else None,
            rework_required=rework_required if is_defective else False
        )
```

#### 3.2 スケジューリング最適化
**実装すべき機能**:
```python
class SchedulingOptimizer:
    def __init__(self, scheduling_config):
        self.scheduling_mode = scheduling_config.mode  # push/pull
        self.optimization_algorithm = scheduling_config.algorithm
        self.constraints = scheduling_config.constraints
        
    async def optimize_schedule(self, processes, orders):
        """スケジュールの最適化"""
        if self.scheduling_mode == "push":
            return await self.push_scheduling(processes, orders)
        else:
            return await self.pull_scheduling(processes, orders)
            
    async def push_scheduling(self, processes, orders):
        """プッシュ型スケジューリング"""
        # 優先度ベースのスケジューリング
        prioritized_orders = self.prioritize_orders(orders)
        
        # リソース競合の解決
        resolved_schedule = await self.resolve_resource_conflicts(prioritized_orders)
        
        return resolved_schedule
```

#### 3.3 リアルタイム監視
**実装すべき機能**:
```python
class RealTimeMonitor:
    def __init__(self, monitoring_config):
        self.kpi_calculator = KPICalculator()
        self.alert_system = AlertSystem()
        self.dashboard_updater = DashboardUpdater()
        
    async def monitor_simulation(self):
        """シミュレーションのリアルタイム監視"""
        while True:
            # KPI計算
            current_kpis = await self.kpi_calculator.calculate_kpis()
            
            # アラートチェック
            alerts = await self.alert_system.check_alerts(current_kpis)
            
            # ダッシュボード更新
            await self.dashboard_updater.update_dashboard(current_kpis, alerts)
            
            # クライアント通知
            await self.notify_clients(current_kpis, alerts)
            
            await asyncio.sleep(1)  # 1秒間隔で更新
```

### Phase 4: 分析・最適化機能（Week 7-8）

#### 4.1 統計分析
**実装すべき機能**:
```python
class StatisticalAnalyzer:
    def __init__(self):
        self.throughput_analyzer = ThroughputAnalyzer()
        self.bottleneck_analyzer = BottleneckAnalyzer()
        self.utilization_analyzer = UtilizationAnalyzer()
        
    async def analyze_simulation_results(self, simulation_data):
        """シミュレーション結果の統計分析"""
        # スループット分析
        throughput_analysis = await self.throughput_analyzer.analyze(simulation_data)
        
        # ボトルネック分析
        bottleneck_analysis = await self.bottleneck_analyzer.analyze(simulation_data)
        
        # 稼働率分析
        utilization_analysis = await self.utilization_analyzer.analyze(simulation_data)
        
        return AnalysisResult(
            throughput=throughput_analysis,
            bottlenecks=bottleneck_analysis,
            utilization=utilization_analysis
        )
```

#### 4.2 最適化アルゴリズム
**実装すべき機能**:
```python
class OptimizationEngine:
    def __init__(self, optimization_config):
        self.genetic_algorithm = GeneticAlgorithm()
        self.simulated_annealing = SimulatedAnnealing()
        self.particle_swarm = ParticleSwarmOptimization()
        
    async def optimize_factory_layout(self, current_layout, constraints):
        """工場レイアウトの最適化"""
        # 遺伝的アルゴリズムによる最適化
        optimized_layout = await self.genetic_algorithm.optimize(
            current_layout, 
            constraints,
            fitness_function=self.calculate_layout_fitness
        )
        
        return optimized_layout
        
    async def optimize_inventory_levels(self, demand_data, cost_data):
        """在庫レベルの最適化"""
        # 粒子群最適化による在庫最適化
        optimal_levels = await self.particle_swarm.optimize(
            demand_data,
            cost_data,
            objective_function=self.calculate_inventory_cost
        )
        
        return optimal_levels
```

## ファクトチェックツールの開発計画

### 1. データ整合性チェッカー

#### 1.1 ネットワーク整合性チェック
```python
class NetworkIntegrityChecker:
    def __init__(self):
        self.connectivity_checker = ConnectivityChecker()
        self.cycle_detector = CycleDetector()
        self.material_flow_checker = MaterialFlowChecker()
        
    async def check_network_integrity(self, network_data):
        """ネットワークの整合性をチェック"""
        results = []
        
        # 接続性チェック
        connectivity_issues = await self.connectivity_checker.check(network_data)
        results.extend(connectivity_issues)
        
        # 循環参照チェック
        cycle_issues = await self.cycle_detector.detect(network_data)
        results.extend(cycle_issues)
        
        # 材料フローチェック
        flow_issues = await self.material_flow_checker.check(network_data)
        results.extend(flow_issues)
        
        return IntegrityCheckResult(
            issues=results,
            severity=self.calculate_overall_severity(results),
            recommendations=self.generate_recommendations(results)
        )
```

#### 1.2 BOM整合性チェック
```python
class BOMIntegrityChecker:
    def __init__(self):
        self.structure_checker = BOMStructureChecker()
        self.quantity_checker = QuantityConsistencyChecker()
        self.dependency_checker = DependencyChecker()
        
    async def check_bom_integrity(self, bom_data):
        """BOMの整合性をチェック"""
        results = []
        
        # BOM構造チェック
        structure_issues = await self.structure_checker.check(bom_data)
        results.extend(structure_issues)
        
        # 数量整合性チェック
        quantity_issues = await self.quantity_checker.check(bom_data)
        results.extend(quantity_issues)
        
        # 依存関係チェック
        dependency_issues = await self.dependency_checker.check(bom_data)
        results.extend(dependency_issues)
        
        return BOMCheckResult(
            issues=results,
            severity=self.calculate_overall_severity(results),
            recommendations=self.generate_recommendations(results)
        )
```

#### 1.3 設定値妥当性チェック
```python
class ConfigurationValidator:
    def __init__(self):
        self.process_validator = ProcessParameterValidator()
        self.time_validator = TimeSettingValidator()
        self.cost_validator = CostSettingValidator()
        
    async def validate_configuration(self, config_data):
        """設定値の妥当性をチェック"""
        results = []
        
        # 工程パラメータの妥当性
        process_issues = await self.process_validator.validate(config_data.processes)
        results.extend(process_issues)
        
        # 時間設定の妥当性
        time_issues = await self.time_validator.validate(config_data.time_settings)
        results.extend(time_issues)
        
        # コスト設定の妥当性
        cost_issues = await self.cost_validator.validate(config_data.cost_settings)
        results.extend(cost_issues)
        
        return ValidationResult(
            issues=results,
            severity=self.calculate_overall_severity(results),
            recommendations=self.generate_recommendations(results)
        )
```

### 2. シミュレーション実行前チェック

#### 2.1 実行可能性チェック
```python
class SimulationFeasibilityChecker:
    def __init__(self):
        self.resource_checker = ResourceAvailabilityChecker()
        self.material_checker = MaterialSufficiencyChecker()
        self.capacity_checker = CapacityConstraintChecker()
        
    async def check_simulation_feasibility(self, factory_data):
        """シミュレーション実行の可能性をチェック"""
        results = []
        
        # リソース可用性チェック
        resource_issues = await self.resource_checker.check(factory_data)
        results.extend(resource_issues)
        
        # 材料充足性チェック
        material_issues = await self.material_checker.check(factory_data)
        results.extend(material_issues)
        
        # 容量制約チェック
        capacity_issues = await self.capacity_checker.check(factory_data)
        results.extend(capacity_issues)
        
        return FeasibilityResult(
            is_feasible=len([r for r in results if r.severity == "critical"]) == 0,
            issues=results,
            recommendations=self.generate_recommendations(results)
        )
```

#### 2.2 パフォーマンス予測
```python
class PerformancePredictor:
    def __init__(self):
        self.throughput_predictor = ThroughputPredictor()
        self.bottleneck_predictor = BottleneckPredictor()
        self.utilization_predictor = UtilizationPredictor()
        
    async def predict_performance(self, factory_data):
        """シミュレーション結果のパフォーマンスを予測"""
        # スループット予測
        throughput_prediction = await self.throughput_predictor.predict(factory_data)
        
        # ボトルネック予測
        bottleneck_prediction = await self.bottleneck_predictor.predict(factory_data)
        
        # 稼働率予測
        utilization_prediction = await self.utilization_predictor.predict(factory_data)
        
        return PerformancePrediction(
            throughput=throughput_prediction,
            bottlenecks=bottleneck_prediction,
            utilization=utilization_prediction,
            confidence_level=self.calculate_confidence_level()
        )
```

### 3. リアルタイム監視チェッカー

#### 3.1 異常検知
```python
class AnomalyDetector:
    def __init__(self):
        self.performance_detector = PerformanceDegradationDetector()
        self.quality_detector = QualityIssueDetector()
        self.resource_detector = ResourceConflictDetector()
        
    async def detect_anomalies(self, realtime_data):
        """リアルタイムデータから異常を検知"""
        anomalies = []
        
        # 性能劣化の検知
        performance_anomalies = await self.performance_detector.detect(realtime_data)
        anomalies.extend(performance_anomalies)
        
        # 品質問題の検知
        quality_anomalies = await self.quality_detector.detect(realtime_data)
        anomalies.extend(quality_anomalies)
        
        # リソース競合の検知
        resource_anomalies = await self.resource_detector.detect(realtime_data)
        anomalies.extend(resource_anomalies)
        
        return AnomalyDetectionResult(
            anomalies=anomalies,
            severity=self.calculate_overall_severity(anomalies),
            immediate_actions=self.generate_immediate_actions(anomalies)
        )
```

#### 3.2 予測アラート
```python
class PredictiveAlert:
    def __init__(self):
        self.issue_predictor = IssuePredictor()
        self.maintenance_predictor = MaintenancePredictor()
        self.delay_predictor = DelayPredictor()
        
    async def generate_predictive_alerts(self, historical_data):
        """予測に基づくアラートを生成"""
        alerts = []
        
        # 今後の問題予測
        issue_alerts = await self.issue_predictor.predict(historical_data)
        alerts.extend(issue_alerts)
        
        # メンテナンスアラート
        maintenance_alerts = await self.maintenance_predictor.predict(historical_data)
        alerts.extend(maintenance_alerts)
        
        # 納期遅延予測
        delay_alerts = await self.delay_predictor.predict(historical_data)
        alerts.extend(delay_alerts)
        
        return PredictiveAlertResult(
            alerts=alerts,
            time_horizon=self.calculate_time_horizon(),
            confidence_level=self.calculate_confidence_level()
        )
```

## ファクトチェックツールの使用方法

### 1. 事前チェック（シミュレーション実行前）

```bash
# ネットワーク整合性チェック
python -m tools.fact_checker --check-network --project-id PROJECT_001

# BOM整合性チェック
python -m tools.fact_checker --check-bom --project-id PROJECT_001

# 設定値妥当性チェック
python -m tools.fact_checker --check-config --project-id PROJECT_001

# 実行可能性チェック
python -m tools.fact_checker --check-feasibility --project-id PROJECT_001

# 包括的チェック
python -m tools.fact_checker --comprehensive-check --project-id PROJECT_001
```

### 2. リアルタイムチェック（シミュレーション実行中）

```bash
# リアルタイム監視開始
python -m tools.fact_checker --monitor-realtime --project-id PROJECT_001

# 異常検知モード
python -m tools.fact_checker --detect-anomalies --project-id PROJECT_001

# 予測アラートモード
python -m tools.fact_checker --predictive-alerts --project-id PROJECT_001

# カスタム監視設定
python -m tools.fact_checker --custom-monitoring --config monitoring_config.yaml
```

### 3. レポート生成

```bash
# 包括的チェックレポート
python -m tools.fact_checker --generate-report --project-id PROJECT_001 --report-type comprehensive

# 特定チェック項目のレポート
python -m tools.fact_checker --generate-report --project-id PROJECT_001 --check-type network --report-type detailed

# カスタムレポート
python -m tools.fact_checker --generate-report --project-id PROJECT_001 --template custom_template.html
```

## 実装の優先順位

### 高優先度（必須）- Week 1-4
1. **ネットワーク整合性チェック**: 基本的な接続性と循環参照の検出
2. **BOM整合性チェック**: 材料フローの論理的整合性
3. **基本的なシミュレーションエンジン**: 工程と搬送の基本シミュレーション
4. **リアルタイムデータ同期**: WebSocketによる双方向通信

### 中優先度（重要）- Week 5-6
1. **品質管理シミュレーション**: 不良率と再加工の処理
2. **スケジューリング最適化**: 基本的なプッシュ・プル型スケジューリング
3. **異常検知システム**: パフォーマンス劣化の検出
4. **パフォーマンス予測**: 基本的な統計予測

### 低優先度（将来拡張）- Week 7-8
1. **高度な最適化アルゴリズム**: 遺伝的アルゴリズム、粒子群最適化
2. **機械学習による予測**: 異常検知の精度向上
3. **3D可視化**: 工場レイアウトの3D表示
4. **モバイル対応**: スマートフォン・タブレット対応

## テスト戦略

### 1. 単体テスト
```python
# テスト例：NetworkIntegrityChecker
class TestNetworkIntegrityChecker:
    async def test_connectivity_check(self):
        checker = NetworkIntegrityChecker()
        test_network = self.create_test_network()
        
        result = await checker.check_connectivity(test_network)
        
        assert len(result.issues) == 0
        assert result.is_valid == True
    
    async def test_cycle_detection(self):
        checker = NetworkIntegrityChecker()
        test_network = self.create_cyclic_network()
        
        result = await checker.check_cycles(test_network)
        
        assert len(result.issues) > 0
        assert any("循環参照" in issue.message for issue in result.issues)
```

### 2. 統合テスト
```python
# テスト例：エンドツーエンドシミュレーション
class TestEndToEndSimulation:
    async def test_complete_simulation_flow(self):
        # 1. ネットワークデータの読み込み
        network_data = await self.load_test_network()
        
        # 2. 整合性チェック
        integrity_checker = NetworkIntegrityChecker()
        integrity_result = await integrity_checker.check_network_integrity(network_data)
        assert integrity_result.is_valid == True
        
        # 3. シミュレーション実行
        simulator = SimulationEngine(network_data)
        simulation_result = await simulator.run_simulation()
        
        # 4. 結果の検証
        assert simulation_result.status == "completed"
        assert len(simulation_result.events) > 0
```

### 3. パフォーマンステスト
```python
# テスト例：大規模ネットワークでの性能
class TestPerformance:
    async def test_large_network_performance(self):
        # 1000工程の大規模ネットワーク
        large_network = self.create_large_network(1000)
        
        start_time = time.time()
        
        # 整合性チェック
        integrity_checker = NetworkIntegrityChecker()
        integrity_result = await integrity_checker.check_network_integrity(large_network)
        
        check_time = time.time() - start_time
        
        # 100ms以内で完了することを確認
        assert check_time < 0.1
        assert integrity_result.is_valid == True
```

## 成功指標

### 技術的指標
- **シミュレーション実行時間**: 目標 < 1秒（小規模ネットワーク）、< 10秒（大規模ネットワーク）
- **チェック実行時間**: 目標 < 100ms（小規模）、< 1秒（大規模）
- **システム稼働率**: 目標 > 99.9%
- **エラー検出率**: 目標 > 95%
- **リアルタイム更新頻度**: 目標 > 10Hz

### ビジネス指標
- **ユーザー満足度**: 目標 > 4.5/5.0
- **問題解決時間短縮**: 目標 > 50%
- **シミュレーション精度向上**: 目標 > 30%
- **運用コスト削減**: 目標 > 20%

## リスク管理

### 技術的リスク
1. **SimPyの性能限界**: 大規模ネットワークでの性能劣化
   - 対策: カスタムイベントエンジンの開発検討、並列処理の導入
   
2. **リアルタイム処理の複雑性**: データ同期の遅延
   - 対策: WebSocket + Redis による高速化、非同期処理の最適化

3. **メモリ使用量の増大**: 長時間シミュレーションでのメモリ不足
   - 対策: ストリーミング処理とデータ圧縮、メモリプールの実装

### スケジュールリスク
1. **機能追加による遅延**: 要件変更による実装時間増加
   - 対策: アジャイル開発とスプリント管理、MVP（最小実行可能製品）の早期リリース

2. **テスト時間の不足**: 品質確保とスケジュールの両立
   - 対策: 継続的テストと自動化、テスト駆動開発（TDD）の採用

### 品質リスク
1. **チェック精度の不足**: 誤検知・見逃し
   - 対策: 機械学習による精度向上、ユーザーフィードバックによる継続改善

2. **ユーザビリティの低下**: 複雑な機能による使いにくさ
   - 対策: ユーザビリティテストと改善サイクル、段階的な機能公開

## 今後の拡張計画

### 短期（3ヶ月以内）
- 基本的なシミュレーション機能の完成
- ファクトチェックツールの基本版リリース
- ユーザーフィードバックの収集と改善

### 中期（6ヶ月以内）
- 高度なシミュレーション機能の追加
- 機械学習による予測機能の実装
- モバイルアプリの開発開始

### 長期（1年以内）
- 3D可視化機能の実装
- クラウド対応とスケーラビリティの向上
- 他システム（ERP、MES等）との連携

## まとめ

この実装計画に従って、段階的に複雑なシミュレーターを構築し、同時にファクトチェックツールを開発することで、高品質で信頼性の高いシステムを実現できます。

各フェーズでの成果物を明確にし、継続的なテストと改善を行うことで、製造業のユーザーのニーズに応える包括的なシミュレーションツールを構築していきましょう。

特に重要なのは、フロントエンドのNetworkEditorで作成された複雑な工程ネットワークを、バックエンドのシミュレーションエンジンで正確に再現し、リアルタイムで監視・分析できるシステムを構築することです。 