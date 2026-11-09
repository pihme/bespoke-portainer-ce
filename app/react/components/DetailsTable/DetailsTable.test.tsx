import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DetailsTable } from './index';

describe('DetailsTable', () => {
  it('displays child row elements', () => {
    const person = {
      name: 'Bob',
      id: 'dmsjs1532',
    };

    render(
      <DetailsTable dataCy="details-table">
        <DetailsTable.Row label="Name">{person.name}</DetailsTable.Row>
        <DetailsTable.Row label="Id">{person.id}</DetailsTable.Row>
      </DetailsTable>
    );

    expect(screen.getByText(person.name)).toBeVisible();
    expect(screen.getByText(person.id)).toBeVisible();
  });

  it('renders headers and an empty message when there are no rows', () => {
    render(
      <DetailsTable
        dataCy="empty-table"
        headers={['Label', 'Value']}
        emptyMessage="Nothing here"
        className="extra"
      />
    );

    expect(screen.getByText('Label')).toBeVisible();
    expect(screen.getByText('Value')).toBeVisible();
    expect(screen.getByText('Nothing here')).toBeVisible();
  });

  it('renders extra columns and uses ariaLabel for non-string labels', () => {
    render(
      <DetailsTable dataCy="cols">
        <DetailsTable.Row
          label={<strong>Owner</strong>}
          ariaLabel="Owner"
          columns={['extra']}
          colClassName="cell"
        >
          alice
        </DetailsTable.Row>
      </DetailsTable>
    );

    expect(screen.getByText('alice')).toBeVisible();
    expect(screen.getByText('extra')).toBeVisible();
    expect(screen.getByLabelText('Owner')).toBeInTheDocument();
  });
});
