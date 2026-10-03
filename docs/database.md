# MongoDB collections

Each Mongoose schema enables automatic `createdAt` and `updatedAt` fields. The domain-specific `timestamp` or `uploadedAt` records when the sensor event, activity, condition, prediction, or upload occurred; it is deliberately separate from document creation/update times. Collection names below are Mongoose's default pluralized names.

## User — `users`

Stores application accounts. `email` is unique and normalized to lowercase. Store only a password hash; `passwordHash` is excluded from query results by default. The schema does not implement password hashing or authentication itself.

Example document:

```json
{
  "_id": "USER_OBJECT_ID",
  "name": "Storage Operator",
  "email": "operator@example.com",
  "passwordHash": "<bcrypt-hash>",
  "role": "USER",
  "createdAt": "2026-10-03T10:00:00.000Z",
  "updatedAt": "2026-10-03T10:00:00.000Z"
}
```

Indexes: unique `email`.

## SensorReading — `sensorreadings`

Stores each sensor sample. `source` defaults to `SIMULATED`, making software-generated readings distinguishable from future hardware readings. `deviceId` identifies the simulated storage device.

Example document:

```json
{
  "deviceId": "onion-store-01",
  "temperature": 22.4,
  "humidity": 68.2,
  "gasLevel": 140,
  "timestamp": "2026-10-03T10:05:00.000Z",
  "source": "SIMULATED"
}
```

Indexes: `{ deviceId: 1, timestamp: -1 }` for device history; `{ timestamp: -1 }` for latest global readings.

## Alert — `alerts`

Stores threshold and system events, including resolution state. `sensorValue` and `threshold` can be null for alerts that are not tied to a numeric sensor threshold.

Example document:

```json
{
  "type": "TEMPERATURE_HIGH",
  "severity": "MEDIUM",
  "message": "Temperature is abnormally high (31°C; limit 30°C).",
  "deviceId": "SIMULATOR_01",
  "sensorValue": 31,
  "threshold": 30,
  "resolved": false,
  "resolvedAt": null,
  "resolutionReason": null,
  "timestamp": "2026-10-03T10:05:00.000Z"
}
```

Alert severity is `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. Alerts are deduplicated per device and type while unresolved; event changes close the prior event with a resolution reason before opening the new severity/change event. Recovery and operator resolution both record `resolvedAt` and `resolutionReason`. Indexes: `{ resolved: 1, timestamp: -1 }`, `{ severity: 1, timestamp: -1 }`, plus a partial unique index preventing duplicate open alerts for a device/type.

## FanActivity — `fanactivities`

An audit trail of fan state transitions. This is recorded state only; no physical fan is controlled by the current software-only prototype.

Example document:

```json
{
  "mode": "AUTO",
  "status": "ON",
  "reason": "Simulated temperature exceeded the automatic-control threshold.",
  "simulated": true,
  "timestamp": "2026-10-03T10:05:00.000Z"
}
```

The fan has no connected hardware. `AUTO` uses configurable temperature, humidity, and gas thresholds with hysteresis and minimum ON/OFF durations; manual requests persist as `MANUAL` activity with reason `Manual control`. Indexes: `{ timestamp: -1 }` and `{ mode: 1, timestamp: -1 }`.

## StorageCondition — `storageconditions`

Stores the condition assessment history computed from simulated readings and configured rules. It can reference the reading that informed the assessment; no ML prediction is needed to create one.

Example document:

```json
{
  "deviceId": "SIMULATOR_01",
  "condition": "WARNING",
  "status": "WARNING",
  "reason": "Temperature is outside the preferred range",
  "message": "Temperature is outside the preferred range",
  "temperatureStatus": "WARNING",
  "humidityStatus": "NORMAL",
  "gasStatus": "NORMAL",
  "abnormalMetrics": [{ "metric": "temperature", "status": "WARNING" }],
  "sustainedMetrics": [],
  "thresholds": {
    "temperature": { "lowWarning": 25, "highWarning": 30, "lowCritical": 23, "highCritical": 34 },
    "humidity": { "lowWarning": 55, "highWarning": 75, "lowCritical": 45, "highCritical": 85 },
    "gasLevel": { "lowWarning": 100, "highWarning": 300, "lowCritical": 50, "highCritical": 500 }
  },
  "sensorReading": "SENSOR_READING_OBJECT_ID",
  "source": "SIMULATED",
  "timestamp": "2026-10-03T10:05:00.000Z"
}
```

Each reading stores the overall status (`NORMAL`, `WARNING`, or `CRITICAL`), per-sensor statuses, abnormal/sustained metrics, and a snapshot of the active thresholds. Two or more warning-level metrics or any critical-level metric raises the overall state to `CRITICAL`; a single warning stays `WARNING`. Sustained abnormalities are promoted to critical after the configured duration and minimum consecutive samples. `STORAGE_*` environment variables configure these limits, duration, sample count, and allowed reading gaps. All computed states are retained so the latest current condition can return to normal, as well as preserving abnormal history. `source` can distinguish simulated and future hardware readings.

Indexes: `{ timestamp: -1 }`, `{ deviceId: 1, timestamp: -1 }`, and `{ deviceId: 1, condition: 1, timestamp: -1 }`.

## OnionImage — `onionimages`

Stores an image URL/reference and its processing lifecycle state. `NOT_ANALYZED` is the default because image upload and analysis are not yet implemented. The schema does not store the binary image itself.

Example document:

```json
{
  "imageUrl": "uploads/onion-sample-001.jpg",
  "originalName": "onion-sample-001.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 243018,
  "uploadedAt": "2026-10-03T10:10:00.000Z",
  "analysisStatus": "MODEL_NOT_AVAILABLE",
  "predictedClass": null,
  "confidence": null,
  "modelVersion": null,
  "analyzedAt": null
}
```

`analysisStatus` is one of `PENDING`, `PROCESSING`, `COMPLETED`, `MODEL_NOT_AVAILABLE`, or `FAILED`. New uploads use `MODEL_NOT_AVAILABLE`; no prediction or confidence is generated. Nullable prediction fields let a future Python ML service update the same image record. Image bytes are stored in the backend's local `uploads/` directory for this prototype; MongoDB stores their URL and metadata. Indexes: `{ uploadedAt: -1 }` and `{ analysisStatus: 1, uploadedAt: -1 }`.

## Prediction — `predictions`

Reserved for future model outputs and linked to an `OnionImage`. Prediction result fields are nullable. The default status is `NOT_AVAILABLE`; this schema does not run inference and does not imply that AI-based onion detection exists.

Example placeholder document:

```json
{
  "imageId": "ONION_IMAGE_OBJECT_ID",
  "predictedClass": null,
  "confidence": null,
  "modelVersion": null,
  "status": "NOT_AVAILABLE",
  "timestamp": "2026-10-03T10:10:00.000Z"
}
```

`confidence`, when eventually populated, is expected to be in the range 0–1. Indexes: `{ imageId: 1, timestamp: -1 }` and `{ modelVersion: 1, timestamp: -1 }`.

## Implementation notes

- Model files live under `backend/src/models/` and export compiled Mongoose models.
- Mongoose creates declared indexes when the connection initializes (unless automatic index creation is disabled in the environment). In production, manage index creation through deployment/migration practices.
- `timestamps: true` creates `createdAt` and `updatedAt` for every collection. These complement rather than replace the event timestamps in the examples.
