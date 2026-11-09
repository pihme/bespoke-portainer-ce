import { fireEvent, render, screen } from '@testing-library/react';
import { Formik } from 'formik';

import { mockFormValues } from '../test-utils';

import { UploadSection } from './UploadSection';
import { UploadFormValues } from './types';

describe('UploadSection', () => {
  it('should render the upload section', () => {
    renderComponent();

    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(
      screen.getByText(/You can upload a Compose file from your computer/)
    ).toBeInTheDocument();
  });

  it('should render with uploaded file', () => {
    const fileName = 'docker-compose.yml';
    const file = new File(['test content'], fileName, {
      type: 'text/yaml',
    });

    renderComponent({ initialValues: { file } });

    expect(screen.getByText(fileName)).toBeInTheDocument();
  });

  it('should update formik when a file is selected', () => {
    renderComponent();
    const input = screen.getByTestId('stack-creation-file-upload-input');
    const file = new File(['services:\n  web:\n    image: nginx'], 'compose.yml', {
      type: 'text/yaml',
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('compose.yml')).toBeInTheDocument();
  });

});

function renderComponent({
  initialValues = {},
}: {
  initialValues?: Partial<UploadFormValues>;
} = {}) {
  const values = mockFormValues({
    method: 'upload',
    upload: {
      file: null,
      ...initialValues,
    },
  });

  return render(
    <Formik initialValues={values} onSubmit={() => {}} validateOnMount>
      <UploadSection />
    </Formik>
  );
}
