import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SetupPage } from '@/pages/SetupPage';
import { RecipePage } from '@/pages/RecipePage';
import { BabyProfilePage } from '@/pages/BabyProfilePage';
import { useStore } from '@/store/useStore';
import { setPageTitle } from '@/config/brand';
import { MyRecipesPage, NewUserRecipePage, UserRecipeDetailPage, UserRecipeFormPage } from '@/pages/MyRecipesPage';
import { initializeSync } from '@/services/syncCoordinator';
import { DataConflictDialog } from '@/components/auth/DataConflictDialog';

export default function App() {
  useEffect(() => {
    setPageTitle();
    void initializeSync();
  }, []);

  return (
    <Router>
      <DataConflictDialog />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/recipe" element={<RecipePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/baby-profile" element={<BabyProfilePage />} />
        <Route path="/my-recipes" element={<MyRecipesPage />} />
        <Route path="/my-recipes/new" element={<NewUserRecipePage />} />
        <Route path="/my-recipes/new/edit" element={<UserRecipeFormPage />} />
        <Route path="/my-recipes/:id" element={<UserRecipeDetailPage />} />
        <Route path="/my-recipes/:id/edit" element={<UserRecipeFormPage />} />
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
