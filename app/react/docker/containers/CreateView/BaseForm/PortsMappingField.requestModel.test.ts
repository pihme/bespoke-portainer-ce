import { describe, expect, it } from 'vitest';

import { parsePortBindingRequest } from './PortsMappingField.requestModel';
import { PortMapping } from './PortsMappingField';

describe('REQ-CTR-03 parsePortBindingRequest maps create-form ports', () => {
  it('skips rows without a container port', () => {
    const bindings: PortMapping[] = [
      { containerPort: '', hostPort: '8080', protocol: 'tcp' },
    ];

    expect(parsePortBindingRequest(bindings)).toEqual({});
  });

  it('maps a single host and container port', () => {
    const bindings: PortMapping[] = [
      { containerPort: '80', hostPort: '8080', protocol: 'tcp' },
    ];

    expect(parsePortBindingRequest(bindings)).toEqual({
      '80/tcp': [{ HostIp: '', HostPort: '8080' }],
    });
  });

  it('maps a container port range onto sequential host ports', () => {
    const bindings: PortMapping[] = [
      { containerPort: '81-83', hostPort: '8081-8083', protocol: 'tcp' },
    ];

    expect(parsePortBindingRequest(bindings)).toEqual({
      '81/tcp': [{ HostIp: '', HostPort: '8081' }],
      '82/tcp': [{ HostIp: '', HostPort: '8082' }],
      '83/tcp': [{ HostIp: '', HostPort: '8083' }],
    });
  });

  it('keeps a host port range on a single container port', () => {
    const bindings: PortMapping[] = [
      { containerPort: '80', hostPort: '7000-7001', protocol: 'tcp' },
    ];

    expect(parsePortBindingRequest(bindings)).toEqual({
      '80/tcp': [{ HostIp: '', HostPort: '7000-7001' }],
    });
  });

  it('parses host IP prefixes including IPv6 bracket form', () => {
    const bindings: PortMapping[] = [
      { containerPort: '443', hostPort: '127.0.0.1:8443', protocol: 'tcp' },
      {
        containerPort: '53',
        hostPort: '[2001:db8::1]:53',
        protocol: 'udp',
      },
    ];

    expect(parsePortBindingRequest(bindings)).toEqual({
      '443/tcp': [{ HostIp: '127.0.0.1', HostPort: '8443' }],
      '53/udp': [{ HostIp: '2001:db8::1', HostPort: '53' }],
    });
  });

  it('publishes a container port with an empty host binding object', () => {
    const bindings: PortMapping[] = [
      { containerPort: '90', hostPort: '', protocol: 'tcp' },
    ];

    expect(parsePortBindingRequest(bindings)).toEqual({
      '90/tcp': [{}],
    });
  });

  it('rejects an invalid container port', () => {
    expect(() =>
      parsePortBindingRequest([
        { containerPort: '0', hostPort: '80', protocol: 'tcp' },
      ])
    ).toThrow(/Invalid port specification/);
  });

  it('rejects a host range whose length differs from the container range', () => {
    expect(() =>
      parsePortBindingRequest([
        { containerPort: '81-83', hostPort: '8081-8082', protocol: 'tcp' },
      ])
    ).toThrow(/Invalid port specification/);
  });

  it('rejects a malformed IPv6 host binding', () => {
    expect(() =>
      parsePortBindingRequest([
        { containerPort: '80', hostPort: '[2001:db8::1', protocol: 'tcp' },
      ])
    ).toThrow(/Invalid port specification/);
  });
});
