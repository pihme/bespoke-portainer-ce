import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

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
    setFieldValue,
    ...rest
  }: {
    children?: React.ReactNode;
    onChangeImage?: () => void;
    setFieldValue: (field: string, value: unknown) => void;
  }) {
    return (
      <div>
        <button type="button" onClick={() => onChangeImage?.()}>
          image-changed
        </button>
        <span data-cy="image-config-props">
          {Object.keys(rest).sort().join(',')}
        </span>
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
  publishAllPorts: false,
  image: { image: 'nginx' },
  alwaysPull: true,
  ports: [],
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

    // REQ-TAI-001: no access control section on the create form
    expect(screen.queryByText('Access control')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Deploy the container' })
    ).toBeVisible();
  });

  it('REQ-TAI-014 shows no container webhook switch', async () => {
    renderBaseForm();

    expect(
      await screen.findByPlaceholderText('e.g. myContainer')
    ).toBeVisible();
    expect(screen.queryByText('Webhook')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Create a container webhook')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('container-webhook-switch')
    ).not.toBeInTheDocument();
  });

  it('forwards image change callbacks', async () => {
    const user = userEvent.setup();
    renderBaseForm();

    await user.click(await screen.findByRole('button', { name: 'image-changed' }));
    expect(onChangeImageName).toHaveBeenCalled();
  });

  it('REQ-TAI-005 passes no rate limit or registry props to the image field', async () => {
    renderBaseForm();

    expect(await screen.findByTestId('image-config-props')).toHaveTextContent(
      /^errors,values$/
    );
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
