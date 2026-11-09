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

## Software-only workflow

```text
Sensor Simulator → Express API → MongoDB → React Dashboard
```

The simulator posts bounded temperature, humidity, and gas-index readings to the same sensor-ingestion endpoint planned for a future ESP32 adapter. The backend stores readings and derives storage conditions, alerts, and simulated fan activity. The authenticated dashboard polls the API and renders returned readings/history; it does not fabricate chart data. Uploaded onion images are stored locally with `MODEL_NOT_AVAILABLE` status and null prediction fields. **AI analysis will be enabled after dataset collection and model training.** No image classification or inference is currently performed.

## Setup and run

Prerequisites: Node.js 18.11 or newer, npm, and a running local MongoDB server.

From the project root, install each app and create its local environment files:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Edit `backend/.env` and set `JWT_SECRET` to a long, private random value. Keep the `.env` file private; it is ignored by Git. MongoDB defaults to `mongodb://127.0.0.1:27017/smart_onion_storage`.

In one terminal, start MongoDB and the backend:

```powershell
cd backend
npm run dev
```

The API listens on `http://localhost:5000`; check `http://localhost:5000/api/health`. When MongoDB connects, the simulator starts publishing every five seconds.

In another terminal, start the frontend:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Register with a name, email, and password, or sign in. Every authenticated account has the same access to the application, including system settings.

## Environment variables

The complete set of defaults and optional tuning variables is documented in [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example). Key settings:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string; defaults to the local `smart_onion_storage` database. |
| `JWT_SECRET` | Required private signing secret for backend startup. |
| `JWT_EXPIRES_IN` | JWT lifetime; defaults to `1d`. |
| `PORT` | Express port; defaults to `5000`. |
| `CLIENT_ORIGIN` | Comma-separated allowed browser origins; defaults to localhost ports `5173`. |
| `VITE_API_URL` | Frontend API base URL; defaults to `http://localhost:5000/api`. |
| `SIMULATOR_ENABLED` | Set to `false` to disable simulated readings. |
| `SIMULATOR_INTERVAL_MS` | Simulator cadence; defaults to `5000` and has a 1-second minimum. |
| `SIMULATOR_DEVICE_ID`, `SIMULATOR_SCENARIO` | Simulated device identifier and initial scenario. |
| `SIMULATOR_API_URL` | Optional ingestion URL override; otherwise points to this backend's sensor endpoint. |
| `SENSOR_INGEST_TOKEN` | Optional shared token required by sensor ingestion and sent by the simulator. |
| `STORAGE_*`, `FAN_*` | Default storage thresholds and simulated fan automation/hysteresis. MongoDB-backed system settings override these live. |
| `IMAGE_MAX_SIZE_MB` | Maximum accepted onion image upload size; defaults to `5`. |

## Testing

Run database-independent service and validation tests:

```powershell
cd backend
npm test
```

Run the API/MongoDB integration checks (registration, login/logout and common authenticated access, alerts, image upload and unavailable-AI response, reports, simulator ingestion, dashboard/history data, and fan automation/manual control):

```powershell
cd backend
npm run test:integration
```

Integration checks require MongoDB. For isolated test data, set `MONGODB_URI` to a disposable test database before running the command, for example:

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/smart_onion_storage_test'
npm run test:integration
```

Build-check the React application with `cd frontend; npm run build`. For a live smoke test, confirm the backend health endpoint, register/sign in, verify telemetry and chart history update, select a stress scenario, check resulting alerts and simulated fan behavior, test image upload, and confirm the image record reports the unavailable-model message with no predicted class or confidence. Verify that protected API requests reject missing/invalid JWTs.

## Extension points

- **ESP32:** replace the simulator publisher with a device adapter that posts `deviceId`, `temperature`, `humidity`, and `gasLevel` to `POST /api/sensors/data`. The ingestion service already validates, stores, and processes these readings. Send `source: "HARDWARE"` and configure `SENSOR_INGEST_TOKEN` for a deployment that requires shared-token protection. Disable the simulator once the hardware publisher is active.
- **AI service:** after collecting a labeled onion-image dataset and training/validating a model, connect an inference service through the backend prediction/image service boundary. Preserve the existing upload and image-record contract; only populate `predictedClass`, `confidence`, `modelVersion`, and analysis status from actual model responses. Keep the explicit unavailable response until inference is implemented and tested.
