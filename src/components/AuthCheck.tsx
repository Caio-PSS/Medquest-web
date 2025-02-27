// src/components/AuthCheck.tsx
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthCheck = () => {
  const { logout, authToken, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Se já estiver carregando, não faz nada.
    // Se não houver token e não estiver na página de login, redireciona.
    if (!isLoading && !authToken && location.pathname !== '/login') {
      logout();
      window.location.href = '/login';
    }
  }, [authToken, isLoading, logout, navigate, location.pathname]);

  return null;
};

export default AuthCheck;