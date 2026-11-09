import { Directory, File, FileNode } from './types';
import {
  isDirectory,
  isDirectoryWithChildren,
  getAllFilePaths,
  getFolderState,
  filterToPattern,
  buildFileTree,
} from './utils';

function file(name: string): File {
  return { name };
}

function dir(name: string, children: FileNode[] = []): Directory {
  return { name, children };
}

describe('isDirectory', () => {
  it('returns true when the item has a children property', () => {
    expect(isDirectory(dir('src'))).toBe(true);
  });

  it('returns true when the children property is present but undefined', () => {
    const dirWithUndefinedChildren: Directory = {
      name: 'empty',
      children: undefined,
    };
    expect(isDirectory(dirWithUndefinedChildren)).toBe(true);
  });

  it('returns false for a file without children', () => {
    expect(isDirectory(file('foo.ts'))).toBe(false);
  });
});

describe('getAllFilePaths', () => {
  it('returns the node path for a single file', () => {
    expect(getAllFilePaths(file('foo.ts'), 'foo.ts')).toEqual(['foo.ts']);
  });

  it('returns all child file paths for a flat directory', () => {
    const node = dir('src', [file('a.ts'), file('b.ts')]);
    expect(getAllFilePaths(node, 'src')).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('returns an empty array for an empty directory', () => {
    expect(getAllFilePaths(dir('empty'), 'empty')).toEqual([]);
  });

  it('returns deeply nested file paths', () => {
    const node = dir('root', [dir('sub', [file('deep.ts')])]);
    expect(getAllFilePaths(node, 'root')).toEqual(['root/sub/deep.ts']);
  });

  it('returns all paths across multiple nested levels', () => {
    const node = dir('a', [
      file('top.ts'),
      dir('b', [file('nested.ts'), dir('c', [file('deep.ts')])]),
    ]);
    expect(getAllFilePaths(node, 'a').sort()).toEqual([
      'a/b/c/deep.ts',
      'a/b/nested.ts',
      'a/top.ts',
    ]);
  });
});

describe('getFolderState', () => {
  const tree = dir('src', [file('a.ts'), file('b.ts')]);

  it('returns unchecked when no files are selected', () => {
    expect(getFolderState(tree, new Set(), 'src')).toBe('unchecked');
  });

  it('returns checked when all files in the directory are selected', () => {
    expect(getFolderState(tree, new Set(['src/a.ts', 'src/b.ts']), 'src')).toBe(
      'checked'
    );
  });

  it('returns indeterminate when some but not all files are selected', () => {
    expect(getFolderState(tree, new Set(['src/a.ts']), 'src')).toBe(
      'indeterminate'
    );
  });

  it('returns unchecked for an empty directory', () => {
    expect(getFolderState(dir('empty'), new Set(), 'empty')).toBe('unchecked');
  });

  it('ignores selected paths outside the directory', () => {
    expect(getFolderState(tree, new Set(['other/file.ts']), 'src')).toBe(
      'unchecked'
    );
  });
});

describe('filterToPattern', () => {
  it('wraps plain text with wildcards', () => {
    expect(filterToPattern('foo')).toBe('*foo*');
  });

  it('leaves a glob pattern with * unchanged', () => {
    expect(filterToPattern('*.yml')).toBe('*.yml');
  });

  it('leaves a glob pattern with ? unchanged', () => {
    expect(filterToPattern('file?.ts')).toBe('file?.ts');
  });

  it('trims whitespace before wrapping plain text', () => {
    expect(filterToPattern('  foo  ')).toBe('*foo*');
  });

  it('trims whitespace before preserving a glob', () => {
    expect(filterToPattern('  *.yml  ')).toBe('*.yml');
  });

  it('handles empty string after trimming', () => {
    expect(filterToPattern('   ')).toBe('**');
  });
});

describe('isDirectoryWithChildren', () => {
  it('returns true for a directory that declares children', () => {
    expect(isDirectoryWithChildren(dir('src', [file('a.ts')]))).toBe(true);
  });

  it('returns false for a plain file', () => {
    expect(isDirectoryWithChildren(file('a.ts'))).toBe(false);
  });
});

describe('buildFileTree', () => {
  it('returns an empty tree for no paths', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('builds a flat list of files', () => {
    expect(buildFileTree(['b.ts', 'a.ts'])).toEqual([
      { name: 'a.ts' },
      { name: 'b.ts' },
    ]);
  });

  it('nests directories and sorts directories before files', () => {
    expect(
      buildFileTree(['z.ts', 'src/a.ts', 'src/nested/b.ts', 'src/c.ts'])
    ).toEqual([
      {
        name: 'src',
        children: [
          { name: 'nested', children: [{ name: 'b.ts' }] },
          { name: 'a.ts' },
          { name: 'c.ts' },
        ],
      },
      { name: 'z.ts' },
    ]);
  });

  it('ignores empty path segments from leading or duplicate slashes', () => {
    expect(buildFileTree(['/src//a.ts'])).toEqual([
      { name: 'src', children: [{ name: 'a.ts' }] },
    ]);
  });

  it('does not duplicate an existing file leaf', () => {
    expect(buildFileTree(['a.ts', 'a.ts'])).toEqual([{ name: 'a.ts' }]);
  });

  it('promotes a file node to a directory when a nested path reuses its name', () => {
    expect(buildFileTree(['src', 'src/a.ts'])).toEqual([
      { name: 'src', children: [{ name: 'a.ts' }] },
    ]);
  });

  it('sorts case-insensitively within a directory', () => {
    expect(buildFileTree(['B.ts', 'a.ts', 'C.ts'])).toEqual([
      { name: 'a.ts' },
      { name: 'B.ts' },
      { name: 'C.ts' },
    ]);
  });
});
