import { Platform } from '../types';

import { AppTemplate, TemplateType } from './types';
import { EnvVarType, TemplateViewModel } from './view-model';

function baseTemplate(
  overrides: Partial<AppTemplate> = {}
): AppTemplate {
  return {
    id: 7,
    type: TemplateType.Container,
    title: 'Nginx',
    description: 'High performance web server',
    administrator_only: false,
    image: 'nginx:latest',
    repository: { url: '', stackfile: '' },
    ...overrides,
  };
}

describe('REQ-TPL-01 TemplateViewModel maps app template JSON', () => {
  it('maps a version-2 container template with defaults', () => {
    const vm = new TemplateViewModel(baseTemplate(), '2');

    expect(vm.Id).toBe(7);
    expect(vm.Title).toBe('Nginx');
    expect(vm.Type).toBe(TemplateType.Container);
    expect(vm.Description).toBe('High performance web server');
    expect(vm.AdministratorOnly).toBe(false);
    expect(vm.Categories).toEqual([]);
    expect(vm.Platform).toBeUndefined();
    expect(vm.Command).toBe('');
    expect(vm.Network).toBe('');
    expect(vm.Privileged).toBe(false);
    expect(vm.Interactive).toBe(false);
    expect(vm.RestartPolicy).toBe('always');
    expect(vm.Labels).toEqual([]);
    expect(vm.Hosts).toEqual([]);
    expect(vm.Env).toEqual([]);
    expect(vm.Volumes).toEqual([]);
    expect(vm.Ports).toEqual([]);
    expect(vm.RegistryModel.Image).toBe('nginx:latest');
    expect(vm.RegistryModel.Registry.URL).toBe('');
  });

  it('maps a version-3 template and keeps the id', () => {
    const vm = new TemplateViewModel(
      baseTemplate({
        id: 42,
        name: 'web',
        note: 'note',
        categories: ['webserver'],
        platform: 'linux',
        logo: 'https://example.com/logo.svg',
        registry: 'quay.io',
        command: 'nginx -g daemon off;',
        network: 'bridge',
        privileged: true,
        interactive: true,
        restart_policy: 'unless-stopped',
        hostname: 'webhost',
        labels: [{ name: 'owner', value: 'ops' }],
        hosts: ['db:10.0.0.2'],
      }),
      '3'
    );

    expect(vm.Id).toBe(42);
    expect(vm.Name).toBe('web');
    expect(vm.Note).toBe('note');
    expect(vm.Categories).toEqual(['webserver']);
    expect(vm.Platform).toBe(Platform.LINUX);
    expect(vm.Logo).toBe('https://example.com/logo.svg');
    expect(vm.RegistryModel.Registry.URL).toBe('quay.io');
    expect(vm.Command).toBe('nginx -g daemon off;');
    expect(vm.Network).toBe('bridge');
    expect(vm.Privileged).toBe(true);
    expect(vm.Interactive).toBe(true);
    expect(vm.RestartPolicy).toBe('unless-stopped');
    expect(vm.Hostname).toBe('webhost');
    expect(vm.Labels).toEqual([{ name: 'owner', value: 'ops' }]);
    expect(vm.Hosts).toEqual(['db:10.0.0.2']);
  });

  it('maps windows platform', () => {
    const vm = new TemplateViewModel(
      baseTemplate({ platform: 'windows' }),
      '2'
    );
    expect(vm.Platform).toBe(Platform.WINDOWS);
  });

  it('rejects unsupported template versions', () => {
    expect(() => new TemplateViewModel(baseTemplate(), '1')).toThrow(
      'Unsupported template version'
    );
  });

  it('parses host and container ports with protocol', () => {
    const vm = new TemplateViewModel(
      baseTemplate({
        ports: ['8080:80/tcp', '53/udp', '443:443/tcp'],
      }),
      '2'
    );

    expect(vm.Ports).toEqual([
      { hostPort: '8080', containerPort: '80', protocol: 'tcp' },
      { hostPort: undefined, containerPort: '53', protocol: 'udp' },
      { hostPort: '443', containerPort: '443', protocol: 'tcp' },
    ]);
  });

  it('parses bind and auto volumes', () => {
    const vm = new TemplateViewModel(
      baseTemplate({
        volumes: [
          { container: '/data', bind: '/tmp/data', readonly: true },
          { container: '/var/log' },
        ],
      }),
      '2'
    );

    expect(vm.Volumes).toEqual([
      {
        container: '/data',
        readonly: true,
        type: 'bind',
        bind: '/tmp/data',
      },
      {
        container: '/var/log',
        readonly: false,
        type: 'auto',
        bind: null,
      },
    ]);
  });

  it('maps text, preset and select env vars', () => {
    const vm = new TemplateViewModel(
      baseTemplate({
        env: [
          {
            name: 'TEXT',
            label: 'Text',
            default: 'hello',
            description: 'desc',
          },
          {
            name: 'PRESET',
            preset: true,
            default: 'secret',
          },
          {
            name: 'CHOICE',
            select: [
              { text: 'One', value: '1', default: false },
              { text: 'Two', value: '2', default: true },
            ],
          },
          {
            name: 'EMPTY_SELECT',
            select: [{ text: 'None', value: 'n', default: false }],
          },
        ],
      }),
      '2'
    );

    expect(vm.Env).toEqual([
      {
        name: 'TEXT',
        label: 'Text',
        description: 'desc',
        default: 'hello',
        preset: undefined,
        select: undefined,
        type: EnvVarType.Text,
        value: 'hello',
      },
      {
        name: 'PRESET',
        label: undefined,
        description: undefined,
        default: 'secret',
        preset: true,
        select: undefined,
        type: EnvVarType.PreSelected,
        value: 'secret',
      },
      {
        name: 'CHOICE',
        label: undefined,
        description: undefined,
        default: undefined,
        preset: undefined,
        select: [
          { text: 'One', value: '1', default: false },
          { text: 'Two', value: '2', default: true },
        ],
        type: EnvVarType.Select,
        value: '2',
      },
      {
        name: 'EMPTY_SELECT',
        label: undefined,
        description: undefined,
        default: undefined,
        preset: undefined,
        select: [{ text: 'None', value: 'n', default: false }],
        type: EnvVarType.Select,
        value: '',
      },
    ]);
  });
});
