import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { companyApi, type Company } from '@/lib/api';
import { useAuth } from './AuthContext';

interface CompanyContextValue {
  companies: Company[];
  loading: boolean;
  refreshCompanies: () => Promise<void>;
  updateCompanyBranding: (company: Company) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCompanies = useCallback(async () => {
    if (!user?.isPlatformAdmin) {
      setCompanies([]);
      return;
    }
    setLoading(true);
    try {
      const data = await companyApi.listAll();
      setCompanies(data.companies);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.isPlatformAdmin]);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const updateCompanyBranding = useCallback((company: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? company : c)));
  }, []);

  const value = useMemo(
    () => ({
      companies,
      loading,
      refreshCompanies,
      updateCompanyBranding,
    }),
    [companies, loading, refreshCompanies, updateCompanyBranding]
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompanies() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompanies must be used within CompanyProvider');
  return ctx;
}
