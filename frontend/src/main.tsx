// Global styles first, so component styles can override them.
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAnalysisService } from './api';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const service = createAnalysisService();

createRoot(root).render(
  <StrictMode>
    <App service={service} />
  </StrictMode>,
);
