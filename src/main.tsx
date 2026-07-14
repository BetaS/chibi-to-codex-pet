import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeGoogleAnalytics } from './analytics/ga4'
import { App } from './App'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('APP_ROOT_NOT_FOUND')
}

initializeGoogleAnalytics()

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
