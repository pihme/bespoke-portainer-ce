import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { columns } from './index';
import { NameCell } from './NameCell';
import { ActionsCell } from './ActionsCell';

function meta(overrides: Record<string, unknown> = {}) {
  return {
    table: 'files' as const,
    isEdit: () => false,
    setIsEdit: vi.fn(),
    onBrowse: vi.fn(),
    onRename: vi.fn(),
    onDownload: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

function cellProps(item: Record<string, unknown>, tableMeta = meta()) {
  return {
    getValue: () => item.Name as string,
    row: { original: item },
    table: { options: { meta: tableMeta } },
  } as never;
}

describe('FilesTable columns for local Docker files', () => {
  it('exports name size modtime and actions columns', () => {
    expect(columns.map((c) => c.header || c.id)).toEqual(
      expect.arrayContaining(['Name', 'Size', 'Last modification', 'Actions'])
    );
  });

  it('hideIfCustom returns null for custom rows on size/actions', () => {
    const sizeCol = columns.find((c) => c.header === 'Size')!;
    const actionsCol = columns.find((c) => c.header === 'Actions')!;
    const customProps = cellProps({
      Name: 'x',
      Size: 10,
      ModTime: 1,
      Dir: false,
      custom: <span>go up</span>,
    });
    expect(
      typeof sizeCol.cell === 'function' ? sizeCol.cell(customProps) : null
    ).toBeNull();
    expect(
      typeof actionsCol.cell === 'function' ? actionsCol.cell(customProps) : null
    ).toBeNull();
  });

  it('NameCell renders file name and browses directories', async () => {
    const user = userEvent.setup();
    render(
      <NameCell
        {...cellProps({ Name: 'app.yml', Size: 1, ModTime: 1, Dir: false })}
      />
    );
    expect(screen.getByText('app.yml')).toBeInTheDocument();

    const browseMeta = meta({ onBrowse: vi.fn() });
    render(
      <NameCell
        {...cellProps(
          { Name: 'data', Size: 0, ModTime: 1, Dir: true },
          browseMeta
        )}
      />
    );
    await user.click(screen.getByRole('button', { name: 'data' }));
    expect(browseMeta.onBrowse).toHaveBeenCalledWith('data');
  });

  it('NameCell edit form renames and custom content renders', async () => {
    const user = userEvent.setup();
    const editMeta = meta({
      isEdit: (n: string) => n === 'old.txt',
      onRename: vi.fn(),
      setIsEdit: vi.fn(),
    });
    render(
      <NameCell
        {...cellProps(
          { Name: 'old.txt', Size: 1, ModTime: 1, Dir: false },
          editMeta
        )}
      />
    );
    await user.clear(screen.getByDisplayValue('old.txt'));
    await user.type(screen.getByDisplayValue(''), 'new.txt');
    await user.click(
      document.querySelector('[data-cy="file-submit-button-old.txt"]')!
    );
    expect(editMeta.onRename).toHaveBeenCalled();

    render(
      <NameCell
        {...cellProps({
          Name: 'up',
          custom: <span>Parent</span>,
          Dir: true,
          Size: 0,
          ModTime: 0,
        })}
      />
    );
    expect(screen.getByText('Parent')).toBeInTheDocument();
  });

  it('ActionsCell shows download rename and delete for files', async () => {
    const user = userEvent.setup();
    const tableMeta = meta();
    render(
      <ActionsCell
        {...cellProps(
          { Name: 'a.yml', Dir: false, Size: 1, ModTime: 1 },
          tableMeta
        )}
      />
    );
    await user.click(screen.getByRole('button', { name: /Download/i }));
    expect(tableMeta.onDownload).toHaveBeenCalledWith('a.yml');
    await user.click(screen.getByRole('button', { name: /Rename/i }));
    expect(tableMeta.setIsEdit).toHaveBeenCalledWith('a.yml', true);
    await user.click(screen.getByRole('button', { name: /Delete/i }));
    expect(tableMeta.onDelete).toHaveBeenCalledWith('a.yml');
  });
});
