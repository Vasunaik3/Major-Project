# Smart Onion Storage

A local-first software prototype for monitoring onion-storage conditions. Sensor readings will be simulated; this scaffold does not require physical IoT hardware and does not include a trained AI/ML model.

## Structure and responsibilities

- `frontend/`: React + Vite browser application and frontend package configuration.
- `frontend/src/components/`: Reusable visual and interaction components.
- `frontend/src/pages/`: Page-level screens, such as dashboard, history, reports, and login.
- `frontend/src/services/`: API clients that communicate with the Node.js REST backend.
- `frontend/src/hooks/`: Reusable React hooks for polling, sensor state, and UI behavior.
- `frontend/src/context/`: Shared application state, such as authentication and dashboard settings.
- `frontend/src/utils/`: Frontend formatting, validation, and small helper functions.
- `frontend/src/App.jsx`: Root React application component.
- `frontend/src/main.jsx`: Vite/React browser entry point.
- `backend/`: Node.js + Express REST API and backend package configuration.
- `backend/src/config/`: Environment and database configuration.
- `backend/src/controllers/`: HTTP request handling and response formatting.
- `backend/src/middleware/`: Authentication, upload, validation, and error-handling middleware.
- `backend/src/models/`: Mongoose schemas and database models.
- `backend/src/routes/`: REST endpoint declarations, separated by feature.
- `backend/src/services/`: Shared authentication, sensor ingestion, alert, storage-condition, fan, and prediction logic.
- `backend/src/simulator/`: Periodic simulated sensor provider; designed to be replaceable by a hardware adapter later.
- `backend/src/server.js`: Loads configuration, connects MongoDB, starts Express and the simulator, and shuts down cleanly.
- `ml-service/`: Documentation and future interface contracts only; no ML implementation until a dataset and trained model exist.
- `docs/`: Architecture, API, schema, simulator, and setup documentation.

## Current status

The frontend now provides an authenticated, responsive dashboard with live API polling, sensor charts, fan controls, alerts, scenario selection, historical reports with CSV export, and an image upload/history page. The backend includes JWT registration/login, MongoDB-backed sensor/history/alert/fan/report APIs, a periodic scenario-based sensor simulator, and local image upload metadata. Uploaded images are not analyzed: prediction responses explicitly report that AI is unavailable. See [frontend/README.md](frontend/README.md) and [backend/README.md](backend/README.md) for local setup, and [docs/database.md](docs/database.md) for schemas and examples.
