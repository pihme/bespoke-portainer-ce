import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';
import {
  ContainerEngine,
  EnvironmentType,
} from '@/react/portainer/environments/types';
import {
  createMockEnvironment,
  createMockUser,
} from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { server } from '@/setup-tests/server';

import { BaseForm, Values } from './BaseForm';

const onChangeName = vi.fn();
const onChangeImageName = vi.fn();
const onRateLimit = vi.fn();

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({ params: { endpointId: 1 } }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsSwarm: () => false,
}));

vi.mock('@@/ImageConfigFieldset', () => ({
  ImageConfigFieldset: function MockImageConfig({
    children,
    onChangeImage,
    onRateLimit,
    setFieldValue,
  }: {
    children?: React.ReactNode;
    onChangeImage?: () => void;
    onRateLimit?: (limited?: boolean) => void;
    setFieldValue: (field: string, value: unknown) => void;
  }) {
    return (
      <div>
        <button type="button" onClick={() => onChangeImage?.()}>
          image-changed
        </button>
        <button type="button" onClick={() => onRateLimit?.(true)}>
          image-rate-limited
        </button>
        <button
          type="button"
          onClick={() => setFieldValue('image', 'nginx:alpine')}
        >
          set-image
        </button>
        {children}
      </div>
    );
  },
}));

vi.mock('@/react/portainer/access-control', () => ({
  AccessControlForm: () => <div>access-control</div>,
}));

vi.mock('./PortsMappingField', () => ({
  PortsMappingField: ({
    onChange,
  }: {
    onChange?: (value: unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange?.([
          { containerPort: '80', hostPort: '8080', protocol: 'tcp' },
        ])
      }
    >
      set-ports
    </button>
  ),
}));

const values: Values = {
  name: '',
  enableWebhook: false,
  publishAllPorts: false,
  image: { image: 'nginx', registryId: 0, useRegistry: true },
  alwaysPull: true,
  ports: [],
  accessControl: {
    ownership: ResourceControlOwnership.ADMINISTRATORS,
    authorizedUsers: [],
    authorizedTeams: [],
  },
  nodeName: '',
  autoRemove: false,
};

describe('REQ-CTR-03 BaseForm local Docker create fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            Type: EnvironmentType.Docker,
            ContainerEngine: ContainerEngine.Docker,
          })
        )
      )
    );
  });

  it('updates name, publish-all, auto-remove and ports', async () => {
    const user = userEvent.setup();
    let latest = values;
    renderBaseForm({
      onValuesChange: (v) => {
        latest = v;
      },
    });

    const name = await screen.findByPlaceholderText('e.g. myContainer');
    await user.type(name, 'web');
    expect(onChangeName).toHaveBeenCalled();
    expect(latest.name).toBe('web');

    await user.click(
      screen.getByText('Publish all exposed ports to random host ports')
    );
    expect(latest.publishAllPorts).toBe(true);

    await user.click(screen.getByText('Auto remove'));
    expect(latest.autoRemove).toBe(true);

    await user.click(screen.getByRole('button', { name: 'set-ports' }));
    expect(latest.ports).toEqual([
      { containerPort: '80', hostPort: '8080', protocol: 'tcp' },
    ]);

    expect(screen.getByText('access-control')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Deploy the container' })
    ).toBeVisible();
  });

  it('forwards image change and rate-limit callbacks', async () => {
    const user = userEvent.setup();
    renderBaseForm();

    await user.click(await screen.findByRole('button', { name: 'image-changed' }));
    expect(onChangeImageName).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'image-rate-limited' }));
    expect(onRateLimit).toHaveBeenCalledWith(true);
  });

  it('toggles always pull off so rate-limit is not forwarded', async () => {
    const user = userEvent.setup();
    renderBaseForm();

    await user.click(await screen.findByText('Always pull the image'));
    await user.click(screen.getByRole('button', { name: 'image-rate-limited' }));
    expect(onRateLimit).not.toHaveBeenCalled();
  });
});

function renderBaseForm({
  onValuesChange,
}: {
  onValuesChange?: (values: Values) => void;
} = {}) {
  function Form() {
    return (
      <Formik initialValues={values} onSubmit={() => undefined}>
        {({ values: current }) => {
          onValuesChange?.(current);
          return (
            <BaseForm
              isLoading={false}
              onChangeName={onChangeName}
              onChangeImageName={onChangeImageName}
              onRateLimit={onRateLimit}
            />
          );
        }}
      </Formik>
    );
  }

  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(Form, createMockUser({ Role: 1 })))
  );
  return render(<Wrapped />);
}
