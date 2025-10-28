
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { RequestProvider } from './context/RequestContext.tsx';
import { VendorProvider } from './context/VendorContext.tsx';
import { StoreProvider } from './context/StoreContext.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <RequestProvider>
        <VendorProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </VendorProvider>
      </RequestProvider>
    </AuthProvider>
  </React.StrictMode>
);