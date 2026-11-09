import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';

import { StackType } from '../../../../../common/stacks/types';

import { routeMigrationRequest } from './useMigrateStackMutation';

type MigrateRequestBody = {
  EndpointID: number;
  Name?: string;
  SwarmID?: string;
};

describe('REQ-TAI-003 Swarm stack migration is gone', () => {
  it('rejects a Docker Swarm stack without calling the API', async () => {
    let apiCalled = false;
    server.use(
      http.all('/api/*', () => {
        apiCalled = true;
        return HttpResponse.json({});
      })
    );

    await expect(
      routeMigrationRequest({
        stackType: StackType.DockerSwarm,
        id: 1,
        fromEnvId: 1,
        targetEnvId: 2,
      })
    ).rejects.toThrow('Docker Swarm stacks are no longer supported');
    expect(apiCalled).toBe(false);
  });
});

describe('Standalone stack migration', () => {
  it('should call migrateStack without a Swarm ID for standalone stacks', async () => {
    let migrateRequestBody: MigrateRequestBody | undefined;

    server.use(
      http.post('/api/stacks/:id/migrate', async ({ request }) => {
        migrateRequestBody = (await request.json()) as MigrateRequestBody;
        return HttpResponse.json({});
      })
    );

    await routeMigrationRequest({
      stackType: StackType.DockerCompose,
      id: 3,
      fromEnvId: 1,
      targetEnvId: 2,
      name: 'compose-stack',
    });

    expect(migrateRequestBody).toBeDefined();
    expect(migrateRequestBody?.SwarmID).toBeUndefined();
  });

  it('should pass id, fromEnvId, targetEnvId, name', async () => {
    let migrateRequestBody: MigrateRequestBody | undefined;
    let migrateRequestParams: { endpointId: string | null } | undefined;
    let stackId: string | undefined;

    server.use(
      http.post('/api/stacks/:id/migrate', async ({ request, params }) => {
        migrateRequestBody = (await request.json()) as MigrateRequestBody;
        stackId = params.id as string;
        const url = new URL(request.url);
        migrateRequestParams = {
          endpointId: url.searchParams.get('endpointId'),
        };
        return HttpResponse.json({});
      })
    );

    await routeMigrationRequest({
      stackType: StackType.DockerCompose,
      id: 7,
      fromEnvId: 4,
      targetEnvId: 5,
      name: 'my-stack',
    });

    expect(stackId).toBe('7');
    expect(migrateRequestBody?.EndpointID).toBe(5);
    expect(migrateRequestBody?.Name).toBe('my-stack');
    expect(migrateRequestParams?.endpointId).toBe('4');
  });
});

describe('API request structure', () => {
  it('should POST to correct URL (buildStackUrl(id, "migrate"))', async () => {
    let requestPath: string | undefined;

    server.use(
      http.post('/api/stacks/:id/migrate', ({ request }) => {
        requestPath = new URL(request.url).pathname;
        return HttpResponse.json({});
      })
    );

    await routeMigrationRequest({
      stackType: StackType.DockerCompose,
      id: 123,
      fromEnvId: 1,
      targetEnvId: 2,
    });

    expect(requestPath).toBe('/api/stacks/123/migrate');
  });

  it('should include EndpointID and Name in request body', async () => {
    let requestBody: MigrateRequestBody | undefined;

    server.use(
      http.post('/api/stacks/:id/migrate', async ({ request }) => {
        requestBody = (await request.json()) as MigrateRequestBody;
        return HttpResponse.json({});
      })
    );

    await routeMigrationRequest({
      stackType: StackType.DockerCompose,
      id: 10,
      fromEnvId: 1,
      targetEnvId: 3,
      name: 'test-stack',
    });

    expect(requestBody).toBeDefined();
    expect(requestBody).toHaveProperty('EndpointID');
    expect(requestBody).toHaveProperty('Name');
    expect(requestBody?.EndpointID).toBe(3);
    expect(requestBody?.Name).toBe('test-stack');
  });

  it('should include endpointId in query params (fromEnvId)', async () => {
    let queryParams: URLSearchParams | undefined;

    server.use(
      http.post('/api/stacks/:id/migrate', ({ request }) => {
        queryParams = new URL(request.url).searchParams;
        return HttpResponse.json({});
      })
    );

    await routeMigrationRequest({
      stackType: StackType.DockerCompose,
      id: 10,
      fromEnvId: 7,
      targetEnvId: 3,
    });

    expect(queryParams?.get('endpointId')).toBe('7');
  });
});

describe('error handling', () => {
  it('should parse axios errors correctly', async () => {
    server.use(
      http.post('/api/stacks/:id/migrate', () =>
        HttpResponse.json(
          { message: 'Migration failed', details: 'Stack not found' },
          { status: 404 }
        )
      )
    );

    await expect(
      routeMigrationRequest({
        stackType: StackType.DockerCompose,
        id: 999,
        fromEnvId: 1,
        targetEnvId: 2,
      })
    ).rejects.toThrow();
  });

  it('should propagate errors from API call', async () => {
    server.use(
      http.post('/api/stacks/:id/migrate', () =>
        HttpResponse.json(
          { message: 'Insufficient permissions' },
          { status: 403 }
        )
      )
    );

    await expect(
      routeMigrationRequest({
        stackType: StackType.DockerCompose,
        id: 1,
        fromEnvId: 1,
        targetEnvId: 2,
      })
    ).rejects.toThrow();
  });

  it('should handle network errors', async () => {
    server.use(
      http.post('/api/stacks/:id/migrate', () => HttpResponse.error())
    );

    await expect(
      routeMigrationRequest({
        stackType: StackType.DockerCompose,
        id: 1,
        fromEnvId: 1,
        targetEnvId: 2,
      })
    ).rejects.toThrow();
  });
});
