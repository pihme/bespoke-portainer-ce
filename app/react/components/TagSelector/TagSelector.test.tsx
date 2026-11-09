import { http, HttpResponse } from 'msw';
import { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Tag, TagId } from '@/portainer/tags/types';
import { server } from '@/setup-tests/server';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { TagSelector } from './TagSelector';

vi.mock('@@/form-components/ReactSelect', () => ({
  Select: ({
    onChange,
    options,
    'aria-label': ariaLabel,
  }: {
    onChange: (opt?: { label: string; value: number } | null) => void;
    options: Array<{ label: string; value: number }>;
    'aria-label'?: string;
  }) => (
    <div>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onChange(options[0])}
      >
        add-first
      </button>
      <button type="button" onClick={() => onChange(null)}>
        add-null
      </button>
    </div>
  ),
  Creatable: ({
    onCreateOption,
  }: {
    onCreateOption: (v: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onCreateOption('  ')}>
        create-blank
      </button>
      <button type="button" onClick={() => onCreateOption('new-tag')}>
        create-tag
      </button>
    </div>
  ),
}));

test('should show a message when no tags and allowCreate is false', async () => {
  const { getByText } = await renderComponent({ allowCreate: false }, []);

  expect(
    getByText('No tags available. Head over to the', {
      exact: false,
    })
  ).toBeInTheDocument();
});

test('should show the selected tags and remove them', async () => {
  const onChange = vi.fn();
  const tags: Tag[] = [
    { ID: 1, Name: 'tag1', Endpoints: {} },
    { ID: 2, Name: 'tag2', Endpoints: {} },
  ];

  const { getByText, getByTitle } = await renderComponent(
    { value: [2], onChange },
    tags
  );

  expect(getByText('tag2')).toBeInTheDocument();
  getByTitle('Remove tag').click();
  expect(onChange).toHaveBeenCalledWith([]);
});

test('adds a tag from the select and ignores null', async () => {
  const onChange = vi.fn();
  const tags: Tag[] = [
    { ID: 1, Name: 'tag1', Endpoints: {} },
    { ID: 2, Name: 'tag2', Endpoints: {} },
  ];
  await renderComponent({ value: [], onChange }, tags);

  await userEvent.click(screen.getByRole('button', { name: 'Tags' }));
  expect(onChange).toHaveBeenCalledWith([1]);

  await userEvent.click(screen.getByText('add-null'));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('creates a tag when allowCreate is true and shows string errors', async () => {
  const onChange = vi.fn();
  server.use(
    http.get('/api/tags', () =>
      HttpResponse.json([{ ID: 1, Name: 'tag1', Endpoints: {} }])
    ),
    http.post('/api/tags', async ({ request }) => {
      const body = (await request.json()) as { Name: string };
      return HttpResponse.json({ ID: 9, Name: body.Name, Endpoints: {} });
    })
  );

  const Wrapped = withTestQueryProvider(withTestRouter(TagSelector));
  render(
    <Wrapped value={[]} allowCreate onChange={onChange} errors="bad tags" />
  );

  expect(await screen.findByText('bad tags')).toBeInTheDocument();
  await userEvent.click(screen.getByText('create-blank'));
  expect(onChange).not.toHaveBeenCalled();

  await userEvent.click(screen.getByText('create-tag'));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith([9]));
});

async function renderComponent(
  {
    value = [],
    allowCreate = false,
    onChange = vi.fn(),
  }: {
    value?: TagId[];
    allowCreate?: boolean;
    onChange?: Mock;
  } = {},
  tags: Tag[] = []
) {
  server.use(http.get('/api/tags', () => HttpResponse.json(tags)));

  const Wrapped = withTestQueryProvider(withTestRouter(TagSelector));

  const queries = render(
    <Wrapped value={value} allowCreate={allowCreate} onChange={onChange} />
  );

  const tagElement = await queries.findAllByText('tags', { exact: false });

  expect(tagElement.length).toBeGreaterThanOrEqual(1);

  return queries;
}
