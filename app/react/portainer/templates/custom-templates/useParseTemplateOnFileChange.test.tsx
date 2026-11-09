import { renderHook, act } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { useParseTemplateOnFileChange } from './useParseTemplateOnFileChange';

const setFieldValue = vi.fn();
const setFieldError = vi.fn();

vi.mock('formik', () => ({
  useFormikContext: () => ({ setFieldValue, setFieldError }),
}));

vi.mock('../../custom-templates/components/utils', () => ({
  isTemplateVariablesEnabled: true,
  getTemplateVariables: (value: string) => {
    if (value.includes('bad')) {
      return [null, 'parse error'];
    }
    return [[{ name: 'VAR', label: 'Var', defaultValue: '', description: '' }], undefined];
  },
  intersectVariables: (_old: unknown, variables: unknown) => variables,
}));

describe('REQ-TPL-03 useParseTemplateOnFileChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses variables from compose content', () => {
    const { result } = renderHook(() => useParseTemplateOnFileChange([]));
    act(() => {
      result.current('image: {{ VAR }}');
    });
    expect(setFieldValue).toHaveBeenCalledWith(
      'FileContent',
      'image: {{ VAR }}',
      false
    );
    expect(setFieldValue).toHaveBeenCalledWith(
      'Variables',
      expect.arrayContaining([expect.objectContaining({ name: 'VAR' })])
    );
  });

  it('clears variables for empty content', () => {
    const { result } = renderHook(() => useParseTemplateOnFileChange([]));
    act(() => {
      result.current('');
    });
    expect(setFieldValue).toHaveBeenCalledWith('Variables', []);
  });

  it('sets a field error when the template is invalid', () => {
    const { result } = renderHook(() => useParseTemplateOnFileChange([]));
    act(() => {
      result.current('bad template');
    });
    expect(setFieldError).toHaveBeenCalledWith(
      'FileContent',
      expect.stringContaining('Template invalid')
    );
  });
});
