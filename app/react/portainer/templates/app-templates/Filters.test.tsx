import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import selectEvent from '@/react/test-utils/react-select';

import { Filters } from './Filters';
import { TemplateType } from './types';
import { TemplateViewModel } from './view-model';

function tpl(
  overrides: Partial<TemplateViewModel> &
    Pick<TemplateViewModel, 'Id' | 'Title' | 'Type'>
): TemplateViewModel {
  return {
    Description: 'desc',
    Categories: ['web'],
    ...overrides,
  } as TemplateViewModel;
}

function makeListState(
  overrides: Partial<{
    category: string | null;
    types: ReadonlyArray<TemplateType>;
    sortBy: { id: string; desc: boolean } | undefined;
    search: string;
  }> = {}
) {
  return {
    category: null as string | null,
    types: [] as ReadonlyArray<TemplateType>,
    sortBy: undefined as { id: string; desc: boolean } | undefined,
    search: '',
    setCategory: vi.fn(),
    setTypes: vi.fn(),
    setSortBy: vi.fn(),
    ...overrides,
  };
}

const portal = { container: () => document.body };

describe('REQ-TPL-01 Filters for app templates', () => {
  const templates = [
    tpl({
      Id: 1,
      Title: 'A',
      Type: TemplateType.Container,
      Categories: ['web', 'database'],
    }),
    tpl({
      Id: 2,
      Title: 'B',
      Type: TemplateType.ComposeStack,
      Categories: ['web'],
    }),
    tpl({
      Id: 3,
      Title: 'C',
      Type: TemplateType.SwarmStack,
      Categories: ['edge'],
    }),
  ];

  it('renders category and type filters and notifies on change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const listState = makeListState();

    render(
      <Filters
        templates={templates}
        listState={listState}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText('Category filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Type filter')).toBeInTheDocument();

    await selectEvent.select(screen.getByLabelText('Category filter'), 'web', {
      user,
      ...portal,
    });
    expect(listState.setCategory).toHaveBeenCalledWith('web');
    expect(onChange).toHaveBeenCalled();

    await selectEvent.select(
      screen.getByLabelText('Type filter'),
      'Container',
      { user, ...portal }
    );
    expect(listState.setTypes).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('hides fixed categories and disabled types from the filter options', () => {
    render(
      <Filters
        templates={templates}
        listState={makeListState()}
        onChange={vi.fn()}
        fixedCategories={['edge']}
        disabledTypes={[TemplateType.SwarmStack]}
      />
    );

    expect(screen.getByLabelText('Category filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Type filter')).toBeInTheDocument();
  });

  it('hides the type filter when fewer than two types remain enabled', () => {
    render(
      <Filters
        templates={[
          tpl({
            Id: 1,
            Title: 'Only',
            Type: TemplateType.Container,
            Categories: ['web'],
          }),
        ]}
        listState={makeListState()}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Type filter')).not.toBeInTheDocument();
  });

  it('updates sort through TemplateListSort', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const listState = makeListState();

    render(
      <Filters
        templates={templates}
        listState={listState}
        onChange={onChange}
      />
    );

    const sortInput = document.querySelector(
      '[data-cy="app-templates-sortby-selector"]'
    ) as HTMLElement;
    await selectEvent.select(sortInput, 'Title', { user, ...portal });
    expect(listState.setSortBy).toHaveBeenCalledWith('Title', false);
    expect(onChange).toHaveBeenCalled();
  });
});
