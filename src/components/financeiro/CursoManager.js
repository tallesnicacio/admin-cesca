import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Plus, Edit2, Trash2, X, BookOpen } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from '../index';
import { ConfirmModal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import './CursoManager.css';

function CursoManager({ userProfile }) {
  // Estados principais
  const [cursos, setCursos] = useState([]);
  const [filteredCursos, setFilteredCursos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterAtivo, setFilterAtivo] = useState('all');

  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create | edit
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'regular',
    valor_mensalidade: '',
    dia_vencimento: '10',
    duracao_meses: '',
    ativo: true
  });
  const [formErrors, setFormErrors] = useState({});

  // Estado do modal de confirmação de exclusão
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, nome: '' });

  // Carregar cursos ao montar componente
  useEffect(() => {
    loadCursos();
  }, []);

  // Filtrar cursos quando searchTerm, filters ou cursos mudarem
  useEffect(() => {
    filterCursos();
  }, [searchTerm, filterTipo, filterAtivo, cursos]);

  // Função para carregar cursos do banco
  const loadCursos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cursos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setCursos(data || []);
    } catch (error) {
      console.error('Erro ao carregar cursos:', error);
      showToast.error('Erro ao carregar cursos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para filtrar cursos
  const filterCursos = () => {
    let filtered = [...cursos];

    // Filtro de busca (nome, descrição)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(curso =>
        curso.nome?.toLowerCase().includes(term) ||
        curso.descricao?.toLowerCase().includes(term)
      );
    }

    // Filtro de tipo
    if (filterTipo !== 'all') {
      filtered = filtered.filter(curso => curso.tipo === filterTipo);
    }

    // Filtro de ativo
    if (filterAtivo !== 'all') {
      const isAtivo = filterAtivo === 'true';
      filtered = filtered.filter(curso => curso.ativo === isAtivo);
    }

    setFilteredCursos(filtered);
  };

  // Validação do formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome?.trim()) {
      errors.nome = 'Nome do curso é obrigatório';
    }

    if (!formData.valor_mensalidade || parseFloat(formData.valor_mensalidade) <= 0) {
      errors.valor_mensalidade = 'Valor da mensalidade deve ser maior que zero';
    }

    const diaVenc = parseInt(formData.dia_vencimento);
    if (!diaVenc || diaVenc < 1 || diaVenc > 31) {
      errors.dia_vencimento = 'Dia de vencimento deve estar entre 1 e 31';
    }

    // Validação específica para cursos avulsos
    if (formData.tipo === 'avulso') {
      const duracao = parseInt(formData.duracao_meses);
      if (!duracao || duracao < 1) {
        errors.duracao_meses = 'Duração deve ser de pelo menos 1 mês para cursos avulsos';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Abrir modal para criar novo curso
  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      nome: '',
      descricao: '',
      tipo: 'regular',
      valor_mensalidade: '',
      dia_vencimento: '10',
      duracao_meses: '',
      ativo: true
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Abrir modal para editar curso
  const openEditModal = (curso) => {
    setModalMode('edit');
    setFormData({
      id: curso.id,
      nome: curso.nome || '',
      descricao: curso.descricao || '',
      tipo: curso.tipo || 'regular',
      valor_mensalidade: curso.valor_mensalidade?.toString() || '',
      dia_vencimento: curso.dia_vencimento?.toString() || '10',
      duracao_meses: curso.duracao_meses?.toString() || '',
      ativo: curso.ativo !== false
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setFormData({
      nome: '',
      descricao: '',
      tipo: 'regular',
      valor_mensalidade: '',
      dia_vencimento: '10',
      duracao_meses: '',
      ativo: true
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
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || null,
        tipo: formData.tipo,
        valor_mensalidade: parseFloat(formData.valor_mensalidade),
        dia_vencimento: parseInt(formData.dia_vencimento),
        duracao_meses: formData.tipo === 'avulso' ? parseInt(formData.duracao_meses) : null,
        ativo: formData.ativo
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('cursos')
          .insert([dataToSave]);

        if (error) throw error;
        showToast.success('Curso cadastrado com sucesso!');
      } else {
        const { error } = await supabase
          .from('cursos')
          .update(dataToSave)
          .eq('id', formData.id);

        if (error) throw error;
        showToast.success('Curso atualizado com sucesso!');
      }

      closeModal();
      loadCursos();
    } catch (error) {
      console.error('Erro ao salvar curso:', error);
      if (error.code === '23505') {
        showToast.error('Já existe um curso com este nome');
      } else if (error.code === '23514') {
        showToast.error('Erro de validação: verifique os campos');
      } else {
        showToast.error('Erro ao salvar curso: ' + error.message);
      }
    }
  };

  // Abrir modal de confirmação de exclusão
  const handleDeleteClick = (curso) => {
    setDeleteModal({
      isOpen: true,
      id: curso.id,
      nome: curso.nome
    });
  };

  // Confirmar exclusão
  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('cursos')
        .delete()
        .eq('id', deleteModal.id);

      if (error) throw error;

      showToast.success('Curso excluído com sucesso!');
      setDeleteModal({ isOpen: false, id: null, nome: '' });
      loadCursos();
    } catch (error) {
      console.error('Erro ao excluir curso:', error);
      if (error.code === '23503') {
        showToast.error('Não é possível excluir este curso pois existem matrículas vinculadas');
      } else {
        showToast.error('Erro ao excluir curso: ' + error.message);
      }
    }
  };

  // Formatar valor monetário
  const formatMoeda = (valor) => {
    if (!valor && valor !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando cursos...</p>
      </div>
    );
  }

  return (
    <div className="curso-manager">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <BookOpen size={28} />
          <div>
            <h2>Gerenciar Cursos</h2>
            <p className="header-subtitle">Cursos regulares e avulsos disponíveis</p>
          </div>
        </div>
        <Button onClick={openCreateModal} icon={<Plus size={20} />}>
          Novo Curso
        </Button>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
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
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
        >
          <option value="all">Todos os tipos</option>
          <option value="regular">Regular</option>
          <option value="avulso">Avulso</option>
        </select>

        <select
          className="filter-select"
          value={filterAtivo}
          onChange={(e) => setFilterAtivo(e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      {/* Estatísticas */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{cursos.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {cursos.filter(c => c.tipo === 'regular').length}
          </span>
          <span className="stat-label">Regulares</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {cursos.filter(c => c.tipo === 'avulso').length}
          </span>
          <span className="stat-label">Avulsos</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {cursos.filter(c => c.ativo).length}
          </span>
          <span className="stat-label">Ativos</span>
        </div>
      </div>

      {/* Cards de Cursos */}
      <div className="cursos-grid">
        {filteredCursos.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={64} color="#ccc" />
            <p>Nenhum curso encontrado</p>
            {searchTerm && (
              <button className="btn-link" onClick={() => setSearchTerm('')}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          filteredCursos.map((curso) => (
            <div key={curso.id} className={`curso-card ${!curso.ativo ? 'inativo' : ''}`}>
              <div className="curso-card-header">
                <div className="curso-card-title">
                  <h3>{curso.nome}</h3>
                  <div className="curso-badges">
                    <span className={`badge badge-${curso.tipo}`}>
                      {curso.tipo === 'regular' ? 'Regular' : 'Avulso'}
                    </span>
                    {!curso.ativo && (
                      <span className="badge badge-inactive">Inativo</span>
                    )}
                  </div>
                </div>
                <div className="curso-card-actions">
                  <button
                    className="btn-icon"
                    onClick={() => openEditModal(curso)}
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDeleteClick(curso)}
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="curso-card-body">
                {curso.descricao && (
                  <p className="curso-descricao">{curso.descricao}</p>
                )}

                <div className="curso-info-grid">
                  <div className="info-item">
                    <span className="info-label">Mensalidade</span>
                    <span className="info-value destaque">{formatMoeda(curso.valor_mensalidade)}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Vencimento</span>
                    <span className="info-value">Dia {curso.dia_vencimento}</span>
                  </div>

                  {curso.tipo === 'avulso' && (
                    <div className="info-item">
                      <span className="info-label">Duração</span>
                      <span className="info-value">
                        {curso.duracao_meses} {curso.duracao_meses === 1 ? 'mês' : 'meses'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? 'Novo Curso' : 'Editar Curso'}</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <Input
                    label="Nome do Curso"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    error={formErrors.nome}
                    required
                    placeholder="Ex: Curso de Umbanda Básico"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Descrição</label>
                    <textarea
                      className="form-textarea"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      rows={3}
                      placeholder="Descrição do curso (opcional)"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Curso *</label>
                    <select
                      className="form-select"
                      value={formData.tipo}
                      onChange={(e) => setFormData({
                        ...formData,
                        tipo: e.target.value,
                        duracao_meses: e.target.value === 'regular' ? '' : formData.duracao_meses
                      })}
                    >
                      <option value="regular">Regular (Recorrente)</option>
                      <option value="avulso">Avulso (Duração Fixa)</option>
                    </select>
                    <small className="form-hint">
                      {formData.tipo === 'regular'
                        ? 'Gera mensalidades automaticamente todos os meses'
                        : 'Duração fixa, não gera mensalidades após o período'
                      }
                    </small>
                  </div>

                  {formData.tipo === 'avulso' && (
                    <Input
                      label="Duração (meses)"
                      type="number"
                      min="1"
                      value={formData.duracao_meses}
                      onChange={(e) => setFormData({ ...formData, duracao_meses: e.target.value })}
                      error={formErrors.duracao_meses}
                      required
                      placeholder="Ex: 3"
                    />
                  )}
                </div>

                <div className="form-row">
                  <Input
                    label="Valor da Mensalidade"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor_mensalidade}
                    onChange={(e) => setFormData({ ...formData, valor_mensalidade: e.target.value })}
                    error={formErrors.valor_mensalidade}
                    required
                    placeholder="Ex: 80.00"
                  />

                  <Input
                    label="Dia de Vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: e.target.value })}
                    error={formErrors.dia_vencimento}
                    required
                    placeholder="1 a 31"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.ativo}
                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      />
                      <span>Curso ativo (aceita novas matrículas)</span>
                    </label>
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
        title="Excluir Curso"
        message={`Tem certeza que deseja excluir o curso "${deleteModal.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
}

export default CursoManager;
