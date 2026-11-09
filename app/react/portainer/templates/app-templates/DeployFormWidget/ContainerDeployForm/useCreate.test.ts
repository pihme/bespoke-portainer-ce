import { renderHook, act } from '@testing-library/react-hooks';

import { TemplateType } from '../../types';
import { TemplateViewModel } from '../../view-model';

import { useCreate } from './useCreate';

const go = vi.fn();
const createVolumesMutate = vi.fn();
const createContainerMutate = vi.fn();
const notifySuccess = vi.fn();
const createContainerConfiguration = vi.fn(() => ({ Image: 'nginx:latest' }));

vi.mock('@uirouter/react', () => ({
  useRouter: () => ({ stateService: { go } }),
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));
const environmentData = vi.fn(() => ({ Id: 3, Name: 'local' }));
vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: () => ({
    get data() {
      return environmentData();
    },
  }),
}));
vi.mock('@/react/docker/containers/CreateView/useCreateMutation', () => ({
  useCreateOrReplaceMutation: () => ({
    mutate: createContainerMutate,
    isLoading: false,
  }),
}));
vi.mock('./useCreateLocalVolumes', () => ({
  useCreateLocalVolumes: () => ({
    mutate: createVolumesMutate,
    isLoading: false,
  }),
}));
vi.mock('./createContainerConfig', () => ({
  createContainerConfiguration: (...args: unknown[]) =>
    createContainerConfiguration(...args),
}));

function template(): TemplateViewModel {
  return {
    Id: 1,
    Title: 'Nginx',
    Type: TemplateType.Container,
    RegistryModel: { Image: 'nginx:latest' },
  } as TemplateViewModel;
}

describe('REQ-TPL-01 useCreate for container deploy', () => {
  beforeEach(() => {
    go.mockReset();
    createVolumesMutate.mockReset();
    createContainerMutate.mockReset();
    notifySuccess.mockReset();
    createContainerConfiguration.mockClear();
    environmentData.mockReturnValue({ Id: 3, Name: 'local' });
  });

  it('returns null when the environment is missing', () => {
    environmentData.mockReturnValue(undefined);
    const { result } = renderHook(() => useCreate(template()));
    expect(result.current).toBeNull();
  });

  it('creates auto volumes then the container and navigates on success', () => {
    createVolumesMutate.mockImplementation((_count, opts) => {
      opts.onSuccess([{ Name: 'vol-a' }, { Name: 'vol-b' }]);
    });
    createContainerMutate.mockImplementation((_payload, opts) => {
      opts.onSuccess();
    });

    const { result } = renderHook(() => useCreate(template()));
    expect(result.current).not.toBeNull();

    act(() => {
      result.current!.onSubmit({
        name: 'web',
        network: 'bridge',
        ports: [],
        volumes: [
          {
            containerPath: '/data',
            type: 'volume',
            name: 'auto',
            readOnly: false,
          },
          {
            containerPath: '/logs',
            type: 'volume',
            name: 'auto',
            readOnly: false,
          },
          {
            containerPath: '/etc',
            type: 'bind',
            name: '/host/etc',
            readOnly: true,
          },
        ],
        hosts: [],
        labels: [],
        hostname: '',
        envVars: {},
      });
    });

    expect(createVolumesMutate).toHaveBeenCalledWith(2, expect.any(Object));
    expect(createContainerConfiguration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        volumes: [
          expect.objectContaining({ name: 'vol-a' }),
          expect.objectContaining({ name: 'vol-b' }),
          expect.objectContaining({ name: '/host/etc' }),
        ],
      })
    );
    expect(createContainerMutate).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith(
      'Success',
      'Container successfully created'
    );
    expect(go).toHaveBeenCalledWith('docker.containers');
  });
});
