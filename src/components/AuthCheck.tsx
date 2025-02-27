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

  // Usando useRef para armazenar os IDs dos timeouts sem causar re-renderizações
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

  // Função de logout, que limpa os timeouts via referências
  const logout = useCallback(() => {
    localStorage.removeItem('medquest_token');
    localStorage.removeItem('inactivity_expiry');
    setAuthToken(null);
    setAuthUser(null);
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    if (tokenExpirationTimeoutRef.current) {
      clearTimeout(tokenExpirationTimeoutRef.current);
      tokenExpirationTimeoutRef.current = null;
    }
  }, []);

  // Agenda o logout exatamente no momento da expiração do token
  const scheduleTokenExpiration = useCallback((token: string) => {
    try {
      const decoded: DecodedToken = jwtDecode(token);
      const expirationTime = decoded.exp * 1000;
      const delay = expirationTime - Date.now();
      if (delay > 0) {
        tokenExpirationTimeoutRef.current = setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, delay);
      } else {
        logout();
        window.location.href = '/login';
      }
    } catch (error) {
      logout();
      window.location.href = '/login';
    }
  }, [logout]);

  // Reseta o timer de inatividade sem causar re-renderizações desnecessárias
  const resetInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    inactivityTimeoutRef.current = setTimeout(() => {
      logout();
      window.location.href = '/login';
    }, INACTIVITY_TIMEOUT);
    localStorage.setItem('inactivity_expiry', (Date.now() + INACTIVITY_TIMEOUT).toString());
  }, [logout]);

  // Verificação inicial do token armazenado
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

  // Adiciona os event listeners de atividade apenas uma vez
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

  // Função de login que agenda os timeouts de inatividade e expiração do token
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