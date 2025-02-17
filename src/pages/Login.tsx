// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth from the correct context
import { useNavigate, Link } from 'react-router-dom';
import React from 'react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth(); // Use the global AuthContext
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`https://medquest-floral-log-224.fly.dev/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const { token } = await response.json();
      login(token);
      navigate('/');
      // Reload the page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (err) {
      alert('Erro no login!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="p-8 bg-white rounded-lg shadow-md w-96">
        <h2 className="text-2xl mb-6 text-center font-bold">MedQuest Login</h2>

        <div className="mb-4">
          <label className="block mb-2">Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2">Senha:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Entrar
        </button>

        <p className="text-center mt-4">
          Não tem conta? <Link to="/register" className="text-blue-600">Registre-se</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;