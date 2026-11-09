import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';

import { StackType } from '../../../../../common/stacks/types';

import { duplicateStack } from './useDuplicateStackMutation';

type StackRequestBody = {
  name: string;
  env?: Array<{ name: string; value: string }>;
};

describe('REQ-TAI-003 Swarm stack duplication is gone', () => {
  it('rejects a Docker Swarm stack without calling the API', async () => {
    let apiCalled = false;
    server.use(
      http.all('/api/*', () => {
        apiCalled = true;
        return HttpResponse.json({});
      })
    );

    await expect(
      duplicateStack({
        name: 'swarm-stack',
        fileContent: 'services:\n  app:\n    image: nginx',
        targetEnvironmentId: 2,
        type: StackType.DockerSwarm,
      })
    ).rejects.toThrow('Docker Swarm stacks are no longer supported');
    expect(apiCalled).toBe(false);
  });
});

describe('Standalone stack duplication', () => {
  it('should call createStandaloneStackFromFileContent for non-Swarm stacks', async () => {
    let stackRequestBody: StackRequestBody | undefined;

    server.use(
      http.post('/api/stacks/create/:type/:method', async ({ request }) => {
        stackRequestBody = (await request.json()) as StackRequestBody;
        return HttpResponse.json({ Id: 123 });
      })
    );

    await duplicateStack({
      name: 'standalone-stack',
      fileContent: 'version: "3"\nservices:\n  app:\n    image: nginx',
      targetEnvironmentId: 2,
      type: StackType.DockerCompose,
    });

    expect(stackRequestBody).toBeDefined();
    expect(stackRequestBody?.name).toBe('standalone-stack');
  });

  it('should pass environmentId, name, stackFileContent, env', async () => {
    let stackRequestBody: StackRequestBody | undefined;

    server.use(
      http.post('/api/stacks/create/:type/:method', async ({ request }) => {
        stackRequestBody = (await request.json()) as StackRequestBody;
        return HttpResponse.json({ Id: 123 });
      })
    );

    const fileContent = 'version: "3"\nservices:\n  web:\n    image: nginx';
    const env = [{ name: 'PORT', value: '8080' }];

    await duplicateStack({
      name: 'compose-stack',
      fileContent,
      targetEnvironmentId: 5,
      type: StackType.DockerCompose,
      env,
    });

    expect(stackRequestBody).toBeDefined();
    expect(stackRequestBody?.name).toBe('compose-stack');
    expect(stackRequestBody?.env).toEqual(env);
  });
});

describe('error handling', () => {
  it('should propagate errors from createStandaloneStackFromFileContent', async () => {
    server.use(
      http.post('/api/stacks/create/:type/:method', () =>
        HttpResponse.json(
          { message: 'Stack name already exists' },
          { status: 409 }
        )
      )
    );

    await expect(
      duplicateStack({
        name: 'existing-stack',
        fileContent: 'version: "3"\nservices:\n  app:\n    image: nginx',
        targetEnvironmentId: 2,
        type: StackType.DockerCompose,
      })
    ).rejects.toThrow();
  });
});
