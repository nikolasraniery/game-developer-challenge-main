import { httpClient } from '../api/httpClient';
import type { DemoStatus } from '../../types/api';

export async function fetchDemoStatus(): Promise<DemoStatus> {
  const response = await httpClient.get<DemoStatus>('/demo-status');
  return response.data;
}
