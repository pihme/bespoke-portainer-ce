import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TreeNode } from './TreeNode';
import { FileNode } from './types';

function renderTreeNode({
  item = { name: 'src', children: [{ name: 'a.ts' }] } as FileNode,
  depth = 0,
  expanded = new Set<string>(),
  selected = new Set<string>(),
  nodePath = 'src',
  onExpandDirectory = vi.fn(),
  onToggleSelect = vi.fn(),
}: {
  item?: FileNode;
  depth?: number;
  expanded?: Set<string>;
  selected?: Set<string>;
  nodePath?: string;
  onExpandDirectory?: (path: string) => void;
  onToggleSelect?: (path: string, item: FileNode) => void;
} = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <TreeNode
      item={item}
      depth={depth}
      expanded={expanded}
      selected={selected}
      nodePath={nodePath}
      onExpandDirectory={onExpandDirectory}
      onToggleSelect={onToggleSelect}
    />
  );
  return { user, onExpandDirectory, onToggleSelect };
}

describe('TreeNode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles selection after a single row click delay', async () => {
    const { user, onToggleSelect } = renderTreeNode({
      item: { name: 'a.ts' },
      nodePath: 'a.ts',
    });
    await user.click(screen.getByText('a.ts'));
    expect(onToggleSelect).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(onToggleSelect).toHaveBeenCalledWith('a.ts', { name: 'a.ts' });
  });

  it('expands a directory on double-click instead of selecting', async () => {
    const { user, onExpandDirectory, onToggleSelect } = renderTreeNode();
    await user.dblClick(screen.getByText('src'));
    expect(onExpandDirectory).toHaveBeenCalledWith('src');
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('expands on Enter and toggles selection on Space', async () => {
    const onExpandDirectory = vi.fn();
    const onToggleSelect = vi.fn();
    renderTreeNode({ onExpandDirectory, onToggleSelect });
    const row = screen.getByText('src').closest('[role="button"]');
    expect(row).toBeTruthy();
    fireEvent.keyDown(row!, { key: 'Enter' });
    expect(onExpandDirectory).toHaveBeenCalledWith('src');
    fireEvent.keyDown(row!, { key: 'Space' });
    expect(onToggleSelect).toHaveBeenCalledWith('src', {
      name: 'src',
      children: [{ name: 'a.ts' }],
    });
  });

  it('renders children when the directory path is expanded', () => {
    renderTreeNode({
      expanded: new Set(['src']),
      selected: new Set(['src/a.ts']),
    });
    expect(screen.getByText('a.ts')).toBeVisible();
  });

  it('marks a partially selected directory as indeterminate', () => {
    renderTreeNode({
      item: {
        name: 'src',
        children: [{ name: 'a.ts' }, { name: 'b.ts' }],
      },
      selected: new Set(['src/a.ts']),
    });
    expect(screen.getByRole('checkbox')).toHaveProperty('indeterminate', true);
  });

  it('calls onExpandDirectory when the collapse/expand control is clicked', async () => {
    const { user, onExpandDirectory } = renderTreeNode();
    await user.click(screen.getByRole('button', { name: /expand/i }));
    expect(onExpandDirectory).toHaveBeenCalledWith('src');
  });

  it('does not expand a file on Enter', () => {
    const onExpandDirectory = vi.fn();
    renderTreeNode({
      item: { name: 'a.ts' },
      nodePath: 'a.ts',
      onExpandDirectory,
    });
    const row = screen.getByText('a.ts').closest('[role="button"]');
    fireEvent.keyDown(row!, { key: 'Enter' });
    expect(onExpandDirectory).not.toHaveBeenCalled();
  });

  it('ignores expand on double-click for a file row', async () => {
    const { user, onExpandDirectory, onToggleSelect } = renderTreeNode({
      item: { name: 'a.ts' },
      nodePath: 'a.ts',
    });
    await user.dblClick(screen.getByText('a.ts'));
    expect(onExpandDirectory).not.toHaveBeenCalled();
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

});
