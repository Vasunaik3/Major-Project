import { SIMULATION_SCENARIOS, getSensorSimulatorStatus, setSensorScenario } from '../simulator/sensorSimulator.js';

export function simulatorStatus(_request, response) {
  response.json(getSensorSimulatorStatus());
}

export function updateSimulatorScenario(request, response) {
  response.json({ simulator: setSensorScenario(request.body.scenario) });
}

export function validateScenario(body) {
  if (!SIMULATION_SCENARIOS.includes(body.scenario)) {
    return [`scenario must be one of: ${SIMULATION_SCENARIOS.join(', ')}.`];
  }
  return [];
}
