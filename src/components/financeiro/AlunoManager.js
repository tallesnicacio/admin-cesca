import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Plus, Edit2, Trash2, X, User } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from '../index';
import { ConfirmModal } from '../Modal';
import { Input, PhoneInput } from '../Input';
import { Button } from '../Button';
import './AlunoManager.css';

function AlunoManager({ userProfile }) {
  // Estados principais
  const [alunos, setAlunos] = useState([]);
  const [filteredAlunos, setFilteredAlunos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create | edit
  const [formData, setFormData] = useState({
    nome_completo: '',
    cpf: '',
    telefone: '',
    email: '',
    data_nascimento: '',
    endereco: '',
    status: 'ativo',
    observacoes: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Estado do modal de confirmação de exclusão
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, nome: '' });

  // Carregar alunos ao montar componente
  useEffect(() => {
    loadAlunos();
  }, []);

  // Filtrar alunos quando searchTerm, filterStatus ou alunos mudarem
  useEffect(() => {
    filterAlunos();
  }, [searchTerm, filterStatus, alunos]);

  // Função para carregar alunos do banco
  const loadAlunos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setAlunos(data || []);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      showToast.error('Erro ao carregar alunos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para filtrar alunos
  const filterAlunos = () => {
    let filtered = [...alunos];

    // Filtro de busca (nome, CPF, telefone, email)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(aluno =>
        aluno.nome_completo?.toLowerCase().includes(term) ||
        aluno.cpf?.toLowerCase().includes(term) ||
        aluno.telefone?.includes(term) ||
        aluno.email?.toLowerCase().includes(term)
      );
    }

    // Filtro de status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(aluno => aluno.status === filterStatus);
    }

    setFilteredAlunos(filtered);
  };

  // Validação do formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome_completo?.trim()) {
      errors.nome_completo = 'Nome completo é obrigatório';
    }

    if (formData.cpf) {
      // Validação básica de CPF (apenas formato)
      const cpfNumeros = formData.cpf.replace(/\D/g, '');
      if (cpfNumeros.length !== 11) {
        errors.cpf = 'CPF deve ter 11 dígitos';
      }
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Email inválido';
    }

    if (formData.telefone) {
      const telefoneNumeros = formData.telefone.replace(/\D/g, '');
      if (telefoneNumeros.length < 10) {
        errors.telefone = 'Telefone deve ter pelo menos 10 dígitos';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Abrir modal para criar novo aluno
  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      nome_completo: '',
      cpf: '',
      telefone: '',
      email: '',
      data_nascimento: '',
      endereco: '',
      status: 'ativo',
      observacoes: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Abrir modal para editar aluno
  const openEditModal = (aluno) => {
    setModalMode('edit');
    setFormData({
      id: aluno.id,
      nome_completo: aluno.nome_completo || '',
      cpf: aluno.cpf || '',
      telefone: aluno.telefone || '',
      email: aluno.email || '',
      data_nascimento: aluno.data_nascimento || '',
      endereco: aluno.endereco || '',
      status: aluno.status || 'ativo',
      observacoes: aluno.observacoes || ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setFormData({
      nome_completo: '',
      cpf: '',
      telefone: '',
      email: '',
      data_nascimento: '',
      endereco: '',
      status: 'ativo',
      observacoes: ''
    });
    setFormErrors({});
  };

  // Submeter formulário (criar ou editar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast.error('Por favor, corrija os erros no formulário');
      return;
    }

    try {
      const dataToSave = {
        nome_completo: formData.nome_completo.trim(),
        cpf: formData.cpf?.trim() || null,
        telefone: formData.telefone?.trim() || null,
        email: formData.email?.trim() || null,
        data_nascimento: formData.data_nascimento || null,
        endereco: formData.endereco?.trim() || null,
        status: formData.status,
        observacoes: formData.observacoes?.trim() || null
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('alunos')
          .insert([dataToSave]);

        if (error) throw error;
        showToast.success('Aluno cadastrado com sucesso!');
      } else {
        const { error } = await supabase
          .from('alunos')
          .update(dataToSave)
          .eq('id', formData.id);

        if (error) throw error;
        showToast.success('Aluno atualizado com sucesso!');
      }

      closeModal();
      loadAlunos();
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      if (error.code === '23505') {
        showToast.error('CPF já cadastrado no sistema');
      } else {
        showToast.error('Erro ao salvar aluno: ' + error.message);
      }
    }
  };

  // Abrir modal de confirmação de exclusão
  const handleDeleteClick = (aluno) => {
    setDeleteModal({
      isOpen: true,
      id: aluno.id,
      nome: aluno.nome_completo
    });
  };

  // Confirmar exclusão
  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('alunos')
        .delete()
        .eq('id', deleteModal.id);

      if (error) throw error;

      showToast.success('Aluno excluído com sucesso!');
      setDeleteModal({ isOpen: false, id: null, nome: '' });
      loadAlunos();
    } catch (error) {
      console.error('Erro ao excluir aluno:', error);
      if (error.code === '23503') {
        showToast.error('Não é possível excluir este aluno pois existem matrículas vinculadas');
      } else {
        showToast.error('Erro ao excluir aluno: ' + error.message);
      }
    }
  };

  // Formatar CPF para exibição
  const formatCPF = (cpf) => {
    if (!cpf) return '-';
    const numeros = cpf.replace(/\D/g, '');
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Formatar telefone para exibição
  const formatTelefone = (tel) => {
    if (!tel) return '-';
    const numeros = tel.replace(/\D/g, '');
    if (numeros.length === 11) {
      return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  };

  // Formatar data para exibição
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando alunos...</p>
      </div>
    );
  }

  return (
    <div className="aluno-manager">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <User size={28} />
          <div>
            <h2>Gerenciar Alunos</h2>
            <p className="header-subtitle">Cadastro de alunos dos cursos</p>
          </div>
        </div>
        <Button onClick={openCreateModal} icon={<Plus size={20} />}>
          Novo Aluno
        </Button>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <select
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="trancado">Trancado</option>
        </select>
      </div>

      {/* Estatísticas */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{alunos.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {alunos.filter(a => a.status === 'ativo').length}
          </span>
          <span className="stat-label">Ativos</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {alunos.filter(a => a.status === 'inativo').length}
          </span>
          <span className="stat-label">Inativos</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {alunos.filter(a => a.status === 'trancado').length}
          </span>
          <span className="stat-label">Trancados</span>
        </div>
      </div>

      {/* Tabela de Alunos */}
      <div className="table-container">
        {filteredAlunos.length === 0 ? (
          <div className="empty-state">
            <User size={64} color="#ccc" />
            <p>Nenhum aluno encontrado</p>
            {searchTerm && (
              <button className="btn-link" onClick={() => setSearchTerm('')}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome Completo</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Nascimento</th>
                <th>Status</th>
                <th className="actions-column">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlunos.map((aluno) => (
                <tr key={aluno.id}>
                  <td>
                    <strong>{aluno.nome_completo}</strong>
                    {aluno.observacoes && (
                      <small className="observacao-hint" title={aluno.observacoes}>
                        📋 {aluno.observacoes.substring(0, 30)}
                        {aluno.observacoes.length > 30 ? '...' : ''}
                      </small>
                    )}
                  </td>
                  <td>{formatCPF(aluno.cpf)}</td>
                  <td>{formatTelefone(aluno.telefone)}</td>
                  <td>{aluno.email || '-'}</td>
                  <td>{formatDate(aluno.data_nascimento)}</td>
                  <td>
                    <span className={`status-badge status-${aluno.status}`}>
                      {aluno.status}
                    </span>
                  </td>
                  <td className="actions-column">
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => openEditModal(aluno)}
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => handleDeleteClick(aluno)}
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
        )}
      </div>

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? 'Novo Aluno' : 'Editar Aluno'}</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <Input
                    label="Nome Completo"
                    value={formData.nome_completo}
                    onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                    error={formErrors.nome_completo}
                    required
                    placeholder="Nome completo do aluno"
                  />
                </div>

                <div className="form-row">
                  <Input
                    label="CPF"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    error={formErrors.cpf}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  <Input
                    label="Data de Nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <PhoneInput
                    label="Telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    error={formErrors.telefone}
                    placeholder="(00) 00000-0000"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={formErrors.email}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="form-row">
                  <Input
                    label="Endereço"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                      <option value="trancado">Trancado</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Observações</label>
                    <textarea
                      className="form-textarea"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={3}
                      placeholder="Informações adicionais sobre o aluno"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {modalMode === 'create' ? 'Cadastrar' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, nome: '' })}
        onConfirm={handleDeleteConfirm}
        title="Excluir Aluno"
        message={`Tem certeza que deseja excluir o aluno "${deleteModal.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
}

export default AlunoManager;
