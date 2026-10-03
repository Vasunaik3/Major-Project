# Backend

Express REST API backed by MongoDB/Mongoose. It includes JWT auth, request validation, centralized errors, local image upload storage, and a simulated sensor publisher. No ESP32, physical sensor, or AI model is required.

## Local setup

1. Install a local MongoDB server and make sure it is running.
2. From this directory, install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set a long, private `JWT_SECRET`.
4. Run `npm run dev`.

Run database-independent alert, image-validation, and report-duration tests with `npm test`. With MongoDB running, `node test/authRbac.integration.js`, `node test/alertLifecycle.integration.js`, `node test/imageApi.integration.js`, and `node test/reportApi.integration.js` exercise the APIs against local data.

Public registration always creates a least-privilege `VIEWER`; it ignores any supplied role. Provision the first administrator by setting `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters), and optionally `BOOTSTRAP_ADMIN_NAME` in `.env`, then run `npm run seed:admin`. Do not commit real secrets.

The API defaults to `http://localhost:5000`. Check `GET /api/health`. When MongoDB connects, the simulator writes a reading every 5 seconds by default. Set `SIMULATOR_ENABLED=false` to disable it.

## Routes

- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Auth session: `POST /api/auth/logout` (revokes the current token version)
- Admin: `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `GET /api/admin/thresholds`, `PUT /api/admin/thresholds`
- System settings: `GET /api/settings`, `PUT /api/settings` (ADMIN only)
- Sensors: `POST /api/sensors/data`, `GET /api/sensors/latest`, `GET /api/sensors/history`
- Alerts: `GET /api/alerts`, `PATCH /api/alerts/:id/resolve`
- Fan: `GET /api/fan/status`, `POST /api/fan/control`
- Dashboard: `GET /api/dashboard/summary`
- Reports: `GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` (date range optional; defaults to the last 7 days)
- Simulator scenarios: `GET /api/simulator/scenario`, `PUT /api/simulator/scenario`
- Images: `POST /api/images` (multipart field `image`), `GET /api/images`, `GET /api/images/:id`
- Predictions: `GET /api/predictions`

Except registration, login, health, and sensor ingestion, routes require `Authorization: Bearer <token>`. Logout increments the user's token version, so previously issued tokens are rejected by protected routes. Sensor ingestion is simulator-oriented; optionally set `SENSOR_INGEST_TOKEN` to require `x-sensor-token`.

Backend role rules: `ADMIN` has full access plus user and threshold management; `OPERATOR` monitors sensors/alerts and can control the fan and upload images; `VIEWER` can view dashboard, sensor history, and reports. Role checks are applied on each request using the current MongoDB user record, so changing a role takes effect even if an old JWT remains in the browser. Logout clears the browser's stored JWT.

Administrator APIs: user management, the legacy threshold endpoints, and `GET/PUT /api/settings`. The settings document stores preferred/critical ranges for temperature, humidity and gas; simulator interval; and fan ON/OFF hysteresis thresholds and minimum run times. Updates are persisted in MongoDB and applied immediately by condition classification, alerts, fan automation and the running simulator. Settings require ordered critical-low < preferred-low < preferred-high < critical-high ranges, fan ON limits above OFF limits, and a simulator interval from 1 second to 1 hour. They apply to simulated readings now and to readings from a future hardware adapter through the same ingestion services.

## Simulator and future ML

The simulator behaves like a local ESP32 publisher: every 5 seconds by default it HTTP POSTs `{ deviceId, temperature, humidity, gasLevel }` to `POST /api/sensors/data`. It uses realistic bounded values (25–35 °C, 55–85% RH, and gas level 100–500) with small sensor-like noise, not independent random samples. The API persists readings and updates condition, alert, and automatic fan records. Sensor submissions are marked `SIMULATED` until a separately designed hardware adapter is added.

Five selectable scenarios are available: `NORMAL`, `HIGH_TEMPERATURE`, `HIGH_HUMIDITY`, `HIGH_GAS`, and `SPOILAGE_RISK`. Stress scenarios ramp toward target values, hold, then recover toward baseline and repeat. Authenticated dashboard clients can read the current state from `GET /api/simulator/scenario` and choose a scenario with `PUT /api/simulator/scenario` and JSON `{ "scenario": "HIGH_GAS" }`. `SIMULATOR_INTERVAL_MS`, phase-duration environment variables, `SIMULATOR_DEVICE_ID`, and `SIMULATOR_API_URL` configure the simulator.

Storage-condition levels are configurable with the `STORAGE_*` variables in `.env.example`. The dashboard summary returns the active limits for temperature, humidity, and gas so the UI can display the rules used to classify conditions. Two or more warning-level parameters, any critical-level parameter, or a continuous abnormal reading for the configured sustained duration makes the overall storage condition `CRITICAL`.

Alerts are tracked per device and condition. Temperature/humidity high, gas abnormality, multiple abnormal parameters, and sensor silence produce `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` events. A still-active event is not recreated every reading; it is replaced only on severity changes or significant value changes after the configured cooldown. Conditions returning to range resolve their alert automatically, and operators can resolve open alerts through the dashboard/API. A background monitor checks for stale devices using `SENSOR_STALE_AFTER_MS` and `ALERT_MONITOR_INTERVAL_MS`.

Fan automation is simulated. In `AUTO`, temperature, humidity, or gas readings above the configured ON limits switch the simulated fan on; lower OFF limits provide hysteresis. Minimum ON and OFF durations prevent rapid switching (`FAN_MIN_ON_DURATION_MS`, `FAN_MIN_OFF_DURATION_MS`). Manual `ON`/`OFF` requests take precedence until `AUTO` mode is selected. Fan activity records are labeled with `simulated: true`; no physical fan or relay is controlled.

Predictions are explicitly unavailable. The prediction service is an adapter seam for a future Python FastAPI model service; no image classification or inference occurs now. Uploaded images are stored locally in `uploads/` and served under `/uploads/` for this prototype.

Image uploads accept JPEG, PNG, and WebP up to `IMAGE_MAX_SIZE_MB`. The API checks both declared MIME type and file signature, stores the file locally, and creates an image record with `analysisStatus: MODEL_NOT_AVAILABLE`; prediction fields stay null. Both image metadata routes and `/uploads/:filename` require an authenticated ADMIN or OPERATOR. The authenticated Onion Analysis page lists images and statuses and displays the unavailable-model message. `GET /api/images/:id` returns the same forward-compatible record shape for future model output.

The Reports API aggregates sensor summaries and time-bucket chart values from MongoDB, counts alerts by severity, and reports warning/critical condition time plus fan activity and history tables. State durations are estimates: condition intervals are capped at `REPORT_MAX_SAMPLE_GAP_MS` (or twice the simulator interval, with a 15-second minimum) so missing telemetry is not treated as continuous state; fan durations follow recorded fan-state transitions. Custom ranges are limited to 366 days. Reports intentionally omit all AI prediction metrics until a model exists.
