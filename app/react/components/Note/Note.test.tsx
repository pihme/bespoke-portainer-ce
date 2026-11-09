import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Note } from './Note';

describe('Note', () => {
  it('renders a static label and textarea when not expandable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Note onChange={onChange} defaultIsOpen value="hello" />);
    expect(screen.getByText('Note')).toBeVisible();
    const area = screen.getByPlaceholderText(
      /Enter a note about this application/
    );
    expect(area).toHaveValue('hello');
    await user.type(area, '!');
    expect(onChange).toHaveBeenCalled();
  });

  it('toggles expandable note and shows required minLength error', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Note
        onChange={onChange}
        isExpandable
        isRequired
        minLength={5}
        value="ab"
      />
    );
    // required forces open
    expect(
      screen.getByPlaceholderText(/Enter a note about this application/)
    ).toBeVisible();
    expect(screen.getByText(/2 of the 5 characters minimum/)).toBeVisible();

    await user.click(screen.getByTestId('k8sAppDetail-expandNoteButton'));
    expect(
      screen.queryByPlaceholderText(/Enter a note about this application/)
    ).not.toBeInTheDocument();
  });

  it('reports singular character minimum when value is empty', () => {
    render(
      <Note onChange={vi.fn()} defaultIsOpen isRequired minLength={1} value="" />
    );
    expect(screen.getByText(/0 of the 1 character minimum/)).toBeVisible();
  });

  it('stays closed when expandable and not required by default', () => {
    render(<Note onChange={vi.fn()} isExpandable />);
    expect(
      screen.queryByPlaceholderText(/Enter a note about this application/)
    ).not.toBeInTheDocument();
  });
});
