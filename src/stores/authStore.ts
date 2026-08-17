import { create } from 'zustand';
import type { AuthUser } from '@/services/authService';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
export const useAuthStore = create<AuthState>(set => ({
  user: null, loading: true, error: null,
  setUser: user => set({ user, error: null }),
  setLoading: loading => set({ loading }),
  setError: error => set({ error }),
}));
