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
  recruiterAuthApi,
  applyRecruiterBranding,
  getStoredRecruiterCompany,
} from '@/lib/recruiterApi';
import type { RecruiterAccount, RecruiterCompany } from '@/types/recruiterPortal';

interface RecruiterAuthContextValue {
  recruiter: RecruiterAccount | null;
  company: RecruiterCompany | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshRecruiter: () => Promise<void>;
}

const RecruiterAuthContext = createContext<RecruiterAuthContextValue | null>(null);

export function RecruiterAuthProvider({ children }: { children: ReactNode }) {
  const [recruiter, setRecruiter] = useState<RecruiterAccount | null>(null);
  const [company, setCompany] = useState<RecruiterCompany | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshRecruiter = useCallback(async () => {
    const token = localStorage.getItem('recruiterAccessToken');
    if (!token) {
      setRecruiter(null);
      setCompany(null);
      setLoading(false);
      return;
    }

    const storedCompany = getStoredRecruiterCompany();
    if (storedCompany) applyRecruiterBranding(storedCompany);

    try {
      const data = await recruiterAuthApi.me();
      setRecruiter(data.recruiter);
      setCompany(data.company);
      recruiterAuthApi.storeSession(token, data.company);
    } catch {
      recruiterAuthApi.clearSession();
      setRecruiter(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecruiter();
  }, [refreshRecruiter]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await recruiterAuthApi.login(username, password);
    recruiterAuthApi.storeSession(data.accessToken, data.company);
    setRecruiter(data.recruiter);
    setCompany(data.company);
  }, []);

  const logout = useCallback(() => {
    recruiterAuthApi.clearSession();
    setRecruiter(null);
    setCompany(null);
  }, []);

  const value = useMemo(
    () => ({ recruiter, company, loading, login, logout, refreshRecruiter }),
    [recruiter, company, loading, login, logout, refreshRecruiter]
  );

  return (
    <RecruiterAuthContext.Provider value={value}>{children}</RecruiterAuthContext.Provider>
  );
}

export function useRecruiterAuth() {
  const ctx = useContext(RecruiterAuthContext);
  if (!ctx) throw new Error('useRecruiterAuth must be used within RecruiterAuthProvider');
  return ctx;
}
