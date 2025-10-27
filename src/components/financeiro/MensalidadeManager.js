// MensalidadeManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { showToast } from '../Toast';
import {
  Search,
  X,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Plus,
  CreditCard,
  Wallet
} from 'lucide-react';
import './MensalidadeManager.css';

const MensalidadeManager = () => {
  const [mensalidades, setMensalidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [mesFilter, setMesFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState('');
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState('todos');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState(null);
  const [paymentData, setPaymentData] = useState({
    valor_pago: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'dinheiro',
    observacoes: ''
  });
  const [stats, setStats] = useState({
    totalPendente: 0,
    totalPago: 0,
    totalAtrasado: 0,
    quantidade: 0
  });

  // Carregar mensalidades
  const fetchMensalidades = useCallback(async () => {
    try {
      setLoading(true);

      // Query base - busca todos os campos necessários
      let query = supabase
        .from('mensalidades')
        .select(`
          *,
          matricula:matriculas (
            id,
            aluno:alunos (
              id,
              nome_completo,
              cpf,
              telefone
            ),
            curso:cursos (
              id,
              nome,
              tipo
            )
          )
        `)
        .order('ano_referencia', { ascending: false })
        .order('mes_referencia', { ascending: false })
        .order('data_vencimento', { ascending: false });

      // Filtro por status
      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      // Filtro por mês
      if (mesFilter) {
        query = query.eq('mes_referencia', parseInt(mesFilter));
      }

      // Filtro por ano
      if (anoFilter) {
        query = query.eq('ano_referencia', parseInt(anoFilter));
      }

      // Filtro por forma de pagamento
      if (formaPagamentoFilter !== 'todos') {
        query = query.eq('forma_pagamento', formaPagamentoFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtro por busca (nome do aluno)
      let filteredData = data || [];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter(m =>
          m.matricula?.aluno?.nome_completo?.toLowerCase().includes(searchLower) ||
          m.matricula?.aluno?.cpf?.includes(searchTerm)
        );
      }

      setMensalidades(filteredData);
      calculateStats(filteredData);
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
      showToast.error('Erro ao carregar mensalidades');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, mesFilter, anoFilter, formaPagamentoFilter, searchTerm]);

  useEffect(() => {
    fetchMensalidades();
  }, [fetchMensalidades]);

  // Calcular estatísticas
  const calculateStats = (data) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const stats = data.reduce((acc, m) => {
      acc.quantidade++;

      const vencimento = new Date(m.data_vencimento);
      const isAtrasado = m.status === 'pendente' && vencimento < hoje;

      if (m.status === 'pendente') {
        acc.totalPendente += parseFloat(m.valor || 0);
        if (isAtrasado) {
          acc.totalAtrasado += parseFloat(m.valor || 0);
        }
      } else if (m.status === 'pago') {
        acc.totalPago += parseFloat(m.valor_pago || 0);
      }

      return acc;
    }, {
      totalPendente: 0,
      totalPago: 0,
      totalAtrasado: 0,
      quantidade: 0
    });

    setStats(stats);
  };

  // Abrir modal de pagamento
  const handleOpenPaymentModal = (mensalidade) => {
    setSelectedMensalidade(mensalidade);
    setPaymentData({
      valor_pago: mensalidade.valor.toString(),
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: 'dinheiro',
      observacoes: ''
    });
    setShowPaymentModal(true);
  };

  // Registrar pagamento
  const handleRegisterPayment = async (e) => {
    e.preventDefault();

    if (!selectedMensalidade) return;

    try {
      const valorPago = parseFloat(paymentData.valor_pago);

      if (isNaN(valorPago) || valorPago <= 0) {
        showToast.error('Valor pago deve ser maior que zero');
        return;
      }

      const { error } = await supabase
        .from('mensalidades')
        .update({
          valor_pago: valorPago,
          data_pagamento: paymentData.data_pagamento,
          forma_pagamento: paymentData.forma_pagamento,
          status: 'pago',
          observacoes: paymentData.observacoes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMensalidade.id);

      if (error) throw error;

      showToast.success('Pagamento registrado com sucesso!');
      setShowPaymentModal(false);
      setSelectedMensalidade(null);
      fetchMensalidades();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      showToast.error('Erro ao registrar pagamento');
    }
  };

  // Cancelar mensalidade
  const handleCancelMensalidade = async (mensalidade) => {
    if (!window.confirm(`Deseja realmente cancelar esta mensalidade de ${mensalidade.matricula?.aluno?.nome_completo}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mensalidades')
        .update({
          status: 'cancelado',
          updated_at: new Date().toISOString()
        })
        .eq('id', mensalidade.id);

      if (error) throw error;

      showToast.success('Mensalidade cancelada com sucesso!');
      fetchMensalidades();
    } catch (error) {
      console.error('Erro ao cancelar mensalidade:', error);
      showToast.error('Erro ao cancelar mensalidade');
    }
  };

  // Gerar mensalidades do mês
  const handleGerarMensalidades = async () => {
    const hoje = new Date();
    const mes = hoje.getMonth() + 1; // JavaScript months are 0-indexed
    const ano = hoje.getFullYear();

    const confirmacao = window.confirm(
      `Deseja gerar as mensalidades para ${mes}/${ano}?\n\n` +
      `Isso criará mensalidades para todas as matrículas ativas que ainda não possuem mensalidade neste mês.`
    );

    if (!confirmacao) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('gerar_mensalidades_mes', {
        p_mes: mes,
        p_ano: ano
      });

      if (error) throw error;

      const resultado = data[0];

      if (resultado.erros && resultado.erros.length > 0) {
        showToast.warning(
          `Mensalidades geradas com avisos:\n` +
          `${resultado.mensalidades_criadas} criadas, ${resultado.matriculas_processadas} processadas\n` +
          `Avisos: ${resultado.erros.join(', ')}`
        );
      } else {
        showToast.success(
          `Mensalidades geradas com sucesso!\n` +
          `${resultado.mensalidades_criadas} mensalidades criadas de ${resultado.matriculas_processadas} matrículas processadas`
        );
      }

      fetchMensalidades();
    } catch (error) {
      console.error('Erro ao gerar mensalidades:', error);
      showToast.error('Erro ao gerar mensalidades: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Obter label do mês
  const getMesLabel = (mes) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || mes;
  };

  // Obter badge de status
  const getStatusBadge = (mensalidade) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(mensalidade.data_vencimento);

    // Se está pendente e passou da data, marca como atrasado visualmente
    if (mensalidade.status === 'pendente' && vencimento < hoje) {
      return <span className="status-badge status-atrasado">Atrasado</span>;
    }

    const statusMap = {
      pendente: { label: 'Pendente', class: 'status-pendente' },
      pago: { label: 'Pago', class: 'status-pago' },
      atrasado: { label: 'Atrasado', class: 'status-atrasado' },
      cancelado: { label: 'Cancelado', class: 'status-cancelado' }
    };

    const statusInfo = statusMap[mensalidade.status] || statusMap.pendente;
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  // Limpar busca
  const handleClearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="mensalidade-manager">
      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <DollarSign size={32} />
          <div>
            <h2>Gestão de Mensalidades</h2>
            <p className="header-subtitle">
              Controle de pagamentos e inadimplência
            </p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGerarMensalidades}
          disabled={loading}
        >
          <Plus size={20} />
          Gerar Mensalidades do Mês
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por aluno ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={handleClearSearch}>
              <X size={18} />
            </button>
          )}
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="todos">Todos os Status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <select
          className="filter-select"
          value={mesFilter}
          onChange={(e) => setMesFilter(e.target.value)}
        >
          <option value="">Todos os Meses</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
            <option key={mes} value={mes}>{getMesLabel(mes)}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={anoFilter}
          onChange={(e) => setAnoFilter(e.target.value)}
        >
          <option value="">Todos os Anos</option>
          {[2024, 2025, 2026].map(ano => (
            <option key={ano} value={ano}>{ano}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={formaPagamentoFilter}
          onChange={(e) => setFormaPagamentoFilter(e.target.value)}
        >
          <option value="todos">Todas as Formas</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="cartao_debito">Cartão Débito</option>
          <option value="cartao_credito">Cartão Crédito</option>
          <option value="transferencia">Transferência</option>
        </select>
      </div>

      {/* Estatísticas */}
      <div className="stats-bar">
        <div className="stat-item stat-pendente">
          <Clock size={24} />
          <div className="stat-value">{formatCurrency(stats.totalPendente)}</div>
          <div className="stat-label">A Receber</div>
        </div>

        <div className="stat-item stat-pago">
          <CheckCircle size={24} />
          <div className="stat-value">{formatCurrency(stats.totalPago)}</div>
          <div className="stat-label">Recebido</div>
        </div>

        <div className="stat-item stat-atrasado">
          <AlertCircle size={24} />
          <div className="stat-value">{formatCurrency(stats.totalAtrasado)}</div>
          <div className="stat-label">Em Atraso</div>
        </div>

        <div className="stat-item">
          <Wallet size={24} />
          <div className="stat-value">{stats.quantidade}</div>
          <div className="stat-label">Mensalidades</div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Carregando mensalidades...</p>
        </div>
      ) : mensalidades.length === 0 ? (
        <div className="empty-state">
          <DollarSign size={64} />
          <p>Nenhuma mensalidade encontrada</p>
          <button className="btn-link" onClick={handleGerarMensalidades}>
            Gerar mensalidades do mês atual
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Curso</th>
                <th>Referência</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th className="actions-column">Ações</th>
              </tr>
            </thead>
            <tbody>
              {mensalidades.map((mensalidade) => (
                <tr key={mensalidade.id}>
                  <td>
                    <strong>{mensalidade.matricula?.aluno?.nome_completo || 'N/A'}</strong>
                    <span className="info-secondary">
                      {mensalidade.matricula?.aluno?.cpf || ''}
                    </span>
                  </td>
                  <td>
                    <div className="curso-info">
                      <span className="curso-name">
                        {mensalidade.matricula?.curso?.nome || 'N/A'}
                      </span>
                      <span className="curso-tipo">
                        {mensalidade.matricula?.curso?.tipo || ''}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>
                      {getMesLabel(mensalidade.mes_referencia)}/{mensalidade.ano_referencia}
                    </strong>
                  </td>
                  <td>
                    <span className="date-info">
                      {formatDate(mensalidade.data_vencimento)}
                    </span>
                  </td>
                  <td>
                    <span className="valor-highlight">
                      {formatCurrency(mensalidade.valor)}
                    </span>
                  </td>
                  <td>
                    {getStatusBadge(mensalidade)}
                  </td>
                  <td>
                    {mensalidade.status === 'pago' ? (
                      <div className="payment-info">
                        <span className="valor-pago">
                          {formatCurrency(mensalidade.valor_pago)}
                        </span>
                        <span className="info-secondary">
                          {formatDate(mensalidade.data_pagamento)}
                        </span>
                        <span className="forma-pagamento">
                          {mensalidade.forma_pagamento}
                        </span>
                      </div>
                    ) : (
                      <span className="info-secondary">-</span>
                    )}
                  </td>
                  <td className="actions-column">
                    <div className="action-buttons">
                      {mensalidade.status === 'pendente' && (
                        <>
                          <button
                            className="btn-icon"
                            onClick={() => handleOpenPaymentModal(mensalidade)}
                            title="Registrar Pagamento"
                          >
                            <CreditCard size={18} />
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => handleCancelMensalidade(mensalidade)}
                            title="Cancelar"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedMensalidade && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Pagamento</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment}>
              <div className="modal-body">
                <div className="info-box">
                  <p>
                    <strong>Aluno:</strong> {selectedMensalidade.matricula?.aluno?.nome_completo}<br />
                    <strong>Curso:</strong> {selectedMensalidade.matricula?.curso?.nome}<br />
                    <strong>Referência:</strong> {getMesLabel(selectedMensalidade.mes_referencia)}/{selectedMensalidade.ano_referencia}<br />
                    <strong>Valor:</strong> {formatCurrency(selectedMensalidade.valor)}
                  </p>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Valor Pago *</label>
                    <input
                      type="number"
                      className="form-input"
                      step="0.01"
                      min="0"
                      value={paymentData.valor_pago}
                      onChange={(e) => setPaymentData({ ...paymentData, valor_pago: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Data do Pagamento *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={paymentData.data_pagamento}
                      onChange={(e) => setPaymentData({ ...paymentData, data_pagamento: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Forma de Pagamento *</label>
                    <select
                      className="form-select"
                      value={paymentData.forma_pagamento}
                      onChange={(e) => setPaymentData({ ...paymentData, forma_pagamento: e.target.value })}
                      required
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="transferencia">Transferência Bancária</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Observações</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      value={paymentData.observacoes}
                      onChange={(e) => setPaymentData({ ...paymentData, observacoes: e.target.value })}
                      placeholder="Observações sobre o pagamento (opcional)"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle size={20} />
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MensalidadeManager;
