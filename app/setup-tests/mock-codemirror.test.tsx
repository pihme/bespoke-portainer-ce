import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeMirror, {
  oneDarkHighlightStyle,
  keymap,
} from '@uiw/react-codemirror';
import Merge, { MergeView, Original, Modified } from 'react-codemirror-merge';
import { yamlSchema, validation } from 'yaml-schema';

import { mockCodeMirror } from './mock-codemirror';

describe('mock-codemirror (backwards compatibility)', () => {
  it('renders the mocked CodeMirror textarea and fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CodeMirror
        value="hello"
        onChange={onChange}
        readOnly={false}
        placeholder="ph"
        height="100px"
        className="cm"
        id="cm-id"
        data-cy="cm"
      />
    );

    const area = screen.getByTestId('cm');
    expect(area).toHaveValue('hello');
    await user.clear(area);
    await user.type(area, 'x');
    expect(onChange).toHaveBeenCalled();
    expect(oneDarkHighlightStyle).toEqual({});
    expect(keymap.of()).toEqual({});
  });

  it('exposes merge and yaml-schema stubs', () => {
    expect(MergeView()).toBeTruthy();
    expect(Original()).toBeTruthy();
    expect(Modified()).toBeTruthy();
    expect(Merge).toBeTruthy();
    expect(yamlSchema()).toEqual([]);
    expect(validation().of()).toEqual({});
    expect(mockCodeMirror()).toBeUndefined();
  });
});
