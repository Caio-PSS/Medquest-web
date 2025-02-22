import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthCheck = () => {
  const { logout, authToken, isLoading } = useAuth(); // Adicione isLoading
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !authToken) { // Só redirecione após o carregamento
      logout();
      navigate('/login');
    }
  }, [authToken, logout, navigate, isLoading]); // Adicione isLoading às dependências

  return null;
};

export default AuthCheck;