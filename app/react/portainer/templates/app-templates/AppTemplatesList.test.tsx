import { PropsWithChildren } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { AppTemplatesList } from './AppTemplatesList';
import { TemplateType } from './types';
import { TemplateViewModel } from './view-model';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  UISref: ({ children }: PropsWithChildren<unknown>) => children,
  useSref: () => ({ href: '' }),
}));

function tpl(
  overrides: Partial<TemplateViewModel> &
    Pick<TemplateViewModel, 'Id' | 'Title'>
): TemplateViewModel {
  return {
    Type: TemplateType.Container,
    Description: 'desc',
    Categories: ['web'],
    ...overrides,
  } as TemplateViewModel;
}

function renderList(
  props: Partial<React.ComponentProps<typeof AppTemplatesList>> = {}
) {
  const storageKey = `app-templates-list-${Math.random()}`;
  const Wrapped = withTestQueryProvider(
    withTestRouter(() => (
      <AppTemplatesList storageKey={storageKey} {...props} />
    ))
  );
  return render(<Wrapped />);
}

describe('REQ-TPL-01 AppTemplatesList', () => {
  it('shows an empty state when templates are undefined or empty', () => {
    // Loading... is effectively uncoverable: useMemo maps undefined -> [].
    const { unmount } = renderList({ templates: undefined });
    expect(screen.getByText('No templates available.')).toBeVisible();
    unmount();

    renderList({ templates: [] });
    expect(screen.getByText('No templates available.')).toBeVisible();
  });

  it('renders templates and notifies on select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const templates = [
      tpl({ Id: 1, Title: 'Nginx' }),
      tpl({ Id: 2, Title: 'Redis', Type: TemplateType.ComposeStack }),
    ];

    renderList({
      templates,
      onSelect,
      selectedId: 1,
    });

    expect(screen.getByText('Nginx', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Redis', { exact: false })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Redis'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 2, Title: 'Redis' })
    );
  });

  it('applies fixedCategories before listing', () => {
    renderList({
      templates: [
        tpl({ Id: 1, Title: 'Edge App', Categories: ['edge'] }),
        tpl({ Id: 2, Title: 'Local App', Categories: ['web'] }),
      ],
      fixedCategories: ['edge'],
    });

    expect(screen.getByText('Edge App', { exact: false })).toBeInTheDocument();
    expect(
      screen.queryByText('Local App', { exact: false })
    ).not.toBeInTheDocument();
  });

  it('filters the list through the search box', async () => {
    const user = userEvent.setup();
    renderList({
      templates: [
        tpl({ Id: 1, Title: 'Nginx' }),
        tpl({ Id: 2, Title: 'Redis' }),
      ],
    });

    const search = screen.getByLabelText('Search input');
    await user.clear(search);
    await user.type(search, 'Redis');

    await waitFor(
      () => {
        expect(screen.getByText('Redis', { exact: false })).toBeInTheDocument();
        expect(
          screen.queryByText('Nginx', { exact: false })
        ).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});
