import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Session from './pages/Session';
import Stats from './pages/Stats';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/session" element={<Session />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}