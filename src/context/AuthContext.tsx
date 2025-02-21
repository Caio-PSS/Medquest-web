import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react'; // Import useRef
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

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
  logout: (redirect?: () => void) => void; // Modified logout function signature
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

  const navigateRef = useRef<ReturnType<typeof useNavigate> | null>(null); // Create a ref for useNavigate

  useEffect(() => {
    navigateRef.current = useNavigate(); // Initialize useNavigate in useEffect
  }, []);

  // Create a wrapper function to use navigate through the ref
  const navigate = useCallback((path: string) => {
    if (!navigateRef.current) {
      console.error("navigateRef.current is not initialized yet!");
      return;
    }
    navigateRef.current(path);
  }, []);


  const decodeToken = useCallback((token: string): AuthUser | null => {
    try {
      const decoded: DecodedToken = jwtDecode(token);
      return {
        id: decoded.id,
        email: decoded.email
      };
    } catch (error) {
      console.error("Token inválido:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('medquest_token');
    if (token) {
      const user = decodeToken(token);
      if (user) {
        setAuthToken(token);
        setAuthUser(user);
      }
    }
    setIsLoading(false);
  }, [decodeToken]);

  const logout = useCallback((redirect?: () => void) => { // Modified logout function implementation
    localStorage.removeItem('medquest_token');
    localStorage.removeItem('inactivity_expiry');
    setAuthToken(null);
    setAuthUser(null);
    if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);

    if (redirect) {
      redirect(); // Executa o redirecionamento, se for passado
    } else {
      navigate('/login'); // Use the wrapped navigate function
    }
  }, [inactivityTimeoutId, navigate]); // Added navigate to dependencies


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

  const resetInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);

    const newTimeoutId = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);

    setInactivityTimeoutId(newTimeoutId);
    localStorage.setItem('inactivity_expiry', (Date.now() + INACTIVITY_TIMEOUT).toString());
  }, [logout, inactivityTimeoutId]);

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

  const login = useCallback((token: string) => {
    const user = decodeToken(token);
    if (!user) return;

    localStorage.setItem('medquest_token', token);
    setAuthToken(token);
    setAuthUser(user);
    resetInactivityTimeout();
  }, [decodeToken, resetInactivityTimeout]);

  useEffect(() => {
    const checkAuthState = setInterval(checkTokenExpiration, 60000); // Verificar a cada minuto
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