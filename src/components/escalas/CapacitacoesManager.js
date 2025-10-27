// CapacitacoesManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { showToast } from '../Toast';
import {
  Award,
  Search,
  X,
  Edit2,
  User,
  CheckCircle
} from 'lucide-react';
import './CapacitacoesManager.css';

const CapacitacoesManager = () => {
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [selectedTipos, setSelectedTipos] = useState([]);

  // Carregar dados
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar trabalhadores ativos
      const { data: trabData, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (trabError) throw trabError;

      // Carregar tipos de atendimento ativos
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tiposError) throw tiposError;

      // Carregar capacitações
      const { data: capData, error: capError } = await supabase
        .from('capacitacoes')
        .select('*');

      if (capError) throw capError;

      setTrabalhadores(trabData || []);
      setTiposAtendimento(tiposData || []);
      setCapacitacoes(capData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Obter capacitações de um trabalhador
  const getCapacitacoesTrabalhador = (trabalhadorId) => {
    return capacitacoes
      .filter(c => c.trabalhador_id === trabalhadorId)
      .map(c => c.tipo_atendimento_id);
  };

  // Obter nome do tipo de atendimento
  const getTipoNome = (tipoId) => {
    const tipo = tiposAtendimento.find(t => t.id === tipoId);
    return tipo ? tipo.nome : 'Desconhecido';
  };

  // Abrir modal de edição
  const handleEditCapacitacoes = (trabalhador) => {
    setSelectedTrabalhador(trabalhador);
    setSelectedTipos(getCapacitacoesTrabalhador(trabalhador.id));
    setShowModal(true);
  };

  // Alternar seleção de tipo
  const toggleTipo = (tipoId) => {
    setSelectedTipos(prev =>
      prev.includes(tipoId)
        ? prev.filter(id => id !== tipoId)
        : [...prev, tipoId]
    );
  };

  // Salvar capacitações
  const handleSave = async () => {
    if (!selectedTrabalhador) return;

    try {
      const trabalhadorId = selectedTrabalhador.id;
      const capacitacoesAtuais = getCapacitacoesTrabalhador(trabalhadorId);

      // Tipos a adicionar
      const tiposAdicionar = selectedTipos.filter(t => !capacitacoesAtuais.includes(t));

      // Tipos a remover
      const tiposRemover = capacitacoesAtuais.filter(t => !selectedTipos.includes(t));

      // Adicionar novas capacitações
      if (tiposAdicionar.length > 0) {
        const novasCapacitacoes = tiposAdicionar.map(tipoId => ({
          trabalhador_id: trabalhadorId,
          tipo_atendimento_id: tipoId
        }));

        const { error: insertError } = await supabase
          .from('capacitacoes')
          .insert(novasCapacitacoes);

        if (insertError) throw insertError;
      }

      // Remover capacitações
      if (tiposRemover.length > 0) {
        const { error: deleteError } = await supabase
          .from('capacitacoes')
          .delete()
          .eq('trabalhador_id', trabalhadorId)
          .in('tipo_atendimento_id', tiposRemover);

        if (deleteError) throw deleteError;
      }

      showToast.success('Capacitações atualizadas com sucesso!');
      setShowModal(false);
      setSelectedTrabalhador(null);
      setSelectedTipos([]);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar capacitações:', error);
      showToast.error('Erro ao salvar capacitações');
    }
  };

  // Filtrar trabalhadores
  const trabalhadoresFiltrados = trabalhadores.filter(t =>
    t.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="capacitacoes-manager">
      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <Award size={32} />
          <div>
            <h2>Capacitações</h2>
            <p className="header-subtitle">
              Gerencie em quais tipos de atendimento cada trabalhador pode atuar
            </p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="search-container">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar trabalhador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Trabalhadores */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Carregando trabalhadores...</p>
        </div>
      ) : trabalhadoresFiltrados.length === 0 ? (
        <div className="empty-state">
          <User size={64} />
          <p>Nenhum trabalhador encontrado</p>
        </div>
      ) : (
        <div className="trabalhadores-list">
          {trabalhadoresFiltrados.map((trabalhador) => {
            const capacitacoesIds = getCapacitacoesTrabalhador(trabalhador.id);

            return (
              <div key={trabalhador.id} className="trabalhador-card">
                <div className="trabalhador-info">
                  <div className="trabalhador-avatar">
                    <User size={24} />
                  </div>
                  <div className="trabalhador-details">
                    <h3>{trabalhador.nome}</h3>
                    {trabalhador.funcao && (
                      <span className="trabalhador-funcao">{trabalhador.funcao}</span>
                    )}
                  </div>
                </div>

                <div className="capacitacoes-badges">
                  {capacitacoesIds.length === 0 ? (
                    <span className="no-capacitacoes">Nenhuma capacitação</span>
                  ) : (
                    capacitacoesIds.map(tipoId => (
                      <span key={tipoId} className="capacitacao-badge">
                        <CheckCircle size={14} />
                        {getTipoNome(tipoId)}
                      </span>
                    ))
                  )}
                </div>

                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleEditCapacitacoes(trabalhador)}
                >
                  <Edit2 size={16} />
                  Editar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Edição */}
      {showModal && selectedTrabalhador && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Editar Capacitações</h3>
                <p className="modal-subtitle">{selectedTrabalhador.nome}</p>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              {tiposAtendimento.length === 0 ? (
                <div className="info-box info-warning">
                  <p>
                    <strong>Atenção:</strong> Não há tipos de atendimento cadastrados.
                    Configure os tipos antes de gerenciar capacitações.
                  </p>
                </div>
              ) : (
                <>
                  <div className="info-box">
                    <p>
                      Selecione os tipos de atendimento em que <strong>{selectedTrabalhador.nome}</strong> pode atuar:
                    </p>
                  </div>

                  <div className="tipos-checkboxes">
                    {tiposAtendimento.map(tipo => (
                      <label key={tipo.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedTipos.includes(tipo.id)}
                          onChange={() => toggleTipo(tipo.id)}
                        />
                        <span>{tipo.nome}</span>
                        <span className="tipo-info">
                          ({tipo.qtd_pessoas_necessarias} {tipo.qtd_pessoas_necessarias === 1 ? 'pessoa' : 'pessoas'})
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={tiposAtendimento.length === 0}
              >
                <CheckCircle size={20} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapacitacoesManager;
