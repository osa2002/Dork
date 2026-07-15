import { create } from "zustand";

export interface AuthState {
  user: any; // Can represent Firebase User or null
  loading: boolean;
  isAdmin: boolean;
  
  // Actions
  setUser: (user: any) => void;
  setLoading: (loading: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAdmin: false,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  logout: async () => {
    // Placeholder for actual Firebase signOut logic
    set({ user: null, isAdmin: false, loading: false });
  },
}));
