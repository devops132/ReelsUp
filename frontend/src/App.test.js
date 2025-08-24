
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders brand name', () => {
  render(<App />);
  const el = screen.getByText(/VideoMarket/i);
  expect(el).toBeInTheDocument();
});
