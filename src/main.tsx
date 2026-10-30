import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { WorkspaceProvider } from './app';
import { ThemeProvider } from './core/theme';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </ThemeProvider>
  </StrictMode>,
);
