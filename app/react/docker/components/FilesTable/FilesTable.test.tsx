import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';

import { FilesTable } from './FilesTable';
import { FileData, isFilesTableMeta } from './types';

vi.mock('./columns', () => ({
  columns: [{ id: 'name', header: 'Name', accessorKey: 'Name' }],
}));

vi.mock('@@/datatables', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@@/datatables')>();
  return {
    ...actual,
    Datatable: (props: {
      title: string;
      dataset: FileData[];
      'data-cy'?: string;
      getRowId?: (row: FileData) => string;
      renderTableActions?: () => React.ReactNode;
      extendTableOptions?: (opts: object) => {
        meta?: {
          isEdit?: (n: string) => boolean;
          setIsEdit?: (n: string, v: boolean) => void;
        };
      };
    }) => {
      const extended = props.extendTableOptions?.({}) || {};
      const meta = extended.meta;
      meta?.isEdit?.('readme.txt');
      setTimeout(() => meta?.setIsEdit?.('readme.txt', true), 0);
      return (
        <div data-cy={props['data-cy']}>
          <h2>{props.title}</h2>
          {props.dataset.map((row) => (
            <div key={props.getRowId?.(row) || row.Name}>
              {row.custom || row.Name}
            </div>
          ))}
          {props.renderTableActions?.()}
        </div>
      );
    },
  };
});

const tableState = {
  pageSize: 10,
  setPageSize: vi.fn(),
  search: '',
  setSearch: vi.fn(),
  sortBy: undefined,
  setSortBy: vi.fn(),
};

const file: FileData = {
  Name: 'readme.txt',
  Dir: false,
  Size: 12,
  ModTime: 1,
  custom: null,
};

describe('FilesTable', () => {
  function renderTable(
    overrides: Partial<Parameters<typeof FilesTable>[0]> = {}
  ) {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <FilesTable
            title="Files"
            dataset={[file]}
            tableState={tableState as never}
            isRoot
            onGoToParent={vi.fn()}
            onBrowse={vi.fn()}
            onRename={vi.fn()}
            onDownload={vi.fn()}
            onDelete={vi.fn()}
            isUploadAllowed={false}
            onFileSelectedForUpload={vi.fn()}
            {...overrides}
          />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    return render(<Wrapped />);
  }

  it('renders files at root without parent row', async () => {
    renderTable({ isRoot: true });
    expect(await screen.findByText('readme.txt')).toBeVisible();
    expect(screen.queryByText(/go to parent/i)).not.toBeInTheDocument();
  });

  it('prepends go-to-parent when not root', async () => {
    const onGoToParent = vi.fn();
    const user = userEvent.setup();
    renderTable({ isRoot: false, onGoToParent });
    await user.click(await screen.findByTestId('component-goToParentButton'));
    expect(onGoToParent).toHaveBeenCalled();
  });

  it('shows upload control when allowed and forwards selected file', async () => {
    const user = userEvent.setup();
    const onFileSelectedForUpload = vi.fn();
    renderTable({ isUploadAllowed: true, onFileSelectedForUpload });

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    const f = new File(['x'], 'a.txt');
    await user.upload(input, f);
    expect(onFileSelectedForUpload).toHaveBeenCalledWith(f);
  });

  it('hides upload actions when not allowed', async () => {
    renderTable({ isUploadAllowed: false });
    await screen.findByText('readme.txt');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('type-guards files table meta', () => {
    expect(isFilesTableMeta(undefined)).toBe(false);
    expect(isFilesTableMeta({ table: 'other' } as never)).toBe(false);
    expect(isFilesTableMeta({ table: 'files' } as never)).toBe(true);
  });

  it('ignores empty file selection events', async () => {
    const onFileSelectedForUpload = vi.fn();
    renderTable({ isUploadAllowed: true, onFileSelectedForUpload });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await userEvent.setup().upload(input, []);
    expect(onFileSelectedForUpload).not.toHaveBeenCalled();
  });
});
