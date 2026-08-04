import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { invalidateBrowserMealPlan } from './utils/mealPlanCache'
import './index.css'

async function startApp() {
  // App imports useStore. Load it only after localStorage has been migrated so
  // Zustand cannot hydrate the stale plan and later write it back over the fix.
  invalidateBrowserMealPlan()
  const { default: App } = await import('./App')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void startApp()
