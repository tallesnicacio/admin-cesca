import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Power, Calendar, Clock } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import './AgendamentoManager.css';

function Configuracoes() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('configuracoes')
        .update({
          agendamentos_ativos: !config.agendamentos_ativos,
          ultima_alteracao: new Date().toISOString(),
          alterado_por: 'Admin'
        })
        .eq('id', config.id);

      if (error) throw error;
      showToast.success(`Agendamentos ${!config.agendamentos_ativos ? 'ATIVADOS' : 'DESATIVADOS'} com sucesso!`);
      loadConfig();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      showToast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRestriction = async (field) => {
    if (!config) return;

    try {
      setSaving(true);
      const newValue = !config[field];
      const { error } = await supabase
        .from('configuracoes')
        .update({
          [field]: newValue,
          ultima_alteracao: new Date().toISOString(),
          alterado_por: 'Admin'
        })
        .eq('id', config.id);

      if (error) throw error;

      const messages = {
        ignorar_restricao_dias: newValue
          ? 'Agendamentos liberados para TODOS os dias da semana!'
          : 'Agendamentos restritos apenas para Quartas e Sábados',
        ignorar_restricao_horario: newValue
          ? 'Agendamentos liberados para QUALQUER horário!'
          : 'Agendamentos restritos apenas após 7h'
      };

      showToast.success(messages[field]);
      loadConfig();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      showToast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div className="quiz-manager">
      <Toaster position="top-right" />
      <div className="manager-header">
        <h2>Configurações do Sistema</h2>
      </div>

      <div className="quiz-card">
        <div className="quiz-header">
          <h3>Status dos Agendamentos</h3>
          <span className={`status-badge ${config?.agendamentos_ativos ? 'active' : 'inactive'}`}>
            {config?.agendamentos_ativos ? 'ATIVOS' : 'DESATIVADOS'}
          </span>
        </div>

        <p className="quiz-description">
          {config?.agendamentos_ativos
            ? 'Os usuários podem fazer novos agendamentos no sistema quiz-cesca.'
            : 'Os agendamentos estão temporariamente suspensos. Os usuários verão uma mensagem informando sobre a suspensão.'}
        </p>

        {config?.ultima_alteracao && (
          <div className="quiz-stats">
            <span>Última alteração: {new Date(config.ultima_alteracao).toLocaleString('pt-BR')}</span>
            {config.alterado_por && <span> por {config.alterado_por}</span>}
          </div>
        )}

        <button
          onClick={handleToggle}
          disabled={saving}
          className={`btn-primary ${config?.agendamentos_ativos ? 'danger' : 'success'}`}
          style={{
            backgroundColor: config?.agendamentos_ativos ? '#dc2626' : '#16a34a',
            marginTop: '1rem'
          }}
        >
          <Power size={18} />
          {saving
            ? 'Atualizando...'
            : config?.agendamentos_ativos
            ? 'Desativar Agendamentos'
            : 'Ativar Agendamentos'}
        </button>

        <div className="bg-yellow-50" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fbbf24' }}>
          <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
            <strong>⚠️ Atenção:</strong> Esta configuração afeta diretamente o formulário de agendamentos no quiz-cesca.
          </p>
        </div>
      </div>

      <div className="quiz-card" style={{ marginTop: '24px' }}>
        <div className="quiz-header">
          <h3>Restrição de Dias da Semana</h3>
          <span className={`status-badge ${config?.ignorar_restricao_dias ? 'active' : 'inactive'}`}>
            {config?.ignorar_restricao_dias ? 'LIBERADO' : 'RESTRITO'}
          </span>
        </div>

        <p className="quiz-description">
          {config?.ignorar_restricao_dias
            ? 'Agendamentos permitidos em TODOS os dias da semana.'
            : 'Agendamentos permitidos apenas às Quartas-feiras e Sábados (padrão).'}
        </p>

        <button
          onClick={() => handleToggleRestriction('ignorar_restricao_dias')}
          disabled={saving}
          className="btn-primary"
          style={{
            backgroundColor: config?.ignorar_restricao_dias ? '#dc2626' : '#16a34a',
            marginTop: '1rem'
          }}
        >
          <Calendar size={18} />
          {saving
            ? 'Atualizando...'
            : config?.ignorar_restricao_dias
            ? 'Restringir para Qua/Sáb'
            : 'Liberar Todos os Dias'}
        </button>
      </div>

      <div className="quiz-card" style={{ marginTop: '24px' }}>
        <div className="quiz-header">
          <h3>Restrição de Horário</h3>
          <span className={`status-badge ${config?.ignorar_restricao_horario ? 'active' : 'inactive'}`}>
            {config?.ignorar_restricao_horario ? 'LIBERADO' : 'RESTRITO'}
          </span>
        </div>

        <p className="quiz-description">
          {config?.ignorar_restricao_horario
            ? 'Agendamentos permitidos em QUALQUER horário do dia.'
            : 'Agendamentos permitidos apenas após 7h da manhã (padrão).'}
        </p>

        <button
          onClick={() => handleToggleRestriction('ignorar_restricao_horario')}
          disabled={saving}
          className="btn-primary"
          style={{
            backgroundColor: config?.ignorar_restricao_horario ? '#dc2626' : '#16a34a',
            marginTop: '1rem'
          }}
        >
          <Clock size={18} />
          {saving
            ? 'Atualizando...'
            : config?.ignorar_restricao_horario
            ? 'Restringir após 7h'
            : 'Liberar Qualquer Horário'}
        </button>
      </div>
    </div>
  );
}

export default Configuracoes;
