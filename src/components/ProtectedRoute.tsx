import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { authToken, isLoading } = useAuth();

  if (isLoading) return <div>Carregando...</div>;
  return authToken ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;