import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@@/CodeEditor', () => ({
  CodeEditor: ({
    id,
    value,
    textTip,
  }: {
    id: string;
    value?: string;
    textTip?: string;
  }) => (
    <textarea
      id={id}
      data-cy="code-editor"
      defaultValue={value}
      aria-label={textTip || 'editor'}
    />
  ),
}));

vi.mock('./CodeEditor/ShortcutsTooltip', () => ({
  ShortcutsTooltip: () => <span>shortcuts</span>,
}));

const usePreventFormExit = vi.fn();

vi.mock('./form-components/usePreventFormExit', () => ({
  usePreventFormExit: (...args: unknown[]) => usePreventFormExit(...args),
}));

vi.mock('./modals/confirm', () => ({
  confirmWebEditorDiscard: vi.fn(),
}));

import { WebEditorForm, usePreventExit } from './WebEditorForm';

function PreventExitProbe({
  initial,
  value,
}: {
  initial: string;
  value: string;
}) {
  usePreventExit(initial, value, true);
  return <div>probe</div>;
}

describe('WebEditorForm', () => {
  it('renders the default title, children tip, error, and editor', () => {
    render(
      <WebEditorForm
        id="compose"
        value="services:"
        onChange={() => {}}
        error="bad yaml"
      >
        Tip text
      </WebEditorForm>
    );
    expect(screen.getByText('Web editor')).toBeVisible();
    expect(screen.getByText('Tip text')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('bad yaml');
    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.getByText('shortcuts')).toBeVisible();
  });

  it('hides the title when hideTitle is set', () => {
    render(
      <WebEditorForm
        id="compose2"
        value=""
        onChange={() => {}}
        hideTitle
        titleContent="Custom"
      />
    );
    expect(screen.queryByText('Web editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });
});

describe('usePreventExit', () => {
  it('registers a change check that ignores newline differences', () => {
    usePreventFormExit.mockClear();
    render(<PreventExitProbe initial={'a\nb'} value="ab" />);
    expect(usePreventFormExit).toHaveBeenCalled();
    const checkFn = usePreventFormExit.mock.calls.at(-1)?.[0] as () => boolean;
    expect(checkFn()).toBe(false);

    render(<PreventExitProbe initial="hello" value="world" />);
    const changed = usePreventFormExit.mock.calls.at(-1)?.[0] as () => boolean;
    expect(changed()).toBe(true);
  });
});
