# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🏗️ Architecture Overview

This is a mixed-flow production line discrete simulation system with a React TypeScript frontend and FastAPI Python backend. The system simulates complex manufacturing networks with real-time visualization and collaborative editing capabilities.

### Key Components

**Backend (FastAPI + SimPy)**
- `app/core/master_simulator.py` - Main simulation orchestrator
- `app/models/` - Data models (Factory, Process, Buffer, Product)
- `app/api/` - REST API endpoints for simulation control
- `app/websocket/` - WebSocket handlers for real-time communication

**Frontend (React + TypeScript)**
- `src/components/network/NetworkEditor.tsx` - Visual network design interface
- `src/components/simulation/SimulationControl.tsx` - Simulation controls
- `src/store/` - Redux state management
- `src/hooks/useWebSocket.ts` - WebSocket integration

**Simulation Engine**
- SimPy-based discrete event simulation
- Real-time inventory tracking and equipment monitoring
- Multi-product, multi-process manufacturing simulation

## 🔧 Development Commands

### Backend Commands
```bash
cd backend

# Environment setup
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Testing
pytest

# Code quality
black app/
flake8 app/
```

### Frontend Commands
```bash
cd frontend

# Dependencies
npm install

# Development server
npm start

# Build for production
npm run build

# Testing
npm test

# Code quality
npm run lint
npm run format
```

### Quick Start
```bash
# All-in-one development environment
start_dev.bat

# Environment check
check_env.bat

# Setup
setup_env.bat
```

## 🏛️ Data Architecture

### Network Model Structure
- **Nodes**: Process nodes (machining, assembly, inspection, storage) and buffer nodes
- **Edges**: Material flow connections between processes
- **Products**: Multi-variant products with BOM (Bill of Materials)
- **Advanced Process Data**: Detailed process parameters and material requirements

### Simulation Data Flow
1. **Project Data** → `ProjectNetworkData` (database)
2. **Conversion** → `Factory` model (simulation)
3. **Execution** → SimPy environment with real-time events
4. **Monitoring** → WebSocket streams to frontend

### Database Models
- `projects` - Project metadata and settings
- `project_network_data` - Network topology and configurations (JSONB)
- `project_members` - Collaborative editing permissions
- `project_history` - Change tracking

## 🔄 Simulation Engine Integration

### Core Simulation Classes
- `MasterSimulator` - Orchestrates all simulation components
- `EnhancedSimulationEngine` - SimPy-based discrete event engine
- `ProcessSimulator` - Detailed process simulation with equipment
- `MaterialFlowManager` - Inventory and material flow tracking
- `QualityManager` - Quality control and inspection simulation

### Real-time Communication
- WebSocket endpoint: `/ws/simulation`
- Project collaboration: `/api/projects/{project_id}/ws/{user_id}`
- Event types: control, status updates, inventory changes, user activities

## 🎯 Development Patterns

### State Management
- Redux Toolkit for global state
- Separate slices: network, simulation, monitoring, project
- WebSocket integration through custom hooks

### Component Organization
- Feature-based folder structure
- Shared components in `/components/`
- Page-level components in `/pages/`
- Type definitions in `/types/`

### API Integration
- Axios for HTTP requests
- Socket.IO for WebSocket communication
- Type-safe API calls with TypeScript interfaces

## 🧪 Testing Approach

### Backend Testing
```bash
# Run all tests
pytest

# Specific test file
pytest app/api/test_simulation.py

# With coverage
pytest --cov=app
```

### Frontend Testing
```bash
# Run tests
npm test

# Run tests in CI mode
npm test -- --coverage --watchAll=false
```

## 🚀 Key Features to Understand

### Network Editor
- React Flow-based visual editor
- Drag-and-drop process creation
- Real-time collaboration with cursor tracking
- Validation and error checking

### Simulation Control
- Start/pause/resume/stop controls
- Speed adjustment (0.1x to 100x)
- Real-time monitoring dashboards
- KPI calculation and display

### Project Management
- Multi-user collaborative editing
- Version control and history tracking
- Permission-based access control

## 🔧 Common Development Tasks

### Adding New Process Types
1. Update `ProcessNode.tsx` with new node type
2. Add simulation logic in `ProcessSimulator`
3. Update validation in `networkValidator.ts`
4. Add UI components for configuration

### Extending Simulation Features
1. Modify `MasterSimulator` for orchestration
2. Update data models in `app/models/`
3. Add WebSocket events for real-time updates
4. Update frontend monitoring components

### Database Migrations
```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## 📊 Performance Considerations

- Large networks (100+ nodes) may require optimization
- WebSocket message throttling for high-frequency updates
- React Flow performance: use `memo()` for complex nodes
- SimPy simulation: batch event processing for better performance

## 🔍 Debugging Tips

### Backend Issues
- Check logs: simulation events are logged with timestamps
- Use FastAPI automatic docs: `http://localhost:8000/docs`
- WebSocket debugging: monitor connection status in browser dev tools

### Frontend Issues
- Redux DevTools for state inspection
- React DevTools for component debugging
- Network tab for API call inspection
- Console logs for WebSocket message tracking

## 🏃‍♂️ Production Deployment

### Docker Commands
```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Individual services
docker-compose up postgres -d
docker-compose up backend -d
docker-compose up frontend -d
```

### Environment Variables
- Backend: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`
- Frontend: `REACT_APP_API_URL`, `REACT_APP_WS_URL`