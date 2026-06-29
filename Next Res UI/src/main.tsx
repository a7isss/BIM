import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ResPlanProvider } from './hooks/useResPlanData.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResPlanProvider>
      <App />
    </ResPlanProvider>
  </StrictMode>,
)
