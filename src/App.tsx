import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';
import Stats from './pages/Stats';
import Feedback from './pages/Feedback';
import Register from './components/Register';
import AuthCheck from './components/AuthCheck';
import GamificationPage from './pages/GamificationPage';
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
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/gamification" element={<GamificationPage />} />
          </Route>
        </Routes>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;