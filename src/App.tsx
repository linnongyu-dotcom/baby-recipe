import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SetupPage } from '@/pages/SetupPage';
import { RecipePage } from '@/pages/RecipePage';
import { useStore } from '@/store/useStore';

export default function App() {
  const { isSetupComplete } = useStore();

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            isSetupComplete ? (
              <Navigate to="/recipe" replace />
            ) : (
              <Navigate to="/setup" replace />
            )
          }
        />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/recipe" element={<RecipePage />} />
      </Routes>
    </Router>
  );
}