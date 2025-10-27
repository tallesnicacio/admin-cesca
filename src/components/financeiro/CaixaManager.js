// CaixaManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { showToast } from '../Toast';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Lock,
  Unlock,
  Plus,
  Coffee,
  ShoppingBag,
  CreditCard,
  Calendar,
  X
} from 'lucide-react';
import './CaixaManager.css';

const CaixaManager = () => {
  const [caixas, setCaixas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovimentacaoModal, setShowMovimentacaoModal] = useState(false);
  const [selectedSetor, setSelectedSetor] = useState(null);
  const [selectedCaixa, setSelectedCaixa] = useState(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [openFormData, setOpenFormData] = useState({
    valor_inicial: ''
  });
  const [closeFormData, setCloseFormData] = useState({
    valor_final: ''
  });
  const [movimentacaoFormData, setMovimentacaoFormData] = useState({
    tipo: 'entrada',
    valor: '',
    categoria: '',
    descricao: ''
  });

  const setoresInfo = {
    lanche: { nome: 'Lanche', icon: Coffee, color: '#f59e0b' },
    lojinha: { nome: 'Lojinha', icon: ShoppingBag, color: '#8b5cf6' },
    mensalidades: { nome: 'Mensalidades', icon: CreditCard, color: '#059669' }
  };

  // Carregar caixas do dia
  const fetchCaixas = useCallback(async () => {
    try {
      setLoading(true);

      const dataInicio = new Date(dateFilter);
      dataInicio.setHours(0, 0, 0, 0);

      const dataFim = new Date(dateFilter);
      dataFim.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .gte('data_abertura', dataInicio.toISOString())
        .lte('data_abertura', dataFim.toISOString())
        .order('data_abertura', { ascending: false });

      if (error) throw error;

      setCaixas(data || []);
    } catch (error) {
      console.error('Erro ao carregar caixas:', error);
      showToast.error('Erro ao carregar caixas');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  // Carregar movimentações
  const fetchMovimentacoes = useCallback(async () => {
    if (!selectedCaixa) {
      setMovimentacoes([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('movimentacoes_caixa')
        .select('*')
        .eq('caixa_id', selectedCaixa.id)
        .order('data_hora', { ascending: false });

      if (error) throw error;

      setMovimentacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
      showToast.error('Erro ao carregar movimentações');
    }
  }, [selectedCaixa]);

  useEffect(() => {
    fetchCaixas();
  }, [fetchCaixas]);

  useEffect(() => {
    fetchMovimentacoes();
  }, [fetchMovimentacoes]);

  // Abrir caixa
  const handleOpenCaixa = async (e) => {
    e.preventDefault();

    if (!selectedSetor) return;

    try {
      const valorInicial = parseFloat(openFormData.valor_inicial);

      if (isNaN(valorInicial) || valorInicial < 0) {
        showToast.error('Valor inicial deve ser um número válido');
        return;
      }

      const { error } = await supabase
        .from('caixas')
        .insert({
          setor: selectedSetor,
          status: 'aberto',
          data_abertura: new Date().toISOString(),
          valor_inicial: valorInicial
        });

      if (error) throw error;

      showToast.success(`Caixa ${setoresInfo[selectedSetor].nome} aberto com sucesso!`);
      setShowOpenModal(false);
      setSelectedSetor(null);
      setOpenFormData({ valor_inicial: '' });
      fetchCaixas();
    } catch (error) {
      console.error('Erro ao abrir caixa:', error);
      showToast.error('Erro ao abrir caixa: ' + error.message);
    }
  };

  // Fechar caixa
  const handleCloseCaixa = async (e) => {
    e.preventDefault();

    if (!selectedCaixa) return;

    try {
      const valorFinal = parseFloat(closeFormData.valor_final);

      if (isNaN(valorFinal) || valorFinal < 0) {
        showToast.error('Valor final deve ser um número válido');
        return;
      }

      // Calcular diferença
      const totalEntradas = movimentacoes
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + parseFloat(m.valor), 0);

      const totalSaidas = movimentacoes
        .filter(m => m.tipo === 'saida')
        .reduce((sum, m) => sum + parseFloat(m.valor), 0);

      const valorEsperado = parseFloat(selectedCaixa.valor_inicial) + totalEntradas - totalSaidas;
      const diferenca = valorFinal - valorEsperado;

      const { error } = await supabase
        .from('caixas')
        .update({
          status: 'fechado',
          data_fechamento: new Date().toISOString(),
          valor_final: valorFinal,
          diferenca: diferenca,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCaixa.id);

      if (error) throw error;

      showToast.success(
        `Caixa fechado com sucesso! ${diferenca !== 0 ? `Diferença: R$ ${diferenca.toFixed(2)}` : 'Caixa conferido!'}`
      );
      setShowCloseModal(false);
      setSelectedCaixa(null);
      setCloseFormData({ valor_final: '' });
      fetchCaixas();
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      showToast.error('Erro ao fechar caixa: ' + error.message);
    }
  };

  // Adicionar movimentação
  const handleAddMovimentacao = async (e) => {
    e.preventDefault();

    if (!selectedCaixa) return;

    try {
      const valor = parseFloat(movimentacaoFormData.valor);

      if (isNaN(valor) || valor <= 0) {
        showToast.error('Valor deve ser maior que zero');
        return;
      }

      if (!movimentacaoFormData.categoria?.trim()) {
        showToast.error('Categoria é obrigatória');
        return;
      }

      const { error } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          caixa_id: selectedCaixa.id,
          tipo: movimentacaoFormData.tipo,
          valor: valor,
          categoria: movimentacaoFormData.categoria.trim(),
          descricao: movimentacaoFormData.descricao?.trim() || null,
          data_hora: new Date().toISOString()
        });

      if (error) throw error;

      showToast.success('Movimentação registrada com sucesso!');
      setShowMovimentacaoModal(false);
      setMovimentacaoFormData({
        tipo: 'entrada',
        valor: '',
        categoria: '',
        descricao: ''
      });
      fetchMovimentacoes();
    } catch (error) {
      console.error('Erro ao adicionar movimentação:', error);
      showToast.error('Erro ao adicionar movimentação: ' + error.message);
    }
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Formatar data/hora
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  // Verificar se caixa está aberto
  const isCaixaAberto = (setor) => {
    return caixas.some(c => c.setor === setor && c.status === 'aberto');
  };

  // Obter caixa aberto
  const getCaixaAberto = (setor) => {
    return caixas.find(c => c.setor === setor && c.status === 'aberto');
  };

  // Calcular totais do caixa
  const calcularTotaisCaixa = (caixa) => {
    const movs = movimentacoes.filter(m => m.caixa_id === caixa.id);

    const totalEntradas = movs
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const totalSaidas = movs
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const saldoAtual = parseFloat(caixa.valor_inicial) + totalEntradas - totalSaidas;

    return { totalEntradas, totalSaidas, saldoAtual };
  };

  return (
    <div className="caixa-manager">
      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <Wallet size={32} />
          <div>
            <h2>Gestão de Caixas</h2>
            <p className="header-subtitle">
              Controle de caixas diários: Lanche, Lojinha e Mensalidades
            </p>
          </div>
        </div>
        <div className="date-filter">
          <Calendar size={20} />
          <input
            type="date"
            className="date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Cards dos Caixas */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Carregando caixas...</p>
        </div>
      ) : (
        <div className="caixas-grid">
          {Object.entries(setoresInfo).map(([setor, info]) => {
            const caixaAberto = getCaixaAberto(setor);
            const isAberto = isCaixaAberto(setor);
            const Icon = info.icon;

            return (
              <div
                key={setor}
                className={`caixa-card ${isAberto ? 'caixa-aberto' : 'caixa-fechado'}`}
                style={{ borderColor: info.color }}
              >
                <div className="caixa-card-header" style={{ background: info.color }}>
                  <div className="caixa-title">
                    <Icon size={24} />
                    <h3>{info.nome}</h3>
                  </div>
                  <div className="caixa-status">
                    {isAberto ? (
                      <>
                        <Unlock size={20} />
                        <span>Aberto</span>
                      </>
                    ) : (
                      <>
                        <Lock size={20} />
                        <span>Fechado</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="caixa-card-body">
                  {isAberto && caixaAberto ? (
                    <>
                      <div className="caixa-info">
                        <div className="info-item">
                          <span className="info-label">Abertura</span>
                          <span className="info-value">
                            {formatDateTime(caixaAberto.data_abertura)}
                          </span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Valor Inicial</span>
                          <span className="info-value">
                            {formatCurrency(caixaAberto.valor_inicial)}
                          </span>
                        </div>
                      </div>

                      {selectedCaixa?.id === caixaAberto.id && movimentacoes.length > 0 && (
                        <div className="caixa-resumo">
                          {(() => {
                            const { totalEntradas, totalSaidas, saldoAtual } = calcularTotaisCaixa(caixaAberto);
                            return (
                              <>
                                <div className="resumo-item entrada">
                                  <TrendingUp size={16} />
                                  <span>Entradas: {formatCurrency(totalEntradas)}</span>
                                </div>
                                <div className="resumo-item saida">
                                  <TrendingDown size={16} />
                                  <span>Saídas: {formatCurrency(totalSaidas)}</span>
                                </div>
                                <div className="resumo-item saldo">
                                  <DollarSign size={16} />
                                  <span>Saldo: {formatCurrency(saldoAtual)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className="caixa-actions">
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setSelectedCaixa(caixaAberto);
                            setShowMovimentacaoModal(true);
                          }}
                        >
                          <Plus size={18} />
                          Movimentação
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            setSelectedCaixa(caixaAberto);
                            setShowCloseModal(true);
                          }}
                        >
                          <Lock size={18} />
                          Fechar Caixa
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="caixa-closed">
                      <p>Caixa está fechado</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedSetor(setor);
                          setShowOpenModal(true);
                        }}
                      >
                        <Unlock size={18} />
                        Abrir Caixa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de Movimentações */}
      {selectedCaixa && movimentacoes.length > 0 && (
        <div className="movimentacoes-section">
          <h3>
            Movimentações - {setoresInfo[selectedCaixa.setor].nome}
            <span className="count-badge">{movimentacoes.length}</span>
          </h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((mov) => (
                  <tr key={mov.id}>
                    <td>{formatDateTime(mov.data_hora)}</td>
                    <td>
                      <span className={`tipo-badge tipo-${mov.tipo}`}>
                        {mov.tipo === 'entrada' ? (
                          <>
                            <TrendingUp size={14} /> Entrada
                          </>
                        ) : (
                          <>
                            <TrendingDown size={14} /> Saída
                          </>
                        )}
                      </span>
                    </td>
                    <td>{mov.categoria}</td>
                    <td>{mov.descricao || '-'}</td>
                    <td>
                      <span className={`valor-${mov.tipo}`}>
                        {formatCurrency(mov.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Abrir Caixa */}
      {showOpenModal && selectedSetor && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Abrir Caixa - {setoresInfo[selectedSetor].nome}</h3>
              <button className="modal-close" onClick={() => setShowOpenModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleOpenCaixa}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Valor Inicial *</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.01"
                    min="0"
                    value={openFormData.valor_inicial}
                    onChange={(e) => setOpenFormData({ valor_inicial: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                  <span className="form-hint">
                    Informe o valor inicial em dinheiro no caixa
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowOpenModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Unlock size={20} />
                  Abrir Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {showCloseModal && selectedCaixa && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fechar Caixa - {setoresInfo[selectedCaixa.setor].nome}</h3>
              <button className="modal-close" onClick={() => setShowCloseModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCloseCaixa}>
              <div className="modal-body">
                {(() => {
                  const { totalEntradas, totalSaidas, saldoAtual } = calcularTotaisCaixa(selectedCaixa);
                  return (
                    <div className="info-box">
                      <p>
                        <strong>Valor Inicial:</strong> {formatCurrency(selectedCaixa.valor_inicial)}<br />
                        <strong>Total Entradas:</strong> {formatCurrency(totalEntradas)}<br />
                        <strong>Total Saídas:</strong> {formatCurrency(totalSaidas)}<br />
                        <strong>Saldo Esperado:</strong> {formatCurrency(saldoAtual)}
                      </p>
                    </div>
                  );
                })()}

                <div className="form-group">
                  <label>Valor Final (Contado) *</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.01"
                    min="0"
                    value={closeFormData.valor_final}
                    onChange={(e) => setCloseFormData({ valor_final: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                  <span className="form-hint">
                    Informe o valor real contado no caixa
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCloseModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger">
                  <Lock size={20} />
                  Fechar Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Movimentação */}
      {showMovimentacaoModal && selectedCaixa && (
        <div className="modal-overlay" onClick={() => setShowMovimentacaoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Movimentação - {setoresInfo[selectedCaixa.setor].nome}</h3>
              <button className="modal-close" onClick={() => setShowMovimentacaoModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddMovimentacao}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select
                      className="form-select"
                      value={movimentacaoFormData.tipo}
                      onChange={(e) => setMovimentacaoFormData({ ...movimentacaoFormData, tipo: e.target.value })}
                      required
                    >
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Valor *</label>
                    <input
                      type="number"
                      className="form-input"
                      step="0.01"
                      min="0.01"
                      value={movimentacaoFormData.valor}
                      onChange={(e) => setMovimentacaoFormData({ ...movimentacaoFormData, valor: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Categoria *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={movimentacaoFormData.categoria}
                    onChange={(e) => setMovimentacaoFormData({ ...movimentacaoFormData, categoria: e.target.value })}
                    placeholder="Ex: Venda de lanche, Troco, Despesa..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Descrição</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={movimentacaoFormData.descricao}
                    onChange={(e) => setMovimentacaoFormData({ ...movimentacaoFormData, descricao: e.target.value })}
                    placeholder="Detalhes adicionais (opcional)"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMovimentacaoModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={20} />
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaixaManager;
