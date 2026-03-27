"""
Application configuration settings.
Centralizes hardcoded values for easy management.
"""
import os
from dataclasses import dataclass


@dataclass
class SimulationSettings:
    """Simulation related settings."""

    # Default simulation duration (seconds)
    default_duration: float = float(os.getenv("SIMULATION_DURATION", "3600"))  # 1 hour

    # Time scale (1.0 = realtime)
    default_time_scale: float = float(os.getenv("SIMULATION_TIME_SCALE", "1.0"))

    # Maximum simulation duration (hours)
    max_duration_hours: float = float(os.getenv("SIMULATION_MAX_DURATION_HOURS", "24.0"))

    # State broadcast interval (seconds)
    broadcast_interval: int = int(os.getenv("SIMULATION_BROADCAST_INTERVAL", "1"))

    # State capture intervals based on time scale
    state_capture_slow: int = 60    # For time_scale < 10
    state_capture_medium: int = 45  # For time_scale 10-50
    state_capture_fast: int = 30    # For time_scale > 50


@dataclass
class ProcessSettings:
    """Process and equipment settings."""

    # Default processing time (seconds)
    default_processing_time: float = float(os.getenv("PROCESS_DEFAULT_TIME", "60.0"))

    # Equipment breakdown probability (per hour)
    breakdown_probability: float = float(os.getenv("PROCESS_BREAKDOWN_PROB", "0.001"))

    # Default maintenance time (seconds)
    maintenance_time: int = int(os.getenv("PROCESS_MAINTENANCE_TIME", "3600"))

    # Default buffer size for bottleneck processes
    bottleneck_buffer_size: int = int(os.getenv("PROCESS_BOTTLENECK_BUFFER", "10"))


@dataclass
class TransportSettings:
    """Transport and material flow settings."""

    # Default transport speed (m/s)
    default_speed: float = float(os.getenv("TRANSPORT_DEFAULT_SPEED", "1.0"))

    # Default load capacity (kg)
    default_load_capacity: float = float(os.getenv("TRANSPORT_LOAD_CAPACITY", "100.0"))

    # AGV battery level (%)
    default_battery_level: float = float(os.getenv("TRANSPORT_BATTERY_LEVEL", "100.0"))

    # Default delivery time (seconds)
    default_delivery_time: int = int(os.getenv("TRANSPORT_DELIVERY_TIME", "300"))

    # Traffic density factor
    default_traffic_factor: float = float(os.getenv("TRANSPORT_TRAFFIC_FACTOR", "1.0"))


@dataclass
class KanbanSettings:
    """Kanban system settings."""

    # Default kanban count
    default_kanban_count: int = int(os.getenv("KANBAN_DEFAULT_COUNT", "3"))


@dataclass
class QualitySettings:
    """Quality management settings."""

    # Base rework cost (yen)
    base_rework_cost: int = int(os.getenv("QUALITY_REWORK_COST", "300"))


@dataclass
class MonitoringSettings:
    """Monitoring and analysis settings."""

    # Default monitoring duration (seconds)
    monitoring_duration: int = int(os.getenv("MONITORING_DURATION", "3600"))

    # Analysis window (seconds)
    analysis_window: int = int(os.getenv("MONITORING_ANALYSIS_WINDOW", "1800"))


@dataclass
class WebSocketSettings:
    """WebSocket connection settings."""

    # Connection timeout (seconds)
    timeout: int = int(os.getenv("WEBSOCKET_TIMEOUT", "300"))


@dataclass
class DatabaseSettings:
    """Database connection settings."""

    # Database URL
    url: str = os.getenv("DATABASE_URL", "sqlite:///./prosimulator.db")


@dataclass
class AppSettings:
    """Main application settings."""

    # CORS origins
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")

    # JWT secret
    jwt_secret: str = os.getenv("JWT_SECRET", "development-secret-key")

    # Debug mode
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"


# Singleton instances
simulation_settings = SimulationSettings()
process_settings = ProcessSettings()
transport_settings = TransportSettings()
kanban_settings = KanbanSettings()
quality_settings = QualitySettings()
monitoring_settings = MonitoringSettings()
websocket_settings = WebSocketSettings()
database_settings = DatabaseSettings()
app_settings = AppSettings()


def get_all_settings() -> dict:
    """Get all settings as a dictionary for debugging."""
    from dataclasses import asdict
    return {
        "simulation": asdict(simulation_settings),
        "process": asdict(process_settings),
        "transport": asdict(transport_settings),
        "kanban": asdict(kanban_settings),
        "quality": asdict(quality_settings),
        "monitoring": asdict(monitoring_settings),
        "websocket": asdict(websocket_settings),
        "database": {"url": "***"},  # Hide sensitive data
        "app": {"cors_origins": app_settings.cors_origins, "debug": app_settings.debug},
    }
