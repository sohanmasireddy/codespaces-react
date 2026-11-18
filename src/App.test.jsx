import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders a simple greeting and provider configuration notice', async () => {
  render(<App />);
  expect(await screen.findByText(/Hello\. What would you like to work on/i)).toBeDefined();
  expect(screen.getByText(/Worker configuration is missing/i)).toBeDefined();
  expect(screen.getByRole('button', { name: /Check again/i })).toBeDefined();
});
