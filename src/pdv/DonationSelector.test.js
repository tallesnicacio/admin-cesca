import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import DonationSelector from './DonationSelector';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('atalhos de doação definem valores exatos sem acumular', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();

  act(() => root.render(<DonationSelector value={0} onChange={onChange} />));
  const twoReais = container.querySelector('[data-donation-centavos="200"]');
  const noDonation = container.querySelector('[data-donation-centavos="0"]');

  act(() => twoReais.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  act(() => twoReais.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  act(() => noDonation.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onChange.mock.calls).toEqual([[200], [200], [0]]);

  act(() => root.unmount());
  container.remove();
});
