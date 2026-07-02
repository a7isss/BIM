import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ResPlanProvider } from './resplan';

const root = document.getElementById('root');
if (!root) throw new Error("Could not find root element");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ResPlanProvider>
      <App />
    </ResPlanProvider>
  </React.StrictMode>
);
