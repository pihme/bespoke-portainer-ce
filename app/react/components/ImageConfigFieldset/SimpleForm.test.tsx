import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RegistryTypes } from '@/react/portainer/registries/types/registry';

import { SimpleForm } from './SimpleForm';

const useRegistry = vi.fn();
const useEnvironmentRegistries = vi.fn();
const useImages = vi.fn();

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));
vi.mock('@/react/portainer/registries/queries/useRegistry', () => ({
  useRegistry: (...args: unknown[]) => useRegistry(...args),
}));
vi.mock('@/react/portainer/environments/queries/useEnvironmentRegistries', () => ({
  useEnvironmentRegistries: (...args: unknown[]) =>
    useEnvironmentRegistries(...args),
}));
vi.mock('@/react/docker/proxy/queries/images/useImages', () => ({
  useImages: (...args: unknown[]) => useImages(...args),
}));
vi.mock('@/react/docker/images/utils', () => ({
  imageContainsURL: (image: string) => image.includes('.'),
  getUniqueTagListFromImages: (images: unknown) => images,
}));
vi.mock('@/docker/filters/utils', () => ({
  trimSHA: (v: string) => v,
  trimVersionTag: (v: string) => v,
}));
vi.mock('@@/form-components/PortainerSelect', () => ({
  PortainerSelect: ({
    value,
    onChange,
    options,
  }: {
    value?: number;
    onChange: (v?: number) => void;
    options: Array<{ label: string; value: number }>;
  }) => (
    <select
      aria-label="Registry"
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock('./InputSearch', () => ({
  InputSearch: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <input
      aria-label="Image autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe('REQ-IMG-02 SimpleForm for local Docker images', () => {
  beforeEach(() => {
    useRegistry.mockReset();
    useEnvironmentRegistries.mockReset();
    useImages.mockReset();
    const registries = [
      {
        Id: 1,
        Type: RegistryTypes.DOCKERHUB,
        URL: 'docker.io',
        Name: 'Docker Hub',
      },
      {
        Id: 2,
        Type: RegistryTypes.CUSTOM,
        URL: 'registry.example.com',
        Name: 'Custom',
      },
    ];
    useEnvironmentRegistries.mockImplementation((_id, opts: Record<string, any> = {}) => {
      const data = opts.select ? opts.select(registries) : registries;
      opts.onSuccess?.(data);
      return { data };
    });
    useImages.mockReturnValue({
      data: ['nginx:latest', 'registry.example.com/app:1'],
    });
  });

  it('renders a plain image input and Docker Hub search for Hub registries', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    const onChangeImage = vi.fn();
    useRegistry.mockReturnValue({
      data: {
        Id: 1,
        Type: RegistryTypes.DOCKERHUB,
        URL: 'docker.io',
        Name: 'Docker Hub',
      },
    });

    render(
      <SimpleForm
        values={{ useRegistry: true, registryId: 1, image: 'nginx' }}
        setFieldValue={setFieldValue}
        onChangeImage={onChangeImage}
      />
    );

    expect(screen.getByText('docker.io')).toBeVisible();
    expect(screen.getByRole('link', { name: /Search/i })).toHaveAttribute(
      'href',
      expect.stringContaining('hub.docker.com')
    );
    await user.type(screen.getByLabelText('Image'), ':latest');
    expect(setFieldValue).toHaveBeenCalled();
    expect(onChangeImage).toHaveBeenCalled();
  });

  it('uses autocomplete options filtered for a known custom registry', async () => {
    const user = userEvent.setup();
    const setFieldValue = vi.fn();
    useRegistry.mockReturnValue({
      data: {
        Id: 2,
        Type: RegistryTypes.CUSTOM,
        URL: 'registry.example.com',
        Name: 'Custom',
      },
    });

    render(
      <SimpleForm
        autoComplete
        values={{ useRegistry: true, registryId: 2, image: '' }}
        setFieldValue={setFieldValue}
      />
    );

    expect(screen.getByLabelText('Image autocomplete')).toBeVisible();
    await user.type(screen.getByLabelText('Image autocomplete'), 'app');
    expect(setFieldValue).toHaveBeenCalledWith('image', expect.any(String));
  });

  it('defaults the registry selector when the current id is missing', () => {
    const setFieldValue = vi.fn();
    useRegistry.mockReturnValue({ data: undefined });
    useEnvironmentRegistries.mockImplementation((_id, opts = {}) => {
      const options = [{ label: 'Docker Hub', value: 5 }];
      opts.onSuccess?.(options);
      return { data: options };
    });

    render(
      <SimpleForm
        values={{ useRegistry: true, registryId: 99, image: '' }}
        setFieldValue={setFieldValue}
      />
    );

    expect(setFieldValue).toHaveBeenCalledWith('registryId', 5);
  });
});
