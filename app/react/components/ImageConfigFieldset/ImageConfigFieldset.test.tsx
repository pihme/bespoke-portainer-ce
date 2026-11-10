import { render, fireEvent } from '@testing-library/react';

import { ImageConfigFieldset } from './ImageConfigFieldset';

function renderComponent(setFieldValue = vi.fn(), image = '') {
  return render(
    <ImageConfigFieldset values={{ image }} setFieldValue={setFieldValue}>
      <div>extra-child</div>
    </ImageConfigFieldset>
  );
}

it('REQ-IMG-02 renders the image name field and children', () => {
  const { getByLabelText, getByText } = renderComponent(vi.fn(), 'nginx');

  expect(getByLabelText(/Image/)).toHaveValue('nginx');
  expect(getByText('extra-child')).toBeInTheDocument();
});

it('REQ-IMG-02 sets the image name as typed', () => {
  const setFieldValue = vi.fn();
  const { getByLabelText } = renderComponent(setFieldValue);

  fireEvent.change(getByLabelText(/Image/), {
    target: { value: 'registry:5000/app:1' },
  });

  expect(setFieldValue).toHaveBeenCalledWith('image', 'registry:5000/app:1');
});

it('REQ-TAI-005 offers no registry picker, mode toggle or rate limit check', () => {
  const { queryByText, queryByLabelText } = renderComponent();

  expect(queryByText('Simple mode')).toBeNull();
  expect(queryByText('Advanced mode')).toBeNull();
  expect(queryByLabelText(/Registry/)).toBeNull();
  expect(queryByText(/rate limit/i)).toBeNull();
});
