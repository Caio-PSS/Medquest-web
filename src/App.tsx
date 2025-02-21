import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';
import Stats from './pages/Stats';
import SessionStats from './pages/SessionStats';
import Register from './components/Register';
import AuthCheck from './components/AuthCheck';
import { Analytics } from '@vercel/analytics/react'; // Import Analytics

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthCheck />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/session" element={<Session />} />
            <Route path="/session-stats" element={<SessionStats />} />
            <Route path="/stats" element={<Stats />} />
          </Route>
        </Routes>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;