import React from 'react';

import { MockingGUIBoundary } from '@kakaocloud/mocking-gui/browser';
import ReactDOM from 'react-dom/client';

import App from './App';
import { mockConfig } from './mocks/config';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MockingGUIBoundary config={mockConfig}>
      <App />
    </MockingGUIBoundary>
  </React.StrictMode>,
);
