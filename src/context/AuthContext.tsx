import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
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
  const [inactivityTimeoutId, setInactivityTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const decodeToken = useCallback((token: string): AuthUser | null => {
    try {
      const decoded: DecodedToken = jwtDecode(token);
      return { id: decoded.id, email: decoded.email };
    } catch (error) {
      console.error("Token inválido:", error);
      return null;
    }
  }, []);

  // Verificação inicial do token
  useEffect(() => {
    const token = localStorage.getItem('medquest_token');
    if (token) {
      const user = decodeToken(token);
      if (user) {
        setAuthToken(token);
        setAuthUser(user);
      } else {
        localStorage.removeItem('medquest_token'); // Remove token inválido
      }
    }
    setIsLoading(false); // Finaliza o carregamento
  }, [decodeToken]);

  // Sistema de logout
  const logout = useCallback(() => {
    localStorage.removeItem('medquest_token');
    localStorage.removeItem('inactivity_expiry');
    setAuthToken(null);
    setAuthUser(null);
    if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
  }, [inactivityTimeoutId]);

  // Verificação de expiração do token
  const checkTokenExpiration = useCallback(() => {
    const token = localStorage.getItem('medquest_token');
    if (!token) return;

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (Date.now() >= decoded.exp * 1000) logout();
    } catch (error) {
      logout();
    }
  }, [logout]);

  // Sistema de inatividade
  const resetInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);

    const newTimeoutId = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);

    setInactivityTimeoutId(newTimeoutId);
    localStorage.setItem('inactivity_expiry', (Date.now() + INACTIVITY_TIMEOUT).toString());
  }, [logout, inactivityTimeoutId]);

  // Event listeners de atividade
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

  // Função de login
  const login = useCallback((token: string) => {
    const user = decodeToken(token);
    if (!user) {
      localStorage.removeItem('medquest_token'); // Limpa token inválido
      return;
    }

    localStorage.setItem('medquest_token', token);
    setAuthToken(token); // Atualiza estado imediatamente
    setAuthUser(user);
    resetInactivityTimeout();
  }, [decodeToken, resetInactivityTimeout]);

  // Verificação periódica do token
  useEffect(() => {
    const checkAuthState = setInterval(checkTokenExpiration, 60000);
    return () => clearInterval(checkAuthState);
  }, [checkTokenExpiration]);

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