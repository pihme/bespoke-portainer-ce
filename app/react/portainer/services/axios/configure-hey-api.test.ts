import { createClientConfig } from './configure-hey-api';
import axios from './axios';

describe('createClientConfig', () => {
  it('injects the shared axios instance into the hey-api client config', () => {
    const config = createClientConfig({ baseUrl: '/api' } as never);
    expect(config).toMatchObject({ baseUrl: '/api', axios });
  });
});
