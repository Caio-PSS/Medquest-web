import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthCheck = () => {
  const { logout, authToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there's no valid authToken
    if (!authToken) {
      logout(); // Ensure localStorage is cleaned up
      navigate('/login');
    }
  }, [authToken, logout, navigate]);

  return null;
};

export default AuthCheck;