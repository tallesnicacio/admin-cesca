import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Pegar parâmetros da URL
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const next = searchParams.get('next');

      console.log('AuthCallback - params:', { tokenHash, type, next });

      // Verificar se é um signup
      if (type === 'signup' || next === '/set-password') {
        // Aguardar o Supabase processar o token
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verificar se há sessão
        const { data: { session } } = await supabase.auth.getSession();

        console.log('AuthCallback - session:', session);

        if (session) {
          // Redirecionar para set-password
          console.log('AuthCallback - redirecting to /set-password');
          navigate('/set-password', { replace: true });
        } else {
          // Se não há sessão, pode ser que o token esteja expirado
          setError('Link expirado ou inválido. Por favor, solicite um novo link de confirmação.');
        }
      } else {
        // Não é signup, redirecionar para login
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error('Error in auth callback:', err);
      setError('Erro ao processar confirmação. Tente novamente.');
    }
  };

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>Erro</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Processando confirmação de email...
        </p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AuthCallback;
