import { http, HttpResponse } from 'msw';

import {
  Edition,
  LicenseInfo,
  LicenseType,
} from '@/react/portainer/licenses/types';
import { StatusResponse } from '@/react/portainer/system/useSystemStatus';
import { VersionResponse } from '@/react/portainer/system/useSystemVersion';

import { dockerHandlers } from './setup-handlers/docker';
import { endpointsHandlers } from './setup-handlers/endpoints';
import { settingsHandlers } from './setup-handlers/settings';
import { templatesHandlers } from './setup-handlers/templates';
import { gitopsHandlers } from './setup-handlers/gitops';

const licenseInfo: LicenseInfo = {
  nodes: 1000,
  type: LicenseType.Subscription,
  company: 'company',
  createdAt: 0,
  email: 'email@company.com',
  expiresAt: Number.MAX_SAFE_INTEGER,
  productEdition: Edition.EE,
  valid: true,
  enforcedAt: 0,
  enforced: false,
};

export const handlers = [
  ...endpointsHandlers,
  ...settingsHandlers,
  ...templatesHandlers,
  ...dockerHandlers,
  ...gitopsHandlers,
  http.get('/api/stacks', () => HttpResponse.json([])),
  http.get('/api/licenses/info', () => HttpResponse.json(licenseInfo)),
  http.get('/api/status/nodes', () => HttpResponse.json({ nodes: 3 })),

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
  http.get('/api/webhooks', () => HttpResponse.json([])),
  http.get('/api/policies', () => HttpResponse.json([])),
];
