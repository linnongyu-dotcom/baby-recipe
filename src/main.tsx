import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/mealPlanCache'
import { initializeAnalytics, trackAppOpen } from './services/analytics'
import App from './App'
import './index.css'

initializeAnalytics()
trackAppOpen()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
