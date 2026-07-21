import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SetupPage } from '@/pages/SetupPage';
import { RecipePage } from '@/pages/RecipePage';
import { BabyProfilePage } from '@/pages/BabyProfilePage';
import { useStore } from '@/store/useStore';
import { setPageTitle } from '@/config/brand';

export default function App() {
  useEffect(() => {
    setPageTitle();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/recipe" element={<RecipePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/baby-profile" element={<BabyProfilePage />} />
      </Routes>
    </Router>
  );
}

function HomeRoute() {
  const { isSetupComplete, babies } = useStore();

  // 有宝宝了，直接进入食谱页
  if (babies.length > 0 && isSetupComplete) {
    return <Navigate to="/recipe" replace />;
  }
  // 有宝宝但还没生成食谱，进入设置页
  if (babies.length > 0) {
    return <Navigate to="/setup" replace />;
  }
  // 无宝宝，进入创建页
  return <Navigate to="/setup" replace />;
}
