import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthCheck = () => {
  const { logout, authToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authToken && !localStorage.getItem('medquest_token')) {
      logout();
      navigate('/login');
    }
  }, [authToken, logout, navigate]);

  return null;
};

export default AuthCheck;