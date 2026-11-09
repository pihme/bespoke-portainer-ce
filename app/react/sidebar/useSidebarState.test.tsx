import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  SidebarProvider,
  TestSidebarProvider,
  useSidebarState,
  AngularSidebarService,
} from './useSidebarState';
import { sidebarStore } from './sidebarStore';

function Probe() {
  const { isOpen, toggle } = useSidebarState();
  return (
    <button type="button" onClick={toggle}>
      {isOpen ? 'open' : 'closed'}
    </button>
  );
}

describe('useSidebarState', () => {
  beforeEach(() => {
    window.ddExtension = false;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1200,
    });
    sidebarStore.setState({ isOpen: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when used outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useSidebarContext must be used within a SidebarProvider/
    );
  });

  it('TestSidebarProvider toggles open state', () => {
    render(
      <TestSidebarProvider>
        <Probe />
      </TestSidebarProvider>
    );

    expect(screen.getByText('open')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('SidebarProvider exposes store state and toggle', () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>
    );

    expect(screen.getByText('open')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(sidebarStore.getState().isOpen).toBe(false);
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('closes on mobile resize and restores previous open state', () => {
    vi.useFakeTimers();
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>
    );

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(60);
    });
    expect(sidebarStore.getState().isOpen).toBe(false);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1200,
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(60);
    });
    expect(sidebarStore.getState().isOpen).toBe(true);
    vi.useRealTimers();
  });

  it('skips resize listener when ddExtension is set', () => {
    window.ddExtension = true;
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>
    );
    expect(
      addSpy.mock.calls.some(([type]) => type === 'resize')
    ).toBe(false);
  });

  it('AngularSidebarService updates isOpen via $evalAsync', () => {
    const evalAsync = vi.fn((fn: () => void) => fn());
    const service = AngularSidebarService({
      $evalAsync: evalAsync,
    } as never);

    expect(service.isSidebarOpen()).toBe(false);
    service.setIsOpen(true);
    expect(evalAsync).toHaveBeenCalled();
    expect(service.isSidebarOpen()).toBe(true);
  });
});
