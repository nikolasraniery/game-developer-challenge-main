import { http, HttpResponse } from 'msw';
import { demoStatusFixture } from '../fixtures/demoStatus';

export const demoHandlers = [
  http.get('/api/demo-status', () => HttpResponse.json(demoStatusFixture)),
];
