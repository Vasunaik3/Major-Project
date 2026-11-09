# Frontend dashboard

Responsive React + Vite dashboard using Bootstrap utilities/CSS and Recharts. It authenticates against the Express API, polls dashboard/sensor/alert endpoints, controls the simulated fan and simulator scenario, and uploads onion images without claiming to analyze them.

## Run locally

1. From this directory, run `npm install`.
2. Copy `.env.example` to `.env` if the API is not at `http://localhost:5000/api`; set `VITE_API_URL` to the API base URL.
3. Start the backend and MongoDB, then run `npm run dev`.
4. Register with a name, email, and password or sign in. All authenticated users have identical access. The dashboard refreshes backend data every five seconds.

System Settings persist sensor preferred/critical ranges, simulator cadence, and automatic fan thresholds/minimum run durations through `PUT /api/settings`. These values are applied by the backend simulator and rule services without editing environment variables or restarting.

Logout calls the API to revoke the current token version, then clears the browser session. A JWT is revalidated against the current user on page load.

The charts display only API readings; there is no fabricated fallback telemetry. Image previews are local to the browser. Uploaded images are not analyzed and prediction fields remain null. The UI and API state: “AI analysis will be enabled after dataset collection and model training.”
