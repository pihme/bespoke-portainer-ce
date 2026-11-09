import { render, screen } from '@testing-library/react';

import { useColumns } from './index';

function Probe({
  isHostColumnVisible,
  isGPUsColumnVisible,
}: {
  isHostColumnVisible: boolean;
  isGPUsColumnVisible: boolean | undefined;
}) {
  const columns = useColumns(isHostColumnVisible, isGPUsColumnVisible);
  return (
    <div data-cy="column-ids">{columns.map((column) => column.id).join(',')}</div>
  );
}

describe('REQ-CTR-01 containers datatable useColumns', () => {
  it('includes host and gpus columns when those flags are true', () => {
    render(<Probe isHostColumnVisible isGPUsColumnVisible />);
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];

    expect(ids).toContain('name');
    expect(ids).toContain('state');
    expect(ids).toContain('actions');
    expect(ids).toContain('stack');
    expect(ids).toContain('image');
    expect(ids).toContain('created');
    expect(ids).toContain('ip');
    expect(ids).toContain('host');
    expect(ids).toContain('gpus');
    expect(ids).toContain('ports');
  });

  it('omits host and gpus columns when those flags are false', () => {
    render(
      <Probe isHostColumnVisible={false} isGPUsColumnVisible={false} />
    );
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];

    expect(ids).not.toContain('host');
    expect(ids).not.toContain('gpus');
    expect(ids).toContain('name');
    expect(ids).toContain('ports');
  });

  it('treats undefined gpus flag as hidden', () => {
    render(
      <Probe isHostColumnVisible={false} isGPUsColumnVisible={undefined} />
    );
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];

    expect(ids).not.toContain('gpus');
  });
});
