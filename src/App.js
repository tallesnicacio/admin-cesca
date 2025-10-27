import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SetPassword from './components/SetPassword';
import AuthCallback from './components/AuthCallback';
import './App.css';

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      // Se há sessão e está na raiz ou login, verificar se precisa definir senha
      if (session && (location.pathname === '/' || location.pathname === '/login')) {
        // Verificar se é signup redirect (novo usuário)
        const params = new URLSearchParams(location.search);
        if (params.get('type') === 'signup' || params.get('next') === '/set-password') {
          navigate('/set-password', { replace: true });
        }
      }
    });

    // Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      // Se é um signup, redirecionar para set-password
      if (event === 'SIGNED_IN' && session) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('type') === 'signup' || params.get('next') === '/set-password') {
          navigate('/set-password', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        {/* Rota de callback de autenticação - DEVE VIR PRIMEIRO */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Rota para definir senha após confirmação de email */}
        <Route path="/set-password" element={<SetPassword />} />

        {/* Rota de login */}
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/" />}
        />

        {/* Rota principal (dashboard) */}
        <Route
          path="/"
          element={session ? <Dashboard session={session} /> : <Navigate to="/login" />}
        />

        {/* Rota catch-all para redirecionar para home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
