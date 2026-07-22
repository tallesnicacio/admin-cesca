import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PaymentButtons from './PaymentButtons';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('PIX dispara uma nova confirmação em cliques consecutivos', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSelect = jest.fn();

  act(() => root.render(<PaymentButtons onSelect={onSelect} />));
  const pix = container.querySelector('.pdv-payment-pix');
  expect(pix).not.toBeNull();

  act(() => pix.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  act(() => pix.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onSelect.mock.calls).toEqual([['pix'], ['pix']]);

  act(() => root.unmount());
  container.remove();
});
