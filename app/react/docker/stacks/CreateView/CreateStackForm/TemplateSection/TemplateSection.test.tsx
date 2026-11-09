import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { HttpResponse } from 'msw';

import selectEvent from '@/react/test-utils/react-select';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { http, server } from '@/setup-tests/server';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { Platform } from '@/react/portainer/templates/types';
import { StackType } from '@/react/common/stacks/types';

import { mockFormValues } from '../test-utils';

import { TemplateSection } from './TemplateSection';
import { TemplateFormValues } from './types';

const templates = [
  {
    Id: 1,
    Title: 'Test Template',
    Description: 'A test template',
    Note: 'This is a test note',
    ProjectPath: '',
    EntryPoint: '',
    CreatedByUserId: 1,
    EdgeTemplate: false,
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    IsComposeFormat: true,
    Variables: [
      {
        name: 'VAR1',
        label: 'Variable 1',
        description: 'First variable',
        defaultValue: 'default1',
      },
    ],
  },
  {
    Id: 2,
    Title: 'Another Template',
    Description: 'Another test template',
    Note: '',
    ProjectPath: '',
    EntryPoint: '',
    CreatedByUserId: 1,
    EdgeTemplate: false,
    Platform: Platform.LINUX,
    Logo: '',
    Type: StackType.DockerCompose,
    IsComposeFormat: true,
    Variables: [],
  },
];

const fileById: Record<number, string> = {
  1: 'version: "3"\nservices:\n  web:\n    image: {{ VAR1 }}',
  2: 'version: "3"\nservices:\n  web:\n    image: nginx',
};

beforeEach(() => {
  server.use(
    http.get('/api/custom_templates', () => HttpResponse.json(templates)),
    http.get('/api/custom_templates/:id', ({ params }) => {
      const id = Number(params.id);
      const template = templates.find((t) => t.Id === id);
      return HttpResponse.json(template ?? {});
    }),
    http.get('/api/custom_templates/:id/file', ({ params }) => {
      const id = Number(params.id);
      return HttpResponse.json({
        FileContent: fileById[id] ?? '',
      });
    })
  );
});

describe('TemplateSection', () => {
  it('should render the template section', async () => {
    server.use(http.get('/api/custom_templates', () => HttpResponse.json([])));
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText(/No custom templates are available/)
      ).toBeInTheDocument();
    });
  });

  it('should render template selector', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Select a custom template/)).toBeInTheDocument();
    });
  });

  it('should show loading indicator when loading template', async () => {
    server.use(
      http.get('/api/custom_templates/:id', async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      })
    );
    renderComponent({
      initialValues: {
        selectedId: 1,
        variables: [],
        fileContent: '',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Loading template...')).toBeInTheDocument();
    });
  });

  it('loads a selected template without variables and edits the file content', async () => {
    const user = userEvent.setup();
    renderComponent({
      initialValues: {
        selectedId: 2,
        variables: [],
        fileContent: '',
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('stack-creation-editor')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'services:\n  api:\n    image: redis');
    expect(textarea).toHaveValue('services:\n  api:\n    image: redis');
  });

  it('initializes variables for a selected template and clears on template change', async () => {
    const user = userEvent.setup();
    renderComponent({
      initialValues: {
        selectedId: 1,
        variables: [],
        fileContent: '',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('This is a test note')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('stack-creation-editor')).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox');
    await selectEvent.select(combobox, /Another Template/, {
      container: document.body,
      user,
    });

    await waitFor(() => {
      expect(screen.queryByText('This is a test note')).not.toBeInTheDocument();
    });

    await selectEvent.clearAll(combobox, { user });
  });

  it('uses swarm editor copy when isSwarm is true', async () => {
    renderComponent({
      isSwarm: true,
      initialValues: {
        selectedId: 2,
        variables: [],
        fileContent: '',
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('stack-creation-editor')).toBeInTheDocument();
    });
  });
});

function renderComponent({
  initialValues = {},
  isSwarm = false,
}: { initialValues?: Partial<TemplateFormValues>; isSwarm?: boolean } = {}) {
  const values = mockFormValues({
    method: 'template',
    template: {
      selectedId: undefined,
      variables: [],
      fileContent: '',
      ...initialValues,
    },
  });

  const Wrapped = withTestRouter(
    withUserProvider(
      withTestQueryProvider(() => (
        <Formik initialValues={values} onSubmit={() => {}} validateOnMount>
          <TemplateSection isSwarm={isSwarm} isSaved={false} />
        </Formik>
      ))
    )
  );

  return render(<Wrapped />);
}
