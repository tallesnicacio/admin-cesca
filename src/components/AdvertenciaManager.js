import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Plus, X, AlertTriangle, Calendar, FileText, Trash2, Edit2, User, Award } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import { ConfirmModal } from './Modal';
import './AdvertenciaManager.css';

function AdvertenciaManager({ userProfile }) {
  const [advertencias, setAdvertencias] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [filteredAdvertencias, setFilteredAdvertencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterTrabalhador, setFilterTrabalhador] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedAdvertencia, setSelectedAdvertencia] = useState(null);
  const [formData, setFormData] = useState({
    trabalhador_id: '',
    tipo: '1º Verbal',
    data_advertencia: new Date().toISOString().split('T')[0],
    motivo: '',
    observacoes: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, advertenciaId: null });
  const [modalLoading, setModalLoading] = useState(false);
  const [resumo, setResumo] = useState([]);
  const [showResumo, setShowResumo] = useState(false);
  const [selectedTrabalhadorResumo, setSelectedTrabalhadorResumo] = useState(null);

  const tiposAdvertencia = ['1º Verbal', '2º Verbal', '3º Verbal', '4º Verbal', '5º Verbal'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterAdvertencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterTipo, filterTrabalhador, advertencias]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar trabalhadores
      const { data: trabData, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .order('numero', { ascending: true, nullsFirst: false })
        .order('nome_completo', { ascending: true });

      if (trabError) throw trabError;
      setTrabalhadores(trabData || []);

      // Carregar advertências com histórico
      const { data: advData, error: advError } = await supabase
        .from('vw_advertencias_historico')
        .select('*')
        .order('data_advertencia', { ascending: false });

      if (advError) throw advError;
      setAdvertencias(advData || []);

      // Carregar resumo
      const { data: resumoData, error: resumoError } = await supabase
        .from('vw_advertencias_resumo')
        .select('*')
        .order('total_advertencias', { ascending: false });

      if (resumoError) throw resumoError;
      setResumo(resumoData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterAdvertencias = () => {
    let filtered = [...advertencias];

    // Busca por nome do trabalhador
    if (searchTerm) {
      filtered = filtered.filter(adv =>
        adv.trabalhador_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tipo
    if (filterTipo !== 'all') {
      filtered = filtered.filter(adv => adv.tipo === filterTipo);
    }

    // Filtro por trabalhador
    if (filterTrabalhador !== 'all') {
      filtered = filtered.filter(adv => adv.trabalhador_id === filterTrabalhador);
    }

    setFilteredAdvertencias(filtered);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.trabalhador_id) {
      errors.trabalhador_id = 'Selecione um trabalhador';
    }
    if (!formData.tipo) {
      errors.tipo = 'Selecione o tipo de advertência';
    }
    if (!formData.data_advertencia) {
      errors.data_advertencia = 'Informe a data da advertência';
    }
    if (!formData.motivo || formData.motivo.trim() === '') {
      errors.motivo = 'Informe o motivo da advertência';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenModal = (mode, advertencia = null) => {
    setModalMode(mode);
    setSelectedAdvertencia(advertencia);

    if (mode === 'edit' && advertencia) {
      setFormData({
        trabalhador_id: advertencia.trabalhador_id,
        tipo: advertencia.tipo,
        data_advertencia: advertencia.data_advertencia,
        motivo: advertencia.motivo || '',
        observacoes: advertencia.observacoes || ''
      });
    } else {
      setFormData({
        trabalhador_id: '',
        tipo: '1º Verbal',
        data_advertencia: new Date().toISOString().split('T')[0],
        motivo: '',
        observacoes: ''
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAdvertencia(null);
    setFormData({
      trabalhador_id: '',
      tipo: '1º Verbal',
      data_advertencia: new Date().toISOString().split('T')[0],
      motivo: '',
      observacoes: ''
    });
    setFormErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast.error('Por favor, corrija os erros no formulário');
      return;
    }

    try {
      setModalLoading(true);

      const payload = {
        ...formData,
        aplicado_por: userProfile?.id
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('advertencias')
          .insert([payload]);

        if (error) throw error;
        showToast.success('Advertência registrada com sucesso!');
      } else {
        const { error } = await supabase
          .from('advertencias')
          .update(payload)
          .eq('id', selectedAdvertencia.id);

        if (error) throw error;
        showToast.success('Advertência atualizada com sucesso!');
      }

      handleCloseModal();
      loadData();
    } catch (error) {
      console.error('Erro ao salvar advertência:', error);
      showToast.error('Erro ao salvar advertência: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (advertenciaId) => {
    setDeleteModal({ isOpen: true, advertenciaId });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('advertencias')
        .delete()
        .eq('id', deleteModal.advertenciaId);

      if (error) throw error;

      showToast.success('Advertência excluída com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao excluir advertência:', error);
      showToast.error('Erro ao excluir advertência: ' + error.message);
    } finally {
      setDeleteModal({ isOpen: false, advertenciaId: null });
    }
  };

  const getTipoBadgeColor = (tipo) => {
    switch (tipo) {
      case '1º Verbal': return '#3b82f6'; // blue
      case '2º Verbal': return '#f59e0b'; // orange
      case '3º Verbal': return '#ef4444'; // red
      case '4º Verbal': return '#dc2626'; // dark red
      case '5º Verbal': return '#991b1b'; // very dark red
      default: return '#6b7280'; // gray
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getStatsCards = () => {
    const total = advertencias.length;
    const trabalhadores_com_advertencia = new Set(advertencias.map(a => a.trabalhador_id)).size;
    const ultimas_30_dias = advertencias.filter(a => {
      const diff = new Date() - new Date(a.data_advertencia + 'T00:00:00');
      return diff <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    return { total, trabalhadores_com_advertencia, ultimas_30_dias };
  };

  const stats = getStatsCards();

  const exportToExcel = () => {
    showToast.info('Exportação Excel em desenvolvimento...');
  };

  if (loading) {
    return (
      <div className="trabalhador-manager">
        <div className="loading">Carregando advertências...</div>
      </div>
    );
  }

  return (
    <div className="trabalhador-manager">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="manager-header">
        <div className="header-title">
          <AlertTriangle size={32} />
          <div>
            <h1>Gerenciar Advertências</h1>
            <p>Controle de advertências verbais aplicadas aos trabalhadores</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal('create')}>
          <Plus size={20} />
          Nova Advertência
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total de Advertências</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <User size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.trabalhadores_com_advertencia}</div>
            <div className="stat-label">Trabalhadores com Advertência</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.ultimas_30_dias}</div>
            <div className="stat-label">Últimos 30 Dias</div>
          </div>
        </div>
      </div>

      {/* Toggle Resumo */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <button
          className={showResumo ? "btn-secondary" : "btn-primary"}
          onClick={() => setShowResumo(!showResumo)}
          style={{ marginRight: '1rem' }}
        >
          <Award size={20} />
          {showResumo ? 'Ver Histórico' : 'Ver Resumo por Trabalhador'}
        </button>
      </div>

      {showResumo ? (
        /* RESUMO POR TRABALHADOR */
        <div className="table-container">
          <div className="filters-bar">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Buscar trabalhador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Nome</th>
                <th>Grupo</th>
                <th>Status</th>
                <th>1º Verbal</th>
                <th>2º Verbal</th>
                <th>3º Verbal</th>
                <th>4º Verbal</th>
                <th>5º Verbal</th>
                <th>Total</th>
                <th>Última</th>
              </tr>
            </thead>
            <tbody>
              {resumo
                .filter(r => r.total_advertencias > 0)
                .filter(r => !searchTerm || r.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((r) => (
                <tr key={r.trabalhador_id}>
                  <td>{r.numero || '-'}</td>
                  <td><strong>{r.nome_completo}</strong></td>
                  <td>
                    <span className="badge" style={{
                      background: r.grupo === 'Direção' ? '#667eea' : '#10b981',
                      color: '#fff'
                    }}>
                      {r.grupo || '-'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${r.status}`}>
                      {r.status === 'ativo' ? 'Ativo' : r.status === 'afastado' ? 'Afastado' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-center">{r.advertencias_1 || 0}</td>
                  <td className="text-center">{r.advertencias_2 || 0}</td>
                  <td className="text-center">{r.advertencias_3 || 0}</td>
                  <td className="text-center">{r.advertencias_4 || 0}</td>
                  <td className="text-center">{r.advertencias_5 || 0}</td>
                  <td className="text-center">
                    <strong style={{ color: r.total_advertencias >= 3 ? '#ef4444' : '#667eea' }}>
                      {r.total_advertencias}
                    </strong>
                  </td>
                  <td>{formatDate(r.ultima_advertencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {resumo.filter(r => r.total_advertencias > 0).length === 0 && (
            <div className="empty-state">
              <AlertTriangle size={48} />
              <p>Nenhuma advertência registrada</p>
            </div>
          )}
        </div>
      ) : (
        /* HISTÓRICO DE ADVERTÊNCIAS */
        <>
          {/* Filters */}
          <div className="filters-bar">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Buscar por nome do trabalhador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="all">Todos os Tipos</option>
              {tiposAdvertencia.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filterTrabalhador}
              onChange={(e) => setFilterTrabalhador(e.target.value)}
            >
              <option value="all">Todos os Trabalhadores</option>
              {trabalhadores.map(trab => (
                <option key={trab.id} value={trab.id}>
                  {trab.numero ? `${trab.numero} - ` : ''}{trab.nome_completo}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Trabalhador</th>
                  <th>Grupo</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Motivo</th>
                  <th>Aplicado Por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdvertencias.map((adv) => (
                  <tr key={adv.id}>
                    <td>{adv.trabalhador_numero || '-'}</td>
                    <td><strong>{adv.trabalhador_nome}</strong></td>
                    <td>
                      <span className="badge" style={{
                        background: adv.grupo === 'Direção' ? '#667eea' : '#10b981',
                        color: '#fff'
                      }}>
                        {adv.grupo || '-'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: getTipoBadgeColor(adv.tipo), color: '#fff' }}
                      >
                        {adv.tipo}
                      </span>
                    </td>
                    <td>{formatDate(adv.data_advertencia)}</td>
                    <td>{adv.motivo}</td>
                    <td>{adv.aplicado_por_nome || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleOpenModal('edit', adv)}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(adv.id)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAdvertencias.length === 0 && (
              <div className="empty-state">
                <AlertTriangle size={48} />
                <p>Nenhuma advertência encontrada</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'create' ? (
                  <>
                    <Plus size={24} />
                    Nova Advertência
                  </>
                ) : (
                  <>
                    <Edit2 size={24} />
                    Editar Advertência
                  </>
                )}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  <User size={18} />
                  Trabalhador *
                </label>
                <select
                  value={formData.trabalhador_id}
                  onChange={(e) => setFormData({ ...formData, trabalhador_id: e.target.value })}
                  className={formErrors.trabalhador_id ? 'error' : ''}
                  disabled={modalMode === 'edit'}
                >
                  <option value="">Selecione um trabalhador</option>
                  {trabalhadores.map(trab => (
                    <option key={trab.id} value={trab.id}>
                      {trab.numero ? `${trab.numero} - ` : ''}{trab.nome_completo}
                      {trab.grupo ? ` (${trab.grupo})` : ''}
                    </option>
                  ))}
                </select>
                {formErrors.trabalhador_id && (
                  <span className="error-message">{formErrors.trabalhador_id}</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <AlertTriangle size={18} />
                  Tipo de Advertência *
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className={formErrors.tipo ? 'error' : ''}
                >
                  {tiposAdvertencia.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
                {formErrors.tipo && (
                  <span className="error-message">{formErrors.tipo}</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Calendar size={18} />
                  Data da Advertência *
                </label>
                <input
                  type="date"
                  value={formData.data_advertencia}
                  onChange={(e) => setFormData({ ...formData, data_advertencia: e.target.value })}
                  className={formErrors.data_advertencia ? 'error' : ''}
                />
                {formErrors.data_advertencia && (
                  <span className="error-message">{formErrors.data_advertencia}</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <FileText size={18} />
                  Motivo *
                </label>
                <textarea
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  placeholder="Descreva o motivo da advertência..."
                  rows={3}
                  className={formErrors.motivo ? 'error' : ''}
                />
                {formErrors.motivo && (
                  <span className="error-message">{formErrors.motivo}</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <FileText size={18} />
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais (opcional)..."
                  rows={2}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                  disabled={modalLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Excluir Advertência"
        message="Tem certeza que deseja excluir esta advertência? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, advertenciaId: null })}
      />
    </div>
  );
}

export default AdvertenciaManager;
