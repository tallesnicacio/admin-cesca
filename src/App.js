import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import ptBR from 'antd/locale/pt_BR';
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
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: {
          colorPrimary: '#667eea',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#3b82f6',
          colorTextBase: '#1a1a1a',
          colorTextSecondary: '#666666',
          colorBorder: '#e8e8e8',
          colorBgContainer: '#ffffff',
          borderRadius: 12,
          fontSize: 15,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          lineHeight: 1.6,
          controlHeight: 40,
          controlHeightLG: 48,
          controlHeightSM: 32,
        },
        components: {
          Button: {
            fontWeight: 500,
            borderRadius: 10,
            controlHeight: 40,
            paddingContentHorizontal: 20,
          },
          Card: {
            borderRadiusLG: 16,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            paddingLG: 32,
          },
          Table: {
            borderRadius: 12,
            headerBg: '#fafafa',
            headerColor: '#666',
            fontSize: 14,
          },
          Input: {
            borderRadius: 10,
            controlHeight: 40,
          },
          Select: {
            borderRadius: 10,
            controlHeight: 40,
          },
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <Router>
          <AppContent />
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
