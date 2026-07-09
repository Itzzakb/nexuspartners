import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyBranding,
  authApi,
  type Company,
  type User,
} from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: string;
    companyId: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setCompany: (company: Company) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const setCompany = useCallback((c: Company) => {
    setCompanyState(c);
    applyBranding(c);
    localStorage.setItem('company', JSON.stringify(c));
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      setCompanyState(null);
      setLoading(false);
      return;
    }

    try {
      const data = await authApi.me();
      setUser(data.user);
      setCompany(data.company);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('company');
      setUser(null);
      setCompanyState(null);
    } finally {
      setLoading(false);
    }
  }, [setCompany]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      setCompany(data.company);
    },
    [setCompany]
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      role?: string;
      companyId: string;
    }) => {
      const data = await authApi.register(payload);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      setCompany(data.company);
    },
    [setCompany]
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('company');
    setUser(null);
    setCompanyState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      company,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setCompany,
    }),
    [user, company, loading, login, register, logout, refreshUser, setCompany]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
