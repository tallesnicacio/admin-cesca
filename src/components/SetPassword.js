import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import './SetPassword.css';

function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const navigate = useNavigate();

  // Validação de senha
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  const isPasswordValid = Object.values(passwordRequirements).every(req => req);
  const passwordsMatch = password === confirmPassword && password !== '';

  useEffect(() => {
    checkEmailConfirmation();
  }, []);

  const checkEmailConfirmation = async () => {
    try {
      setCheckingToken(true);

      // Verificar se há uma sessão ativa (após confirmação de email)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Link inválido ou expirado. Por favor, solicite um novo link de confirmação.');
        setIsValidToken(false);
        setCheckingToken(false);
        return;
      }

      // Usuário confirmou o email com sucesso
      setIsValidToken(true);
      setUserName(session.user.user_metadata?.name || session.user.email);
      setCheckingToken(false);

    } catch (err) {
      console.error('Erro ao verificar token:', err);
      setError('Erro ao validar confirmação de email');
      setIsValidToken(false);
      setCheckingToken(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!isPasswordValid) {
      setError('A senha não atende a todos os requisitos');
      return;
    }

    if (!passwordsMatch) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);

      // Atualizar senha do usuário
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      console.error('Erro ao definir senha:', err);
      setError(err.message || 'Erro ao definir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (checkingToken) {
    return (
      <div className="set-password-container">
        <div className="set-password-box">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Verificando confirmação de email...</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="set-password-container">
        <div className="set-password-box">
          <div className="error-state">
            <AlertCircle size={48} color="#ef4444" />
            <h2>Link Inválido ou Expirado</h2>
            <p>{error}</p>
            <button
              className="btn-primary"
              onClick={() => navigate('/login')}
            >
              Voltar para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="set-password-container">
        <div className="set-password-box">
          <div className="success-state">
            <CheckCircle size={64} color="#10b981" />
            <h2>Senha Definida com Sucesso!</h2>
            <p>Você será redirecionado para a página de login...</p>
          </div>
        </div>
      </div>
    );
  }

  // Set password form
  return (
    <div className="set-password-container">
      <div className="set-password-box">
        <div className="set-password-header">
          <Lock size={48} />
          <h1>Defina sua Senha</h1>
          <p>Olá, {userName}! Crie uma senha segura para acessar o sistema.</p>
        </div>

        <form onSubmit={handleSetPassword} className="set-password-form">
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Password field */}
          <div className="form-group">
            <label>Nova Senha</label>
            <div className="password-input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                required
                autoFocus
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Password requirements */}
          {password && (
            <div className="password-requirements">
              <p className="requirements-title">A senha deve conter:</p>
              <ul>
                <li className={passwordRequirements.minLength ? 'valid' : ''}>
                  {passwordRequirements.minLength ? '✓' : '○'} Mínimo 8 caracteres
                </li>
                <li className={passwordRequirements.hasUpper ? 'valid' : ''}>
                  {passwordRequirements.hasUpper ? '✓' : '○'} Uma letra maiúscula
                </li>
                <li className={passwordRequirements.hasLower ? 'valid' : ''}>
                  {passwordRequirements.hasLower ? '✓' : '○'} Uma letra minúscula
                </li>
                <li className={passwordRequirements.hasNumber ? 'valid' : ''}>
                  {passwordRequirements.hasNumber ? '✓' : '○'} Um número
                </li>
                <li className={passwordRequirements.hasSpecial ? 'valid' : ''}>
                  {passwordRequirements.hasSpecial ? '✓' : '○'} Um caractere especial (!@#$%^&*)
                </li>
              </ul>
            </div>
          )}

          {/* Confirm password field */}
          <div className="form-group">
            <label>Confirmar Senha</label>
            <div className="password-input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite novamente sua senha"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && (
              <span className={`match-indicator ${passwordsMatch ? 'match' : 'no-match'}`}>
                {passwordsMatch ? '✓ As senhas coincidem' : '✗ As senhas não coincidem'}
              </span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="btn-primary btn-full-width"
            disabled={loading || !isPasswordValid || !passwordsMatch}
          >
            {loading ? 'Definindo senha...' : 'Definir Senha e Acessar'}
          </button>
        </form>

        <div className="set-password-footer">
          <p>Ao definir sua senha, você poderá acessar o sistema Admin CESCA.</p>
        </div>
      </div>
    </div>
  );
}

export default SetPassword;
