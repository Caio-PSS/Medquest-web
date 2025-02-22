// src/components/ProtectedRoute.tsx
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const { authToken, isLoading } = useAuth();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return authToken ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;