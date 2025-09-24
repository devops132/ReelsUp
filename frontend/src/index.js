
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import { setupGlobalErrorHandlers } from './utils/setupErrorHandlers';

const root = createRoot(document.getElementById('root'));
setupGlobalErrorHandlers();
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
