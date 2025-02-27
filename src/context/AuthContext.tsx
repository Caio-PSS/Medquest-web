import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  exp: number;
  id: number;
  email: string;
}

interface AuthUser {
  id: number;
  email: string;
}

type AuthContextType = {
  authToken: string | null;
  authUser: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
  resetInactivityTimeout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  authToken: null,
  authUser: null,
  login: () => {},
  logout: () => {},
  resetInactivityTimeout: () => {},
  isLoading: true
});

const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000; // 6 horas

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenExpirationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const decodeToken = useCallback((token: string): AuthUser | null => {
    try {
      const decoded: DecodedToken = jwtDecode(token);
      return { id: decoded.id, email: decoded.email };
    } catch (error) {
      console.error("Token inválido:", error);
      return null;
    }
  }, []);

  // 🔹 Função de logout otimizada
  const logout = useCallback(() => {
    localStorage.removeItem('medquest_token');
    localStorage.removeItem('inactivity_expiry');

    setAuthToken(null);
    setAuthUser(null);

    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    if (tokenExpirationTimeoutRef.current) clearTimeout(tokenExpirationTimeoutRef.current);

    window.location.href = '/login'; // Redirecionamento direto para evitar atrasos
  }, []);

  // 🔹 Agenda logout para quando o token expirar
  const scheduleTokenExpiration = useCallback((token: string) => {
    try {
      const decoded: DecodedToken = jwtDecode(token);
      const expirationTime = decoded.exp * 1000;
      const delay = expirationTime - Date.now();

      if (delay > 0) {
        tokenExpirationTimeoutRef.current = setTimeout(logout, delay);
      } else {
        logout();
      }
    } catch (error) {
      logout();
    }
  }, [logout]);

  // 🔹 Verificação inicial do token ao carregar a página
  useEffect(() => {
    const token = localStorage.getItem('medquest_token');
    if (token) {
      const user = decodeToken(token);
      if (user) {
        setAuthToken(token);
        setAuthUser(user);
        scheduleTokenExpiration(token);
      } else {
        localStorage.removeItem('medquest_token');
      }
    }
    setIsLoading(false);
  }, [decodeToken, scheduleTokenExpiration]);

  // 🔹 Reseta o timer de inatividade
  const resetInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);

    inactivityTimeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
    localStorage.setItem('inactivity_expiry', (Date.now() + INACTIVITY_TIMEOUT).toString());
  }, [logout]);

  // 🔹 Detecta atividade do usuário para resetar timeout
  useEffect(() => {
    const handleActivity = () => resetInactivityTimeout();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [resetInactivityTimeout]);

  // 🔹 Login otimizado
  const login = useCallback((token: string) => {
    const user = decodeToken(token);
    if (!user) {
      localStorage.removeItem('medquest_token');
      return;
    }

    localStorage.setItem('medquest_token', token);
    setAuthToken(token);
    setAuthUser(user);
    resetInactivityTimeout();
    scheduleTokenExpiration(token);
  }, [decodeToken, resetInactivityTimeout, scheduleTokenExpiration]);

  return (
    <AuthContext.Provider value={{
      authToken,
      authUser,
      login,
      logout,
      resetInactivityTimeout,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);