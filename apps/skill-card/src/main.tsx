import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-mcp-app-kit/styles/host-tokens.css';
import '@epam/ai-dial-mcp-app-kit/styles/layout.css';
import './styles/index.css';
import { createMcpApp } from '@epam/ai-dial-mcp-app-kit';
import { McpAppProvider } from '@epam/ai-dial-mcp-app-kit/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { name, version } from '../package.json';
import App from './App';

const app = createMcpApp({ name, version });
app.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <McpAppProvider app={app}>
      <App />
    </McpAppProvider>
  </StrictMode>,
);
