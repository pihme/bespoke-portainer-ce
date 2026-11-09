import { vi } from 'vitest';

import { openModal } from './open-modal';

describe('openModal', () => {
  it('renders a modal, resolves on submit, and cleans up the DOM node', async () => {
    function FakeModal({ onSubmit }: { onSubmit: (v: string) => void }) {
      onSubmit('ok');
      return <div data-cy="fake-modal">modal</div>;
    }

    await expect(openModal(FakeModal, {})).resolves.toBe('ok');
    expect(document.querySelector('[id^="dialog-"]')).toBeNull();
  });
});
