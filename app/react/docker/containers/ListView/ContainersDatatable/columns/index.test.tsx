import { render, screen } from '@testing-library/react';

import { useColumns } from './index';

function Probe({
  isGPUsColumnVisible,
}: {
  isGPUsColumnVisible: boolean | undefined;
}) {
  const columns = useColumns(isGPUsColumnVisible);
  return (
    <div data-cy="column-ids">{columns.map((column) => column.id).join(',')}</div>
  );
}

describe('REQ-CTR-01 containers datatable useColumns', () => {
  it('includes the gpus column when that flag is true and never a host column (REQ-TAI-007)', () => {
    render(<Probe isGPUsColumnVisible />);
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];

    expect(ids).toContain('name');
    expect(ids).toContain('state');
    expect(ids).toContain('actions');
    expect(ids).toContain('stack');
    expect(ids).toContain('image');
    expect(ids).toContain('created');
    expect(ids).toContain('ip');
    expect(ids).not.toContain('host');
    expect(ids).toContain('gpus');
    expect(ids).toContain('ports');
  });

  it('omits host and gpus columns when the gpus flag is false', () => {
    render(<Probe isGPUsColumnVisible={false} />);
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];

    expect(ids).not.toContain('host');
    expect(ids).not.toContain('gpus');
    expect(ids).toContain('name');
    expect(ids).toContain('ports');
  });

  it('treats undefined gpus flag as hidden', () => {
    render(<Probe isGPUsColumnVisible={undefined} />);
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];

    expect(ids).not.toContain('gpus');
  });
});
