# Frontend dashboard

Responsive React + Vite dashboard using Bootstrap utilities/CSS and Recharts. It authenticates against the Express API, polls dashboard/sensor/alert endpoints, controls the simulated fan and simulator scenario, and uploads onion images without claiming to analyze them.

## Run locally

1. From this directory, run `npm install`.
2. Copy `.env.example` to `.env` if the API is not at `http://localhost:5000/api`; set `VITE_API_URL` to the API base URL.
3. Start the backend and MongoDB, then run `npm run dev`.
4. Register an account or sign in. New registrations receive the `VIEWER` role; administrators are provisioned with `npm run seed:admin` from the backend and can assign operator access. The dashboard refreshes backend data every five seconds.

Protected sections follow the account role: `ADMIN` gets all sections and system settings, `OPERATOR` gets storage monitoring, alerts, fan controls, and onion image uploads, and `VIEWER` gets the dashboard, sensor history, and reports. The backend independently enforces these permissions; hiding a section in React is not the security boundary.

Administrator System Settings persist sensor preferred/critical ranges, simulator cadence, and automatic fan thresholds/minimum run durations through `PUT /api/settings`. These values are applied by the backend simulator and rule services without editing environment variables or restarting.

Logout calls the API to revoke the current token version, then clears the browser session. A JWT is revalidated against the current user on page load; role changes therefore apply without waiting for a token refresh.

The charts display only API readings; there is no fabricated fallback telemetry. Image previews are local to the browser. The UI shows “AI model integration pending dataset and model training.” unless a future API response supplies `predictedClass` and `confidence`.
