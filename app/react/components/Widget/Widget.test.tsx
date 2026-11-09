import { render, screen } from '@testing-library/react';
import { Box } from 'lucide-react';
import { createRef } from 'react';

import { Widget as WidgetRoot, useWidgetContext } from './Widget';
import { WidgetBody } from './WidgetBody';
import { WidgetFooter } from './WidgetFooter';
import { WidgetIcon } from './WidgetIcon';
import { WidgetTaskbar } from './WidgetTaskbar';
import { WidgetTitle } from './WidgetTitle';
import { Loading } from './Loading';
import * as WidgetBarrel from './index';

describe('Widget chrome (backwards compatibility)', () => {
  it('composes title body footer taskbar and loading states', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <WidgetRoot mRef={ref} data-cy="widget" className="extra" id="w1">
        <WidgetTitle title="My widget" icon={Box} subtitle="details">
          <span>actions</span>
        </WidgetTitle>
        <WidgetTaskbar className="task">
          <button type="button">Task</button>
        </WidgetTaskbar>
        <WidgetBody>
          <p>Body content</p>
        </WidgetBody>
        <WidgetFooter>Footer content</WidgetFooter>
      </WidgetRoot>
    );

    expect(screen.getByTestId('widget')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'My widget' })).toBeVisible();
    expect(screen.getByText('details')).toBeVisible();
    expect(screen.getByText('Body content')).toBeVisible();
    expect(screen.getByText('Footer content')).toBeVisible();
    expect(screen.getByText('Task')).toBeVisible();
    expect(screen.getByText('actions')).toBeVisible();
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it('shows loading spinner instead of body content', () => {
    render(
      <WidgetRoot aria-label="loading-widget">
        <WidgetBody loading>
          <p>hidden</p>
        </WidgetBody>
      </WidgetRoot>
    );

    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    expect(document.querySelector('.loading')).toBeTruthy();
  });

  it('renders WidgetIcon and standalone Loading', () => {
    render(
      <>
        <WidgetIcon icon={Box} />
        <Loading />
      </>
    );
    expect(document.querySelector('.loading')).toBeTruthy();
  });

  it('exposes useWidgetContext titleId when aria-label is absent', () => {
    function Probe() {
      const ctx = useWidgetContext();
      return <span data-cy="title-id">{ctx.titleId}</span>;
    }
    render(
      <WidgetRoot>
        <Probe />
      </WidgetRoot>
    );
    expect(screen.getByTestId('title-id').textContent).toMatch(/^widget-title-/);
  });

  it('clears titleId when aria-label is provided', () => {
    function Probe() {
      const ctx = useWidgetContext();
      return <span data-cy="title-id">{String(ctx.titleId)}</span>;
    }
    render(
      <WidgetRoot aria-label="named">
        <Probe />
      </WidgetRoot>
    );
    expect(screen.getByTestId('title-id')).toHaveTextContent('undefined');
  });

  it('wires compound components on the barrel export', () => {
    expect(WidgetBarrel.Widget.Body).toBe(WidgetBody);
    expect(WidgetBarrel.Widget.Footer).toBe(WidgetFooter);
    expect(WidgetBarrel.Widget.Title).toBe(WidgetTitle);
    expect(WidgetBarrel.Widget.Taskbar).toBe(WidgetTaskbar);
    expect(WidgetBarrel.Widget.Loading).toBe(Loading);
    expect(WidgetBarrel.Loading).toBe(Loading);
  });
});
