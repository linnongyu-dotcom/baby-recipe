import { Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';

export default function Home() {
  const { isSetupComplete } = useStore();
  return <Navigate to={isSetupComplete ? '/recipe' : '/setup'} replace />;
}