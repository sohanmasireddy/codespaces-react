import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the chat workspace and provider configuration notice', async () => {
  render(<App />);
  expect(await screen.findByText(/What can I help/i)).toBeDefined();
  expect(screen.getByText(/No demo responses are generated/i)).toBeDefined();
});
