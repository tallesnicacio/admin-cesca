import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Edit2, Trash2, Plus, X, User, Phone, Mail, FileText } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import { ConfirmModal } from './Modal';
import './TrabalhadorManager.css';

function TrabalhadorManager() {
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [filteredTrabalhadores, setFilteredTrabalhadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGrupo, setFilterGrupo] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [formData, setFormData] = useState({
    numero: '',
    nome_completo: '',
    grupo: '',
    funcao_permanente: '',
    telefone: '',
    email: '',
    observacoes: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, trabalhadorId: null });
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadTrabalhadores();
  }, []);

  useEffect(() => {
    filterTrabalhadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, filterGrupo, trabalhadores]);

  const loadTrabalhadores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trabalhadores')
        .select('*')
        .order('numero', { ascending: true, nullsFirst: false })
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setTrabalhadores(data || []);
    } catch (error) {
      console.error('Erro ao carregar trabalhadores:', error);
      showToast.error('Erro ao carregar trabalhadores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterTrabalhadores = () => {
    let filtered = [...trabalhadores];

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.telefone?.includes(searchTerm) ||
        t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.numero?.toString().includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    if (filterGrupo !== 'all') {
      filtered = filtered.filter(t => t.grupo === filterGrupo);
    }

    setFilteredTrabalhadores(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ numero: '', nome_completo: '', grupo: '', funcao_permanente: '', telefone: '', email: '', observacoes: '' });
    setFormErrors({});
    setSelectedTrabalhador(null);
    setShowModal(true);
  };

  const openEditModal = (trabalhador) => {
    setModalMode('edit');
    setFormData({
      numero: trabalhador.numero || '',
      nome_completo: trabalhador.nome_completo || '',
      grupo: trabalhador.grupo || '',
      funcao_permanente: trabalhador.funcao_permanente || '',
      telefone: trabalhador.telefone || '',
      email: trabalhador.email || '',
      observacoes: trabalhador.observacoes || ''
    });
    setFormErrors({});
    setSelectedTrabalhador(trabalhador);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ numero: '', nome_completo: '', grupo: '', funcao_permanente: '', telefone: '', email: '', observacoes: '' });
    setFormErrors({});
    setSelectedTrabalhador(null);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.nome_completo?.trim()) {
      errors.nome_completo = 'Nome completo é obrigatório';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setModalLoading(true);

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('trabalhadores')
          .insert([{
            numero: formData.numero ? parseInt(formData.numero) : null,
            nome_completo: formData.nome_completo.trim(),
            grupo: formData.grupo || null,
            funcao_permanente: formData.funcao_permanente?.trim() || null,
            telefone: formData.telefone?.trim() || null,
            email: formData.email?.trim() || null,
            observacoes: formData.observacoes?.trim() || null,
            status: 'ativo'
          }]);

        if (error) throw error;
        showToast.success('Trabalhador cadastrado com sucesso!');
      } else {
        const { error } = await supabase
          .from('trabalhadores')
          .update({
            numero: formData.numero ? parseInt(formData.numero) : null,
            nome_completo: formData.nome_completo.trim(),
            grupo: formData.grupo || null,
            funcao_permanente: formData.funcao_permanente?.trim() || null,
            telefone: formData.telefone?.trim() || null,
            email: formData.email?.trim() || null,
            observacoes: formData.observacoes?.trim() || null
          })
          .eq('id', selectedTrabalhador.id);

        if (error) throw error;
        showToast.success('Trabalhador atualizado com sucesso!');
      }

      closeModal();
      loadTrabalhadores();
    } catch (error) {
      console.error('Erro ao salvar trabalhador:', error);
      showToast.error('Erro ao salvar trabalhador: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleChangeStatus = async (trabalhador, novoStatus) => {
    try {
      const { error } = await supabase
        .from('trabalhadores')
        .update({ status: novoStatus })
        .eq('id', trabalhador.id);

      if (error) throw error;

      const statusLabel = novoStatus === 'ativo' ? 'ativado' : novoStatus === 'inativo' ? 'inativado' : 'afastado';
      showToast.success(`Trabalhador ${statusLabel} com sucesso!`);
      loadTrabalhadores();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      showToast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const handleDelete = (trabalhadorId) => {
    setDeleteModal({ isOpen: true, trabalhadorId });
  };

  const handleDeleteConfirm = async () => {
    setModalLoading(true);
    const trabalhadorId = deleteModal.trabalhadorId;

    try {
      const { error } = await supabase
        .from('trabalhadores')
        .delete()
        .eq('id', trabalhadorId);

      if (error) throw error;
      showToast.success('Trabalhador excluído com sucesso!');
      loadTrabalhadores();
      setDeleteModal({ isOpen: false, trabalhadorId: null });
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showToast.error('Erro ao excluir: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  const totalAtivos = trabalhadores.filter(t => t.status === 'ativo').length;
  const totalInativos = trabalhadores.filter(t => t.status === 'inativo').length;
  const totalAfastados = trabalhadores.filter(t => t.status === 'afastado').length;

  return (
    <div className="trabalhador-manager">
      <Toaster position="top-right" />
      <div className="manager-header">
        <h2>Gerenciar Trabalhadores</h2>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={20} />
          Novo Trabalhador
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Todos os Status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="afastado">Afastados</option>
        </select>

        <select value={filterGrupo} onChange={(e) => setFilterGrupo(e.target.value)}>
          <option value="all">Todos os Grupos</option>
          <option value="Direção">Direção</option>
          <option value="Médiuns Correntes">Médiuns Correntes</option>
        </select>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{trabalhadores.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalAtivos}</span>
          <span className="stat-label">Ativos</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalAfastados}</span>
          <span className="stat-label">Afastados</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalInativos}</span>
          <span className="stat-label">Inativos</span>
        </div>
      </div>

      <div className="trabalhadores-table">
        {filteredTrabalhadores.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum trabalhador encontrado</p>
          </div>
        ) : (
          <>
            {/* Cards para mobile */}
            {filteredTrabalhadores.map((trab) => (
              <div key={`card-${trab.id}`} className="trabalhador-card">
                <div className="trabalhador-card-header">
                  <div className="trabalhador-card-title">
                    <h3>{trab.nome_completo}</h3>
                    <p>{trab.telefone || 'Sem telefone'}</p>
                  </div>
                  <span className={`status-badge ${trab.status}`}>
                    {trab.status === 'ativo' ? 'Ativo' : trab.status === 'afastado' ? 'Afastado' : 'Inativo'}
                  </span>
                </div>

                <div className="trabalhador-card-body">
                  {trab.numero && (
                    <div className="trabalhador-card-field">
                      <label>Nº</label>
                      <div className="value">{trab.numero}</div>
                    </div>
                  )}
                  {trab.grupo && (
                    <div className="trabalhador-card-field">
                      <label>Grupo</label>
                      <div className="value">{trab.grupo}</div>
                    </div>
                  )}
                  {trab.funcao_permanente && (
                    <div className="trabalhador-card-field">
                      <label>Função</label>
                      <div className="value">{trab.funcao_permanente}</div>
                    </div>
                  )}
                  {trab.email && (
                    <div className="trabalhador-card-field">
                      <label>Email</label>
                      <div className="value">{trab.email}</div>
                    </div>
                  )}
                  {trab.observacoes && (
                    <div className="trabalhador-card-field">
                      <label>Observações</label>
                      <div className="value">{trab.observacoes}</div>
                    </div>
                  )}
                </div>

                <div className="trabalhador-card-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => openEditModal(trab)}
                  >
                    <Edit2 size={18} />
                    Editar
                  </button>
                  <select
                    className="btn-secondary"
                    value={trab.status}
                    onChange={(e) => handleChangeStatus(trab, e.target.value)}
                    style={{ padding: '0.5rem', marginLeft: '0.5rem' }}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="afastado">Afastado</option>
                    <option value="inativo">Inativo</option>
                  </select>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(trab.id)}
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {/* Tabela para desktop */}
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Nome</th>
                  <th>Grupo</th>
                  <th>Função</th>
                  <th>Telefone</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrabalhadores.map((trab) => (
                  <tr key={trab.id}>
                    <td>{trab.numero || '-'}</td>
                    <td>
                      <strong>{trab.nome_completo}</strong>
                      {trab.observacoes && <small title={trab.observacoes}> ℹ️</small>}
                    </td>
                    <td>{trab.grupo || '-'}</td>
                    <td>{trab.funcao_permanente || '-'}</td>
                    <td>{trab.telefone || '-'}</td>
                    <td>
                      <select
                        className={`status-badge ${trab.status}`}
                        value={trab.status}
                        onChange={(e) => handleChangeStatus(trab, e.target.value)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        <option value="ativo">Ativo</option>
                        <option value="afastado">Afastado</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => openEditModal(trab)}
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => handleDelete(trab.id)}
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {modalMode === 'create' ? (
                  <>
                    <Plus size={20} /> Novo Trabalhador
                  </>
                ) : (
                  <>
                    <Edit2 size={20} /> Editar Trabalhador
                  </>
                )}
              </h3>
              <button className="btn-icon" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form className="trabalhador-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  <User size={16} /> Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  placeholder="Nome completo do trabalhador"
                />
                {formErrors.nome_completo && <span className="error-text">{formErrors.nome_completo}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Número</label>
                  <input
                    type="number"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    placeholder="Nº"
                  />
                </div>

                <div className="form-group">
                  <label>Grupo</label>
                  <select
                    value={formData.grupo}
                    onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    <option value="Direção">Direção</option>
                    <option value="Médiuns Correntes">Médiuns Correntes</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Função Permanente</label>
                <input
                  type="text"
                  value={formData.funcao_permanente}
                  onChange={(e) => setFormData({ ...formData, funcao_permanente: e.target.value })}
                  placeholder="Ex: Curimba, Cambono, MT1..."
                />
              </div>

              <div className="form-group">
                <label>
                  <Phone size={16} /> Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="form-group">
                <label>
                  <Mail size={16} /> Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
                {formErrors.email && <span className="error-text">{formErrors.email}</span>}
              </div>

              <div className="form-group">
                <label>
                  <FileText size={16} /> Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o trabalhador..."
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={modalLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Salvando...' : modalMode === 'create' ? 'Cadastrar' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, trabalhadorId: null })}
        onConfirm={handleDeleteConfirm}
        title="Excluir trabalhador"
        message="Tem certeza que deseja excluir este trabalhador? Esta ação não pode ser desfeita e removerá todos os registros de presença associados."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        type="danger"
        loading={modalLoading}
      />
    </div>
  );
}

export default TrabalhadorManager;
