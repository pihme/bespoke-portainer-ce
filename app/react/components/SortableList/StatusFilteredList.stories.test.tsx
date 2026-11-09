import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

// Demo is the story meta component; importing the module executes story play helpers' definitions.
import meta from './StatusFilteredList.stories';

vi.mock('@reach/menu-button');

describe('StatusFilteredList.stories (backwards compatibility)', () => {
  it('Default Demo renders the summary bar and list items', async () => {
    const Demo = meta.component;
    render(<Demo />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /filter by error/i })
    ).toBeInTheDocument();
  });

  it('summary bar Error filter narrows the list while Name stays active', async () => {
    const user = userEvent.setup();
    const Demo = meta.component;
    render(<Demo />);

    await user.click(
      screen.getByRole('radio', { name: /filter by error/i })
    );

    expect(
      screen.getByRole('radio', { name: /filter by error/i })
    ).toBeChecked();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Name/i })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('Status group filter syncs the summary bar', async () => {
    const user = userEvent.setup();
    const Demo = meta.component;
    render(<Demo />);

    await user.click(screen.getByRole('button', { name: /^Status/i }));
    await user.click(screen.getByRole('menuitem', { name: /Error/i }));

    expect(
      screen.getByRole('radio', { name: /filter by error/i })
    ).toBeChecked();
    expect(
      screen.getByRole('button', { name: /^Status/i })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggling Error off restores all items', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('radio', { name: /filter by error/i }));
    await user.click(screen.getByRole('radio', { name: /filter by error/i }));

    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /filter by total/i })
    ).toBeChecked();
  });

  it('Type group filter keeps a summary-bar Error filter', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('radio', { name: /filter by error/i }));
    await user.click(screen.getByRole('button', { name: /^Type/i }));
    await user.click(screen.getByRole('menuitem', { name: /Stack/i }));

    expect(
      screen.getByRole('radio', { name: /filter by error/i })
    ).toBeChecked();
    expect(screen.getByRole('button', { name: /^Type/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
  });

  it('switching to Name clears a Status group filter', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('button', { name: /^Status/i }));
    await user.click(screen.getByRole('menuitem', { name: /Error/i }));
    await user.click(screen.getByRole('button', { name: /^Name/i }));

    expect(
      screen.getByRole('radio', { name: /filter by total/i })
    ).toBeChecked();
    expect(screen.getByRole('button', { name: /^Name/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('Platform dimension filter works after a Type filter', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('radio', { name: /filter by error/i }));
    await user.click(screen.getByRole('button', { name: /^Type/i }));
    await user.click(screen.getByRole('menuitem', { name: /Stack/i }));
    await user.click(screen.getByRole('button', { name: /^Platform/i }));
    await user.click(screen.getByRole('menuitem', { name: /Linux/i }));

    expect(
      screen.getByRole('radio', { name: /filter by error/i })
    ).toBeChecked();
    expect(screen.getByRole('button', { name: /^Platform/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('selecting All on Status clears the group filter', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('button', { name: /^Status/i }));
    await user.click(screen.getByRole('menuitem', { name: /Error/i }));
    await user.click(screen.getByRole('button', { name: /^Status/i }));
    await user.click(screen.getByRole('menuitem', { name: /^All$/i }));

    expect(
      screen.getByRole('radio', { name: /filter by total/i })
    ).toBeChecked();
    expect(screen.getByRole('button', { name: /^Status/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('summary bar Healthy overrides a Status Error group filter', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('button', { name: /^Status/i }));
    await user.click(screen.getByRole('menuitem', { name: /Error/i }));
    await user.click(screen.getByRole('radio', { name: /filter by healthy/i }));

    expect(
      screen.getByRole('radio', { name: /filter by healthy/i })
    ).toBeChecked();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('Status Outdated group filter overrides a Healthy summary filter', async () => {
    const user = userEvent.setup();
    render(<meta.component />);

    await user.click(screen.getByRole('radio', { name: /filter by healthy/i }));
    await user.click(screen.getByRole('button', { name: /^Status/i }));
    await user.click(screen.getByRole('menuitem', { name: /Outdated/i }));

    expect(
      screen.getByRole('radio', { name: /filter by outdated/i })
    ).toBeChecked();
    expect(screen.getByText('Eta')).toBeInTheDocument();
  });

});
