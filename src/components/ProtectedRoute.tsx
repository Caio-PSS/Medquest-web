import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { authToken, isLoading } = useAuth();

  if (isLoading) {
    return <div>Carregando...</div>; // Or a more appropriate loading state
  }

  return authToken ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;