import { describe, it, expect } from 'vitest';

import {
  EndpointGroupDefaultModel,
  EndpointGroupModel,
  EndpointGroupCreateRequest,
  EndpointGroupUpdateRequest,
} from './group';

describe('REQ-ENV-13 EndpointGroupDefaultModel', () => {
  it('starts with empty name, description, tags and associations', () => {
    const model = new EndpointGroupDefaultModel();
    expect(model.Name).toBe('');
    expect(model.Description).toBe('');
    expect(model.TagIds).toEqual([]);
    expect(model.AssociatedEndpoints).toEqual([]);
  });
});

describe('REQ-ENV-13 EndpointGroupModel mapping', () => {
  it('maps group fields and defaults missing access policies to empty objects', () => {
    const model = new EndpointGroupModel({
      Id: 4,
      Name: 'production',
      Description: 'prod group',
      TagIds: [1, 2],
      AuthorizedUsers: [7],
      AuthorizedTeams: [3],
    });

    expect(model.Id).toBe(4);
    expect(model.Name).toBe('production');
    expect(model.Description).toBe('prod group');
    expect(model.TagIds).toEqual([1, 2]);
    expect(model.AuthorizedUsers).toEqual([7]);
    expect(model.AuthorizedTeams).toEqual([3]);
    expect(model.UserAccessPolicies).toEqual({});
    expect(model.TeamAccessPolicies).toEqual({});
  });

  it('keeps provided user and team access policies', () => {
    const model = new EndpointGroupModel({
      Id: 1,
      Name: 'default',
      Description: '',
      TagIds: [],
      AuthorizedUsers: [],
      AuthorizedTeams: [],
      UserAccessPolicies: { 9: { RoleId: 1 } },
      TeamAccessPolicies: { 2: { RoleId: 1 } },
    });

    expect(model.UserAccessPolicies).toEqual({ 9: { RoleId: 1 } });
    expect(model.TeamAccessPolicies).toEqual({ 2: { RoleId: 1 } });
  });
});

describe('REQ-ENV-13 EndpointGroupCreateRequest and UpdateRequest', () => {
  it('builds create and update payloads from the model and endpoint ids', () => {
    const model = {
      Id: 8,
      Name: 'dev',
      Description: 'development',
      TagIds: [5],
      UserAccessPolicies: { 1: { RoleId: 1 } },
      TeamAccessPolicies: {},
    };
    const endpoints = [10, 11];

    const create = new EndpointGroupCreateRequest(model, endpoints);
    expect(create).toEqual({
      Name: 'dev',
      Description: 'development',
      TagIds: [5],
      AssociatedEndpoints: [10, 11],
    });

    const update = new EndpointGroupUpdateRequest(model, endpoints);
    expect(update).toEqual({
      id: 8,
      Name: 'dev',
      Description: 'development',
      TagIds: [5],
      AssociatedEndpoints: [10, 11],
      UserAccessPolicies: { 1: { RoleId: 1 } },
      TeamAccessPolicies: {},
    });
  });
});
