import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it } from 'vitest';

import {
  computePagedGroups,
  useGroupOptions,
  useGroups,
} from './sortable-list.story-utils';
import { SortableListState } from './SortableList';

type Item = { id: number; name: string; color: string; category: string };

const ITEMS: Item[] = [
  { id: 1, name: 'Apple', color: 'Red', category: 'fruit' },
  { id: 2, name: 'Banana', color: 'Yellow', category: 'fruit' },
  { id: 3, name: 'Carrot', color: 'Orange', category: 'veggie' },
  { id: 4, name: 'Broccoli', color: 'Green', category: 'veggie' },
  { id: 5, name: 'Cherry', color: 'Red', category: 'fruit' },
];

const COLOR_KEYS = ['Red', 'Orange', 'Yellow', 'Green'];
const CATEGORY_KEYS = ['fruit', 'veggie'];

function getGroupKeys(sortBy: string) {
  if (sortBy === 'color') return COLOR_KEYS;
  if (sortBy === 'category') return CATEGORY_KEYS;
  return [];
}

function getGroupKey(item: Item, sortBy: string) {
  return sortBy === 'color' ? item.color : item.category;
}

function getGroupLabel(sortBy: string, key: string) {
  if (sortBy === 'category') {
    return key === 'fruit' ? 'Fruit' : 'Veggies';
  }
  return key;
}

function getSearchText(item: Item) {
  return `${item.name} ${item.color} ${item.category}`;
}

describe('sortable-list.story-utils (backwards compatibility)', () => {
  describe('computePagedGroups', () => {
    it('groups, sorts, and paginates items by the active sort key', () => {
      const result = computePagedGroups({
        items: ITEMS,
        sortBy: 'color',
        page: 0,
        pageSize: 10,
        groupFilter: null,
        search: '',
        getGroupKeys,
        getGroupKey,
        getGroupLabel,
        getSearchText,
        getGroupIcon: (key) => `icon-${key}`,
      });

      expect(result.totalCount).toBe(5);
      expect(result.groups.map((g) => g.key)).toEqual([
        'Red',
        'Orange',
        'Yellow',
        'Green',
      ]);
      expect(result.groups[0].items.map((i) => i.name)).toEqual([
        'Apple',
        'Cherry',
      ]);
      expect(result.groups[0].icon).toBe('icon-Red');
      expect(result.groups[0].label).toBe('Red');
    });

    it('filters by group and search, and reports the filtered total', () => {
      const result = computePagedGroups({
        items: ITEMS,
        sortBy: 'color',
        page: 0,
        pageSize: 10,
        groupFilter: 'Red',
        search: 'cherr',
        getGroupKeys,
        getGroupKey,
        getGroupLabel,
        getSearchText,
      });

      expect(result.totalCount).toBe(1);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].items[0].name).toBe('Cherry');
    });

    it('returns a single All group when there are no group keys', () => {
      const result = computePagedGroups({
        items: ITEMS.slice(0, 2),
        sortBy: 'name',
        page: 0,
        pageSize: 10,
        groupFilter: null,
        search: '',
        getGroupKeys,
        getGroupKey,
        getGroupLabel,
        getSearchText,
      });

      expect(result.groups).toEqual([
        { key: 'all', label: 'All', icon: undefined, items: ITEMS.slice(0, 2) },
      ]);
    });

    it('returns no groups when there are no group keys and no items after filter', () => {
      const result = computePagedGroups({
        items: ITEMS,
        sortBy: 'name',
        page: 0,
        pageSize: 10,
        groupFilter: null,
        search: 'zzz',
        getGroupKeys,
        getGroupKey,
        getGroupLabel,
        getSearchText,
      });

      expect(result.totalCount).toBe(0);
      expect(result.groups).toEqual([]);
    });

    it('paginates within the filtered set', () => {
      const result = computePagedGroups({
        items: ITEMS,
        sortBy: 'category',
        page: 1,
        pageSize: 2,
        groupFilter: null,
        search: '',
        getGroupKeys,
        getGroupKey,
        getGroupLabel,
        getSearchText,
      });

      expect(result.totalCount).toBe(5);
      expect(result.groups.flatMap((g) => g.items)).toHaveLength(2);
      expect(result.groups[0].label).toMatch(/Fruit|Veggies/);
    });

    it('keeps item order when group keys are empty and search matches', () => {
      const result = computePagedGroups({
        items: ITEMS,
        sortBy: 'name',
        page: 0,
        pageSize: 10,
        groupFilter: null,
        search: 'a',
        getGroupKeys,
        getGroupKey,
        getGroupLabel,
        getSearchText,
      });

      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.groups[0].key).toBe('all');
    });
  });

  describe('useGroupOptions', () => {
    it('builds dropdown options with counts for the active sort key', () => {
      const { result } = renderHook(() =>
        useGroupOptions(
          'color',
          ITEMS,
          getGroupKeys,
          getGroupKey,
          getGroupLabel
        )
      );

      expect(result.current).toEqual([
        { key: 'Red', label: 'Red', count: 2 },
        { key: 'Orange', label: 'Orange', count: 1 },
        { key: 'Yellow', label: 'Yellow', count: 1 },
        { key: 'Green', label: 'Green', count: 1 },
      ]);
    });
  });

  describe('useGroups', () => {
    it('prefers groupBy over sortBy when building groups', () => {
      const tableState = {
        groupBy: 'category',
        sortBy: { id: 'color', desc: false },
        page: 0,
        pageSize: 10,
        groupFilter: null,
        search: '',
      } as SortableListState;

      const { result } = renderHook(() =>
        useGroups(
          tableState,
          ITEMS,
          'color',
          getGroupKeys,
          getGroupKey,
          getGroupLabel,
          getSearchText
        )
      );

      expect(result.current.groups.map((g) => g.key)).toEqual([
        'fruit',
        'veggie',
      ]);
      expect(result.current.totalCount).toBe(5);
    });

    it('falls back to the default sort key when neither groupBy nor sortBy is set', () => {
      const tableState = {
        groupBy: null,
        sortBy: undefined,
        page: 0,
        pageSize: 10,
        groupFilter: null,
        search: '',
      } as SortableListState;

      const { result } = renderHook(() =>
        useGroups(
          tableState,
          ITEMS,
          'color',
          getGroupKeys,
          getGroupKey,
          getGroupLabel,
          getSearchText,
          (key) => `icon-${key}`
        )
      );

      expect(result.current.groups[0].key).toBe('Red');
      expect(result.current.groups[0].icon).toBe('icon-Red');
    });
  });
});
