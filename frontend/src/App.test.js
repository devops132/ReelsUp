
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders logo', () => {
  render(<App />);
  const el = screen.getByAltText(/ReelsUp/i);
  expect(el).toBeInTheDocument();
});
