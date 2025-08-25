
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders brand name', () => {
  render(<App />);
  const els = screen.getAllByText(/ReelsUp/i);
  expect(els.length).toBeGreaterThan(0);
});
