import { vi } from 'vitest';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(),
}));

vi.mock('@/portainer/services/notifications', () => ({
  error: vi.fn(),
}));

import {
  isLinuxTerminalCommand,
  LINUX_SHELL_INIT_COMMANDS,
} from './Terminal';

describe('REQ-CTR-12 isLinuxTerminalCommand', () => {
  it.each([
    'bash',
    'sh',
    'zsh',
    'ash',
    'dash',
    'fish',
    'csh',
    'ksh',
    '/bin/bash',
    '/usr/bin/zsh',
    '/bin/sh',
  ])('recognizes linux shell %s', (command) => {
    expect(isLinuxTerminalCommand(command)).toBe(true);
  });

  it.each(['powershell', 'cmd', 'pwsh', '/bin/powershell', 'python', ''])(
    'rejects non-linux shell %s',
    (command) => {
      expect(isLinuxTerminalCommand(command)).toBe(false);
    }
  );

  it('exports UTF-8 and color init commands used after a linux shell connects', () => {
    expect(LINUX_SHELL_INIT_COMMANDS).toEqual([
      'export LANG=C.UTF-8\n',
      'export LC_ALL=C.UTF-8\n',
      'export TERM="xterm-256color"\n',
      'alias ls="ls --color=auto"\n',
      'clear\n',
    ]);
  });
});
