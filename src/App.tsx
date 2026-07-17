import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SetupPage } from '@/pages/SetupPage';
import { RecipePage } from '@/pages/RecipePage';
import { useStore } from '@/store/useStore';
import { setPageTitle } from '@/config/brand';

export default function App() {
  const { isSetupComplete } = useStore();

  useEffect(() => {
    setPageTitle();
  }, []);

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
        <Route
          path="/recipe"
          element={<RecipePage />}
        />
        <Route path="/setup" element={<SetupPage />} />
      </Routes>
    </Router>
  );
}