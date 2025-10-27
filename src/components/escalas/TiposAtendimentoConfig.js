// TiposAtendimentoConfig.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { showToast } from '../Toast';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Save,
  X
} from 'lucide-react';
import './TiposAtendimentoConfig.css';

const TiposAtendimentoConfig = () => {
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    qtd_pessoas_necessarias: 1,
    dias_funcionamento: [],
    ativo: true
  });

  const diasSemana = [
    { value: 'segunda', label: 'Segunda-feira' },
    { value: 'terca', label: 'Terça-feira' },
    { value: 'quarta', label: 'Quarta-feira' },
    { value: 'quinta', label: 'Quinta-feira' },
    { value: 'sexta', label: 'Sexta-feira' },
    { value: 'sabado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' }
  ];

  // Carregar tipos de atendimento
  const fetchTipos = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .order('nome');

      if (error) throw error;

      setTipos(data || []);
    } catch (error) {
      console.error('Erro ao carregar tipos de atendimento:', error);
      showToast.error('Erro ao carregar tipos de atendimento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTipos();
  }, [fetchTipos]);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome?.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (!formData.qtd_pessoas_necessarias || formData.qtd_pessoas_necessarias < 1) {
      errors.qtd_pessoas_necessarias = 'Quantidade deve ser no mínimo 1';
    }

    if (formData.dias_funcionamento.length === 0) {
      errors.dias_funcionamento = 'Selecione pelo menos um dia';
    }

    return errors;
  };

  // Criar/Editar tipo
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => showToast.error(error));
      return;
    }

    try {
      const dataToSave = {
        nome: formData.nome.trim(),
        qtd_pessoas_necessarias: parseInt(formData.qtd_pessoas_necessarias),
        dias_funcionamento: formData.dias_funcionamento,
        ativo: formData.ativo
      };

      if (editingTipo) {
        const { error } = await supabase
          .from('tipos_atendimento')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', editingTipo.id);

        if (error) throw error;
        showToast.success('Tipo de atendimento atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('tipos_atendimento')
          .insert(dataToSave);

        if (error) throw error;
        showToast.success('Tipo de atendimento cadastrado com sucesso!');
      }

      setShowModal(false);
      setEditingTipo(null);
      setFormData({
        nome: '',
        qtd_pessoas_necessarias: 1,
        dias_funcionamento: [],
        ativo: true
      });
      fetchTipos();
    } catch (error) {
      console.error('Erro ao salvar tipo de atendimento:', error);
      if (error.code === '23505') {
        showToast.error('Já existe um tipo de atendimento com este nome');
      } else {
        showToast.error('Erro ao salvar tipo de atendimento');
      }
    }
  };

  // Deletar tipo
  const handleDelete = async (tipo) => {
    if (!window.confirm(`Deseja realmente excluir o tipo "${tipo.nome}"?\n\nAtenção: Isso pode afetar escalas existentes.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tipos_atendimento')
        .delete()
        .eq('id', tipo.id);

      if (error) throw error;

      showToast.success('Tipo de atendimento excluído com sucesso!');
      fetchTipos();
    } catch (error) {
      console.error('Erro ao excluir tipo de atendimento:', error);
      if (error.code === '23503') {
        showToast.error('Não é possível excluir: existem capacitações ou escalas vinculadas a este tipo');
      } else {
        showToast.error('Erro ao excluir tipo de atendimento');
      }
    }
  };

  // Alternar status ativo/inativo
  const toggleAtivo = async (tipo) => {
    try {
      const { error } = await supabase
        .from('tipos_atendimento')
        .update({
          ativo: !tipo.ativo,
          updated_at: new Date().toISOString()
        })
        .eq('id', tipo.id);

      if (error) throw error;

      showToast.success(`Tipo ${!tipo.ativo ? 'ativado' : 'desativado'} com sucesso!`);
      fetchTipos();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      showToast.error('Erro ao alterar status');
    }
  };

  // Abrir modal de edição
  const handleEdit = (tipo) => {
    setEditingTipo(tipo);
    setFormData({
      nome: tipo.nome,
      qtd_pessoas_necessarias: tipo.qtd_pessoas_necessarias,
      dias_funcionamento: tipo.dias_funcionamento || [],
      ativo: tipo.ativo
    });
    setShowModal(true);
  };

  // Alternar dia de funcionamento
  const toggleDia = (dia) => {
    setFormData(prev => ({
      ...prev,
      dias_funcionamento: prev.dias_funcionamento.includes(dia)
        ? prev.dias_funcionamento.filter(d => d !== dia)
        : [...prev.dias_funcionamento, dia]
    }));
  };

  // Formatar dias de funcionamento para exibição
  const formatDias = (dias) => {
    if (!dias || dias.length === 0) return 'Nenhum dia configurado';

    const diasFormatados = dias.map(d => {
      const dia = diasSemana.find(ds => ds.value === d);
      return dia ? dia.label.substring(0, 3) : d;
    });

    return diasFormatados.join(', ');
  };

  return (
    <div className="tipos-atendimento-config">
      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <Settings size={32} />
          <div>
            <h2>Tipos de Atendimento</h2>
            <p className="header-subtitle">
              Configure os tipos de atendimento e suas características
            </p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingTipo(null);
            setFormData({
              nome: '',
              qtd_pessoas_necessarias: 1,
              dias_funcionamento: [],
              ativo: true
            });
            setShowModal(true);
          }}
        >
          <Plus size={20} />
          Novo Tipo
        </button>
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Carregando tipos de atendimento...</p>
        </div>
      ) : tipos.length === 0 ? (
        <div className="empty-state">
          <Settings size={64} />
          <p>Nenhum tipo de atendimento cadastrado</p>
          <button className="btn-link" onClick={() => setShowModal(true)}>
            Cadastrar primeiro tipo
          </button>
        </div>
      ) : (
        <div className="tipos-grid">
          {tipos.map((tipo) => (
            <div
              key={tipo.id}
              className={`tipo-card ${!tipo.ativo ? 'tipo-inativo' : ''}`}
            >
              <div className="tipo-card-header">
                <div className="tipo-title">
                  <h3>{tipo.nome}</h3>
                  <span className={`status-badge ${tipo.ativo ? 'status-ativo' : 'status-inativo'}`}>
                    {tipo.ativo ? (
                      <>
                        <CheckCircle size={14} /> Ativo
                      </>
                    ) : (
                      <>
                        <XCircle size={14} /> Inativo
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="tipo-card-body">
                <div className="tipo-info">
                  <div className="info-item">
                    <Users size={18} className="info-icon" />
                    <div>
                      <span className="info-label">Pessoas Necessárias</span>
                      <span className="info-value">{tipo.qtd_pessoas_necessarias}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Calendar size={18} className="info-icon" />
                    <div>
                      <span className="info-label">Dias de Funcionamento</span>
                      <span className="info-value-small">
                        {formatDias(tipo.dias_funcionamento)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tipo-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => toggleAtivo(tipo)}
                  >
                    {tipo.ativo ? (
                      <>
                        <XCircle size={16} /> Desativar
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} /> Ativar
                      </>
                    )}
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleEdit(tipo)}
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(tipo)}
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTipo ? 'Editar Tipo de Atendimento' : 'Novo Tipo de Atendimento'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nome do Tipo *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Baralho, Passe, Corrente..."
                    required
                  />
                  <span className="form-hint">
                    Nome único para identificar este tipo de atendimento
                  </span>
                </div>

                <div className="form-group">
                  <label>Quantidade de Pessoas Necessárias *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="50"
                    value={formData.qtd_pessoas_necessarias}
                    onChange={(e) => setFormData({ ...formData, qtd_pessoas_necessarias: e.target.value })}
                    required
                  />
                  <span className="form-hint">
                    Quantas pessoas são necessárias para este atendimento
                  </span>
                </div>

                <div className="form-group">
                  <label>Dias de Funcionamento *</label>
                  <div className="dias-checkboxes">
                    {diasSemana.map(dia => (
                      <label key={dia.value} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.dias_funcionamento.includes(dia.value)}
                          onChange={() => toggleDia(dia.value)}
                        />
                        <span>{dia.label}</span>
                      </label>
                    ))}
                  </div>
                  <span className="form-hint">
                    Selecione os dias em que este atendimento acontece
                  </span>
                </div>

                <div className="form-group">
                  <label className="checkbox-item checkbox-switch">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    />
                    <span>Tipo ativo</span>
                  </label>
                  <span className="form-hint">
                    Tipos inativos não aparecerão na geração de escalas
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={20} />
                  {editingTipo ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiposAtendimentoConfig;
