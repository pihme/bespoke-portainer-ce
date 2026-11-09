import { renderHook } from '@testing-library/react-hooks';
import { array, object, string } from 'yup';

import { useValidation } from './useValidation';

vi.mock('@/react/portainer/access-control/AccessControlForm', () => ({
  accessControlFormValidation: () => object({}),
}));
vi.mock('@/react/docker/containers/CreateView/NetworkTab/HostnameField', () => ({
  hostnameSchema: string(),
}));
vi.mock('@/react/docker/containers/CreateView/NetworkTab/HostsFileEntries', () => ({
  hostFileSchema: array(),
}));
vi.mock('@/react/docker/containers/CreateView/LabelsTab', () => ({
  labelsTabUtils: { validation: () => array() },
}));
vi.mock('@/react/docker/containers/CreateView/BaseForm/NameField', () => ({
  nameValidation: () => string(),
}));
vi.mock(
  '@/react/docker/containers/CreateView/BaseForm/PortsMappingField.validation',
  () => ({
    validationSchema: () => array(),
  })
);
vi.mock('@/react/docker/containers/CreateView/VolumesTab', () => ({
  volumesTabUtils: { validation: () => array() },
}));

describe('REQ-TPL-01 container deploy useValidation', () => {
  it('builds a schema including env vars from definitions', () => {
    const { result } = renderHook(() =>
      useValidation({
        isAdmin: true,
        envVarDefinitions: [{ name: 'FOO' }],
      })
    );

    expect(
      result.current.isValidSync({
        accessControl: {},
        envVars: { FOO: 'bar' },
        hostname: '',
        hosts: [],
        labels: [],
        name: 'web',
        network: '',
        ports: [],
        volumes: [],
      })
    ).toBe(true);
  });
});
