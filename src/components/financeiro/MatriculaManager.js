import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Plus, Edit2, Trash2, X, GraduationCap, Calendar } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from '../index';
import { ConfirmModal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import './MatriculaManager.css';

function MatriculaManager({ userProfile }) {
  // Estados principais
  const [matriculas, setMatriculas] = useState([]);
  const [filteredMatriculas, setFilteredMatriculas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCurso, setFilterCurso] = useState('all');

  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create | edit
  const [formData, setFormData] = useState({
    aluno_id: '',
    curso_id: '',
    data_matricula: new Date().toISOString().split('T')[0],
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    dia_vencimento_personalizado: '',
    status: 'ativa',
    observacoes: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Estado do modal de confirmação de exclusão
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, info: '' });

  // Carregar dados ao montar componente
  useEffect(() => {
    loadData();
  }, []);

  // Filtrar matrículas quando filtros mudarem
  useEffect(() => {
    filterMatriculas();
  }, [searchTerm, filterStatus, filterCurso, matriculas]);

  // Atualizar data_fim quando curso mudar (para cursos avulsos)
  useEffect(() => {
    if (formData.curso_id && formData.data_inicio) {
      const curso = cursos.find(c => c.id === formData.curso_id);
      if (curso && curso.tipo === 'avulso' && curso.duracao_meses) {
        const dataInicio = new Date(formData.data_inicio);
        const dataFim = new Date(dataInicio);
        dataFim.setMonth(dataFim.getMonth() + curso.duracao_meses);
        setFormData(prev => ({
          ...prev,
          data_fim: dataFim.toISOString().split('T')[0]
        }));
      } else if (curso && curso.tipo === 'regular') {
        setFormData(prev => ({ ...prev, data_fim: '' }));
      }
    }
  }, [formData.curso_id, formData.data_inicio, cursos]);

  // Função para carregar todos os dados
  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMatriculas(),
        loadAlunos(),
        loadCursos()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Carregar matrículas com joins
  const loadMatriculas = async () => {
    const { data, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        aluno:alunos(id, nome_completo, cpf, telefone, email),
        curso:cursos(id, nome, tipo, valor_mensalidade, dia_vencimento)
      `)
      .order('data_matricula', { ascending: false });

    if (error) throw error;
    setMatriculas(data || []);
  };

  // Carregar alunos ativos
  const loadAlunos = async () => {
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .eq('status', 'ativo')
      .order('nome_completo', { ascending: true });

    if (error) throw error;
    setAlunos(data || []);
  };

  // Carregar cursos ativos
  const loadCursos = async () => {
    const { data, error } = await supabase
      .from('cursos')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    setCursos(data || []);
  };

  // Função para filtrar matrículas
  const filterMatriculas = () => {
    let filtered = [...matriculas];

    // Filtro de busca (nome aluno, nome curso)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(mat =>
        mat.aluno?.nome_completo?.toLowerCase().includes(term) ||
        mat.curso?.nome?.toLowerCase().includes(term)
      );
    }

    // Filtro de status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(mat => mat.status === filterStatus);
    }

    // Filtro de curso
    if (filterCurso !== 'all') {
      filtered = filtered.filter(mat => mat.curso_id === filterCurso);
    }

    setFilteredMatriculas(filtered);
  };

  // Validação do formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.aluno_id) {
      errors.aluno_id = 'Selecione um aluno';
    }

    if (!formData.curso_id) {
      errors.curso_id = 'Selecione um curso';
    }

    if (!formData.data_inicio) {
      errors.data_inicio = 'Data de início é obrigatória';
    }

    if (formData.data_fim && formData.data_inicio) {
      if (new Date(formData.data_fim) < new Date(formData.data_inicio)) {
        errors.data_fim = 'Data de término deve ser posterior à data de início';
      }
    }

    if (formData.dia_vencimento_personalizado) {
      const dia = parseInt(formData.dia_vencimento_personalizado);
      if (dia < 1 || dia > 31) {
        errors.dia_vencimento_personalizado = 'Dia deve estar entre 1 e 31';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Abrir modal para criar nova matrícula
  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      aluno_id: '',
      curso_id: '',
      data_matricula: new Date().toISOString().split('T')[0],
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: '',
      dia_vencimento_personalizado: '',
      status: 'ativa',
      observacoes: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Abrir modal para editar matrícula
  const openEditModal = (matricula) => {
    setModalMode('edit');
    setFormData({
      id: matricula.id,
      aluno_id: matricula.aluno_id || '',
      curso_id: matricula.curso_id || '',
      data_matricula: matricula.data_matricula || '',
      data_inicio: matricula.data_inicio || '',
      data_fim: matricula.data_fim || '',
      dia_vencimento_personalizado: matricula.dia_vencimento_personalizado?.toString() || '',
      status: matricula.status || 'ativa',
      observacoes: matricula.observacoes || ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setFormData({
      aluno_id: '',
      curso_id: '',
      data_matricula: new Date().toISOString().split('T')[0],
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: '',
      dia_vencimento_personalizado: '',
      status: 'ativa',
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
        aluno_id: formData.aluno_id,
        curso_id: formData.curso_id,
        data_matricula: formData.data_matricula,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        dia_vencimento_personalizado: formData.dia_vencimento_personalizado
          ? parseInt(formData.dia_vencimento_personalizado)
          : null,
        status: formData.status,
        observacoes: formData.observacoes?.trim() || null
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('matriculas')
          .insert([dataToSave]);

        if (error) throw error;
        showToast.success('Matrícula cadastrada com sucesso!');
      } else {
        const { error } = await supabase
          .from('matriculas')
          .update(dataToSave)
          .eq('id', formData.id);

        if (error) throw error;
        showToast.success('Matrícula atualizada com sucesso!');
      }

      closeModal();
      loadMatriculas();
    } catch (error) {
      console.error('Erro ao salvar matrícula:', error);
      showToast.error('Erro ao salvar matrícula: ' + error.message);
    }
  };

  // Abrir modal de confirmação de exclusão
  const handleDeleteClick = (matricula) => {
    setDeleteModal({
      isOpen: true,
      id: matricula.id,
      info: `${matricula.aluno?.nome_completo} - ${matricula.curso?.nome}`
    });
  };

  // Confirmar exclusão
  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('matriculas')
        .delete()
        .eq('id', deleteModal.id);

      if (error) throw error;

      showToast.success('Matrícula excluída com sucesso!');
      setDeleteModal({ isOpen: false, id: null, info: '' });
      loadMatriculas();
    } catch (error) {
      console.error('Erro ao excluir matrícula:', error);
      if (error.code === '23503') {
        showToast.error('Não é possível excluir esta matrícula pois existem mensalidades vinculadas');
      } else {
        showToast.error('Erro ao excluir matrícula: ' + error.message);
      }
    }
  };

  // Formatar data para exibição
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
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
        <p>Carregando matrículas...</p>
      </div>
    );
  }

  return (
    <div className="matricula-manager">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <GraduationCap size={28} />
          <div>
            <h2>Gerenciar Matrículas</h2>
            <p className="header-subtitle">Vincular alunos aos cursos</p>
          </div>
        </div>
        <Button onClick={openCreateModal} icon={<Plus size={20} />}>
          Nova Matrícula
        </Button>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por aluno ou curso..."
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
          value={filterCurso}
          onChange={(e) => setFilterCurso(e.target.value)}
        >
          <option value="all">Todos os cursos</option>
          {cursos.map(curso => (
            <option key={curso.id} value={curso.id}>{curso.nome}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="ativa">Ativa</option>
          <option value="trancada">Trancada</option>
          <option value="cancelada">Cancelada</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>

      {/* Estatísticas */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{matriculas.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {matriculas.filter(m => m.status === 'ativa').length}
          </span>
          <span className="stat-label">Ativas</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {matriculas.filter(m => m.status === 'trancada').length}
          </span>
          <span className="stat-label">Trancadas</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {matriculas.filter(m => m.status === 'concluida').length}
          </span>
          <span className="stat-label">Concluídas</span>
        </div>
      </div>

      {/* Tabela de Matrículas */}
      <div className="table-container">
        {filteredMatriculas.length === 0 ? (
          <div className="empty-state">
            <GraduationCap size={64} color="#ccc" />
            <p>Nenhuma matrícula encontrada</p>
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
                <th>Aluno</th>
                <th>Curso</th>
                <th>Tipo</th>
                <th>Mensalidade</th>
                <th>Data Início</th>
                <th>Data Fim</th>
                <th>Status</th>
                <th className="actions-column">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatriculas.map((matricula) => (
                <tr key={matricula.id}>
                  <td>
                    <strong>{matricula.aluno?.nome_completo}</strong>
                    {matricula.observacoes && (
                      <small className="observacao-hint" title={matricula.observacoes}>
                        📋 Observações
                      </small>
                    )}
                  </td>
                  <td>
                    <strong>{matricula.curso?.nome}</strong>
                    {matricula.dia_vencimento_personalizado && (
                      <small className="info-hint">
                        Vencimento dia {matricula.dia_vencimento_personalizado}
                      </small>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${matricula.curso?.tipo}`}>
                      {matricula.curso?.tipo === 'regular' ? 'Regular' : 'Avulso'}
                    </span>
                  </td>
                  <td>{formatMoeda(matricula.curso?.valor_mensalidade)}</td>
                  <td>{formatDate(matricula.data_inicio)}</td>
                  <td>{formatDate(matricula.data_fim)}</td>
                  <td>
                    <span className={`status-badge status-${matricula.status}`}>
                      {matricula.status}
                    </span>
                  </td>
                  <td className="actions-column">
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => openEditModal(matricula)}
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => handleDeleteClick(matricula)}
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
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? 'Nova Matrícula' : 'Editar Matrícula'}</h3>
              <button className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Aluno *</label>
                    <select
                      className={`form-select ${formErrors.aluno_id ? 'error' : ''}`}
                      value={formData.aluno_id}
                      onChange={(e) => setFormData({ ...formData, aluno_id: e.target.value })}
                      disabled={modalMode === 'edit'}
                    >
                      <option value="">Selecione um aluno</option>
                      {alunos.map(aluno => (
                        <option key={aluno.id} value={aluno.id}>
                          {aluno.nome_completo}
                        </option>
                      ))}
                    </select>
                    {formErrors.aluno_id && (
                      <span className="error-message">{formErrors.aluno_id}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Curso *</label>
                    <select
                      className={`form-select ${formErrors.curso_id ? 'error' : ''}`}
                      value={formData.curso_id}
                      onChange={(e) => setFormData({ ...formData, curso_id: e.target.value })}
                      disabled={modalMode === 'edit'}
                    >
                      <option value="">Selecione um curso</option>
                      {cursos.map(curso => (
                        <option key={curso.id} value={curso.id}>
                          {curso.nome} - {formatMoeda(curso.valor_mensalidade)}
                        </option>
                      ))}
                    </select>
                    {formErrors.curso_id && (
                      <span className="error-message">{formErrors.curso_id}</span>
                    )}
                    {formData.curso_id && (
                      <small className="form-hint">
                        {cursos.find(c => c.id === formData.curso_id)?.tipo === 'regular'
                          ? 'Curso regular: gera mensalidades recorrentes'
                          : `Curso avulso: ${cursos.find(c => c.id === formData.curso_id)?.duracao_meses} meses`
                        }
                      </small>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <Input
                    label="Data da Matrícula"
                    type="date"
                    value={formData.data_matricula}
                    onChange={(e) => setFormData({ ...formData, data_matricula: e.target.value })}
                    required
                  />

                  <Input
                    label="Data de Início"
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    error={formErrors.data_inicio}
                    required
                  />
                </div>

                <div className="form-row">
                  <Input
                    label="Data de Término"
                    type="date"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    error={formErrors.data_fim}
                    disabled={formData.curso_id && cursos.find(c => c.id === formData.curso_id)?.tipo === 'avulso'}
                  />

                  <Input
                    label="Dia Vencimento Personalizado"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dia_vencimento_personalizado}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento_personalizado: e.target.value })}
                    error={formErrors.dia_vencimento_personalizado}
                    placeholder="Deixe vazio para usar padrão do curso"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Status *</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="ativa">Ativa</option>
                      <option value="trancada">Trancada</option>
                      <option value="cancelada">Cancelada</option>
                      <option value="concluida">Concluída</option>
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
                      placeholder="Informações adicionais sobre a matrícula"
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
        onClose={() => setDeleteModal({ isOpen: false, id: null, info: '' })}
        onConfirm={handleDeleteConfirm}
        title="Excluir Matrícula"
        message={`Tem certeza que deseja excluir a matrícula de "${deleteModal.info}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
}

export default MatriculaManager;
