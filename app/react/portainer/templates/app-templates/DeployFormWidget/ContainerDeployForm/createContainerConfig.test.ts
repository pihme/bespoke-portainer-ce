import { TemplateType } from '../../types';
import { TemplateViewModel } from '../../view-model';

import { createContainerConfiguration } from './createContainerConfig';
import { FormValues } from './types';

function template(
  overrides: Partial<TemplateViewModel> = {}
): TemplateViewModel {
  return {
    Id: 1,
    Title: 'Nginx',
    Type: TemplateType.Container,
    Description: 'web',
    AdministratorOnly: false,
    Categories: [],
    Privileged: true,
    Interactive: true,
    RestartPolicy: 'unless-stopped',
    Command: 'nginx -g "daemon off;"',
    RegistryModel: { Image: 'nginx:latest', Registry: {}, UseRegistry: true },
    Ports: [],
    Volumes: [],
    Env: [],
    ...overrides,
  } as TemplateViewModel;
}

function values(overrides: Partial<FormValues> = {}): FormValues {
  return {
    name: 'web',
    network: 'bridge',
    accessControl: {} as FormValues['accessControl'],
    ports: [{ hostPort: '8080', containerPort: '80', protocol: 'tcp' }],
    volumes: [],
    hosts: ['db:10.0.0.2'],
    labels: [
      { name: 'owner', value: 'ops' },
      { name: '', value: 'ignored' },
    ],
    hostname: 'webhost',
    envVars: { FOO: 'bar', EMPTY: undefined },
    ...overrides,
  };
}

describe('REQ-TPL-01 createContainerConfiguration', () => {
  it('maps template and form values into a create request', () => {
    const config = createContainerConfiguration(template(), values());

    expect(config.Image).toBe('nginx:latest');
    expect(config.Hostname).toBe('webhost');
    expect(config.HostConfig.NetworkMode).toBe('bridge');
    expect(config.HostConfig.Privileged).toBe(true);
    expect(config.HostConfig.RestartPolicy).toEqual({
      Name: 'unless-stopped',
    });
    expect(config.HostConfig.ExtraHosts).toEqual(['db:10.0.0.2']);
    expect(config.Env).toEqual(['FOO=bar', 'EMPTY=undefined']);
    expect(config.OpenStdin).toBe(true);
    expect(config.Tty).toBe(true);
    expect(config.Labels).toEqual({ owner: 'ops' });
    expect(config.HostConfig.PortBindings).toEqual({
      '80/tcp': [{ HostIp: '', HostPort: '8080' }],
    });
    expect(config.ExposedPorts).toEqual({ '80/tcp': {} });
    expect(config.Cmd).toEqual(['nginx', '-g', 'daemon off;']);
  });

  it('disables console flags when the template is not interactive', () => {
    const config = createContainerConfiguration(
      template({ Interactive: false }),
      values({ hosts: undefined as unknown as string[] })
    );

    expect(config.OpenStdin).toBe(false);
    expect(config.Tty).toBe(false);
    expect(config.HostConfig.ExtraHosts).toEqual([]);
  });
});
