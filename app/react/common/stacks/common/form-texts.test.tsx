import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StackType } from '../types';

import { textByType } from './form-texts';

describe('textByType', () => {
  it('exposes docker compose editor texts', () => {
    const texts = textByType[StackType.DockerCompose];
    expect(texts.editor.placeholder).toMatch(/docker compose/i);
    expect(texts.upload).toMatch(/Compose file/i);

    render(<>{texts.editor.description}</>);
    expect(
      screen.getByRole('link', { name: /official documentation/i })
    ).toHaveAttribute('href', expect.stringContaining('compose-file'));
  });

  it('shares docker texts for swarm stacks', () => {
    expect(textByType[StackType.DockerSwarm]).toBe(
      textByType[StackType.DockerCompose]
    );
  });
});
