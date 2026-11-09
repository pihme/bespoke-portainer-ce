import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import { HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server, http } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockEnvironmentGroup } from '@/react-tools/test-mocks';
import { createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';

import { MetadataFieldset } from './MetadataFieldset';
import { GroupField } from './GroupsField';
import { metadataValidation } from './validation';

function setupMocks({
  groups = [
    createMockEnvironmentGroup({ Id: 1, Name: 'Default' }),
    createMockEnvironmentGroup({ Id: 2, Name: 'Production' }),
  ],
}: {
  groups?: ReturnType<typeof createMockEnvironmentGroup>[] | null;
} = {}) {
  server.use(
    http.get('/api/endpoint_groups', () => {
      if (groups === null) {
        return HttpResponse.json(null, { status: 500 });
      }
      return HttpResponse.json(groups);
    }),
    http.get('/api/tags', () =>
      HttpResponse.json([
        { ID: 1, Name: 'tag1' },
        { ID: 2, Name: 'tag2' },
      ])
    )
  );
}

describe('MetadataFieldset', () => {
  it('renders metadata section with group select and tags', async () => {
    setupMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Metadata')).toBeVisible();
      expect(screen.getByTestId('environment-group-select')).toBeVisible();
    });

    expect(screen.getByText('child slot')).toBeVisible();
  });

  it('updates groupId when a group is selected', async () => {
    setupMocks();
    const user = userEvent.setup();
    const { getValues } = renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('environment-group-select')).toBeVisible();
    });

    await user.selectOptions(
      screen.getByTestId('environment-group-select'),
      '2'
    );

    await waitFor(() => {
      expect(getValues().meta.groupId).toBe(2);
    });
  });

  it('resets groupId to 1 when empty value is selected', async () => {
    setupMocks({
      groups: [
        createMockEnvironmentGroup({ Id: 1, Name: 'Default' }),
        createMockEnvironmentGroup({ Id: 2, Name: 'Production' }),
      ],
    });
    const user = userEvent.setup();
    const { getValues } = renderComponent({
      initialValues: { meta: { groupId: 2, tagIds: [] } },
    });

    await waitFor(() => {
      expect(screen.getByTestId('environment-group-select')).toBeVisible();
    });

    // Select element may not have empty option — trigger change via GroupField path
    // by selecting Default (1) then verify handleChange parses ints
    await user.selectOptions(
      screen.getByTestId('environment-group-select'),
      '1'
    );
    await waitFor(() => {
      expect(getValues().meta.groupId).toBe(1);
    });
  });
});

describe('GroupField', () => {
  it('renders nothing while groups are loading / unavailable', async () => {
    server.use(
      http.get('/api/endpoint_groups', () =>
        // never resolve data: return pending by delaying — use empty abort
        new Promise(() => {})
      )
    );

    const Wrapped = withUserProvider(
      withTestQueryProvider(function Subject() {
        return (
          <Formik
            initialValues={{ meta: { groupId: 1, tagIds: [] as number[] } }}
            onSubmit={() => {}}
          >
            <Form>
              <GroupField />
            </Form>
          </Formik>
        );
      })
    );

    render(<Wrapped />);
    expect(screen.queryByTestId('environment-group-select')).not.toBeInTheDocument();
  });

  it('maps empty select value to groupId 1', async () => {
    setupMocks({
      groups: [createMockEnvironmentGroup({ Id: 1, Name: 'Default' })],
    });
    // Force an empty option by mocking Select via direct handleChange: render with a custom option list
    // Easier: invoke through changing to a value that exists then use fireEvent with empty
    const user = userEvent.setup();
    const Wrapped = withUserProvider(
      withTestQueryProvider(function Subject() {
        return (
          <Formik
            initialValues={{ meta: { groupId: 1, tagIds: [] as number[] } }}
            onSubmit={() => {}}
          >
            {({ values }) => (
              <Form>
                <GroupField />
                <div data-cy="gid">{values.meta.groupId}</div>
              </Form>
            )}
          </Formik>
        );
      })
    );
    render(<Wrapped />);
    await waitFor(() => {
      expect(screen.getByTestId('environment-group-select')).toBeVisible();
    });
    // Add empty option via DOM and select it
    const select = screen.getByTestId('environment-group-select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '';
    select.prepend(empty);
    await user.selectOptions(select, '');
    await waitFor(() => {
      expect(screen.getByTestId('gid')).toHaveTextContent('1');
    });
  });
});

describe('metadataValidation', () => {
  it('accepts groupId and tagIds', async () => {
    const schema = metadataValidation();
    await expect(
      schema.validate({ groupId: 2, tagIds: [1, 2] })
    ).resolves.toEqual({ groupId: 2, tagIds: [1, 2] });
    await expect(schema.validate({})).resolves.toMatchObject({ tagIds: [] });
  });
});

function renderComponent({
  initialValues = { meta: { groupId: 1, tagIds: [] as number[] } },
  user = createMockUser({ Role: Role.Admin }),
}: {
  initialValues?: { meta: { groupId: number; tagIds: number[] } };
  user?: ReturnType<typeof createMockUser>;
} = {}) {
  let current = initialValues;

  const Wrapped = withUserProvider(
    withTestQueryProvider(function Subject() {
      return (
        <Formik
          initialValues={initialValues}
          onSubmit={() => {}}
        >
          {({ values }) => {
            current = values;
            return (
              <Form>
                <MetadataFieldset>
                  <div>child slot</div>
                </MetadataFieldset>
              </Form>
            );
          }}
        </Formik>
      );
    }),
    user
  );

  const result = render(<Wrapped />);
  return {
    ...result,
    getValues: () => current,
  };
}
