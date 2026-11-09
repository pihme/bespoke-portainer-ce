import { renderHook } from '@testing-library/react-hooks';

import { TemplateType } from './types';
import { useSortAndFilterTemplates } from './useSortAndFilter';
import { TemplateViewModel } from './view-model';

function tpl(
  overrides: Partial<TemplateViewModel> &
    Pick<TemplateViewModel, 'Id' | 'Title'>
): TemplateViewModel {
  return {
    Type: TemplateType.Container,
    Description: '',
    Categories: [],
    Note: undefined,
    Name: undefined,
    ...overrides,
  } as TemplateViewModel;
}

function listState(
  overrides: Partial<{
    category: string | null;
    types: ReadonlyArray<TemplateType>;
    search: string;
    sortBy: { id: string; desc: boolean } | undefined;
  }> = {}
) {
  return {
    category: null as string | null,
    types: [] as ReadonlyArray<TemplateType>,
    search: '',
    sortBy: undefined as { id: string; desc: boolean } | undefined,
    setCategory: () => undefined,
    setTypes: () => undefined,
    ...overrides,
  };
}

describe('REQ-TPL-01 useSortAndFilterTemplates', () => {
  const templates = [
    tpl({
      Id: 1,
      Title: 'Alpha',
      Description: 'first',
      Categories: ['database'],
      Type: TemplateType.Container,
      Note: 'alpha note',
      Name: 'alpha',
    }),
    tpl({
      Id: 2,
      Title: 'Bravo',
      Description: 'second',
      Categories: ['web'],
      Type: TemplateType.ComposeStack,
    }),
    tpl({
      Id: 3,
      Title: 'Charlie',
      Description: 'third',
      Categories: [],
      Type: TemplateType.SwarmStack,
    }),
    tpl({
      Id: 4,
      Title: 'Delta',
      Description: 'fourth',
      Categories: ['database', 'cache'],
      Type: TemplateType.Container,
    }),
  ];

  it('returns all templates when no filters are set', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates(templates, listState())
    );
    expect(result.current.map((t) => t.Id)).toEqual([1, 2, 3, 4]);
  });

  it('filters by category', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates(
        templates,
        listState({ category: 'database' })
      )
    );
    expect(result.current.map((t) => t.Id)).toEqual([1, 4]);
  });

  it('filters by search across title description categories note and name', () => {
    const { result: byNote } = renderHook(() =>
      useSortAndFilterTemplates(templates, listState({ search: 'alpha note' }))
    );
    expect(byNote.current.map((t) => t.Id)).toEqual([1]);

    const { result: byCategory } = renderHook(() =>
      useSortAndFilterTemplates(templates, listState({ search: 'web' }))
    );
    expect(byCategory.current.map((t) => t.Id)).toEqual([2]);

    const { result: byName } = renderHook(() =>
      useSortAndFilterTemplates(templates, listState({ search: 'alpha' }))
    );
    expect(byName.current.map((t) => t.Id)).toEqual([1]);
  });

  it('excludes disabled types when no type filter is selected', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates(templates, listState(), [
        TemplateType.SwarmStack,
      ])
    );
    expect(result.current.map((t) => t.Id)).toEqual([1, 2, 4]);
  });

  it('intersects selected types with disabled types', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates(
        templates,
        listState({
          types: [TemplateType.Container, TemplateType.SwarmStack],
        }),
        [TemplateType.SwarmStack]
      )
    );
    expect(result.current.map((t) => t.Id)).toEqual([1, 4]);
  });

  it('sorts by title ascending and descending', () => {
    const { result: asc } = renderHook(() =>
      useSortAndFilterTemplates(
        templates,
        listState({ sortBy: { id: 'Title', desc: false } })
      )
    );
    expect(asc.current.map((t) => t.Title)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
    ]);

    const { result: desc } = renderHook(() =>
      useSortAndFilterTemplates(
        templates,
        listState({ sortBy: { id: 'Title', desc: true } })
      )
    );
    expect(desc.current.map((t) => t.Title)).toEqual([
      'Delta',
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
  });

  it('sorts by description', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates(
        templates,
        listState({ sortBy: { id: 'Description', desc: false } })
      )
    );
    expect(result.current.map((t) => t.Description)).toEqual([
      'first',
      'fourth',
      'second',
      'third',
    ]);
  });

  it('sorts by categories including empty category lists', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates(
        templates,
        listState({ sortBy: { id: 'Categories', desc: false } })
      )
    );
    // empty categories first, then database..., then web
    expect(result.current.map((t) => t.Id)).toEqual([3, 1, 4, 2]);

    const bothEmpty = [
      tpl({ Id: 10, Title: 'A', Categories: [] }),
      tpl({ Id: 11, Title: 'B', Categories: [] }),
    ];
    const { result: empty } = renderHook(() =>
      useSortAndFilterTemplates(
        bothEmpty,
        listState({ sortBy: { id: 'Categories', desc: false } })
      )
    );
    expect(empty.current.map((t) => t.Id)).toEqual([10, 11]);
  });

  it('returns an empty array when templates is empty', () => {
    const { result } = renderHook(() =>
      useSortAndFilterTemplates([], listState())
    );
    expect(result.current).toEqual([]);
  });
});
