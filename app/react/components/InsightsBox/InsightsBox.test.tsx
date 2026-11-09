import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { InsightsBox } from './InsightsBox';
import { insightStore } from './insights-store';

describe('InsightsBox', () => {
  beforeEach(() => {
    insightStore.setState({ insightIDsClosed: [] });
    localStorage.clear();
  });

  it('displays a header and content', async () => {
    render(<InsightsBox header="test header" content="test content" />);
    expect(await screen.findByText('test header')).toBeTruthy();
    expect(await screen.findByText('test content')).toBeTruthy();
  });

  it('renders slim type with only content and no header', () => {
    render(
      <InsightsBox
        content={<span>only content</span>}
        type="slim"
        className="extra"
        insightCloseId="slim-id"
      />
    );
    expect(screen.getByText('only content')).toBeVisible();
    expect(screen.getByTestId('insight-close-slim-id')).toBeVisible();
  });

  it('hides after the close button is clicked and stays hidden', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <InsightsBox
        header="tip"
        content="body"
        insightCloseId="close-me"
      />
    );
    await user.click(screen.getByTestId('insight-close-close-me'));
    expect(insightStore.getState().isClosed('close-me')).toBe(true);

    rerender(
      <InsightsBox header="tip" content="body" insightCloseId="close-me" />
    );
    expect(screen.queryByText('tip')).not.toBeInTheDocument();
  });

  it('treats missing insight ids as open and handles empty store lists', () => {
    expect(insightStore.getState().isClosed()).toBe(false);
    insightStore.setState({ insightIDsClosed: undefined as never });
    expect(insightStore.getState().isClosed('x')).toBe(false);
    insightStore.getState().addInsightIDClosed('x');
    expect(insightStore.getState().insightIDsClosed).toContain('x');
  });
});
