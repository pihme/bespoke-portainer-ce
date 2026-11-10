import { http, HttpResponse } from 'msw';

import { StatusResponse } from '@/react/portainer/system/useSystemStatus';
import { VersionResponse } from '@/react/portainer/system/useSystemVersion';

import { dockerHandlers } from './setup-handlers/docker';
import { endpointsHandlers } from './setup-handlers/endpoints';
import { settingsHandlers } from './setup-handlers/settings';
import { templatesHandlers } from './setup-handlers/templates';
import { gitopsHandlers } from './setup-handlers/gitops';

export const handlers = [
  ...endpointsHandlers,
  ...settingsHandlers,
  ...templatesHandlers,
  ...dockerHandlers,
  ...gitopsHandlers,
  http.get('/api/stacks', () => HttpResponse.json([])),

  http.get<never, never, Partial<StatusResponse>>('/api/status', () =>
    HttpResponse.json({})
  ),
  http.get<never, never, Partial<StatusResponse>>('/api/system/status', () =>
    HttpResponse.json({})
  ),
  http.get<never, never, Partial<VersionResponse>>('/api/system/version', () =>
    HttpResponse.json({ ServerVersion: 'v2.10.0' })
  ),
  http.get('/api/observability/alerting/settings', () => HttpResponse.json([])),
  http.get('/observability/alerting/rules', () => HttpResponse.json([])),

  http.get('/api/system/info', () => HttpResponse.json({})),
  http.get('/api/policies', () => HttpResponse.json([])),
];
