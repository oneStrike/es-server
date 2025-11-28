import type {
  SystemHealthResponse,
  SystemReadyResponse,
} from './types/system.d';

import { requestClient } from '#/utils/request';

/**
 * HealthController_healthCheck
 */
export async function systemHealthApi(): Promise<SystemHealthResponse> {
  return requestClient.get<SystemHealthResponse>('/api/system/health');
}

/**
 * HealthController_readinessCheck
 */
export async function systemReadyApi(): Promise<SystemReadyResponse> {
  return requestClient.get<SystemReadyResponse>('/api/system/ready');
}
