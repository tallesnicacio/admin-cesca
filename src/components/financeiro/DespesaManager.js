// DespesaManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { showToast } from '../Toast';
import {
  FileText,
  Search,
  X,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Upload,
  Download,
  Eye,
  Calendar,
  DollarSign
} from 'lucide-react';
import './DespesaManager.css';

const DespesaManager = () => {
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [mesFilter, setMesFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState(null);
  const [selectedDespesa, setSelectedDespesa] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    descricao: '',
    categoria: 'outras',
    valor: '',
    data_vencimento: '',
    fornecedor: '',
    observacoes: ''
  });
  const [paymentData, setPaymentData] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'dinheiro'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [stats, setStats] = useState({
    totalAPagar: 0,
    totalPago: 0,
    totalVencido: 0,
    quantidade: 0
  });

  const categorias = [
    { value: 'agua', label: 'Água' },
    { value: 'luz', label: 'Luz/Energia' },
    { value: 'telefone', label: 'Telefone' },
    { value: 'internet', label: 'Internet' },
    { value: 'material_escritorio', label: 'Material de Escritório' },
    { value: 'material_limpeza', label: 'Material de Limpeza' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'aluguel', label: 'Aluguel' },
    { value: 'outras', label: 'Outras' }
  ];

  // Carregar despesas
  const fetchDespesas = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('despesas')
        .select('*')
        .order('data_vencimento', { ascending: false });

      // Filtros
      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      if (categoriaFilter !== 'todas') {
        query = query.eq('categoria', categoriaFilter);
      }

      if (mesFilter && anoFilter) {
        const mes = parseInt(mesFilter);
        const ano = parseInt(anoFilter);
        const dataInicio = new Date(ano, mes - 1, 1);
        const dataFim = new Date(ano, mes, 0);

        query = query
          .gte('data_vencimento', dataInicio.toISOString().split('T')[0])
          .lte('data_vencimento', dataFim.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtro por busca
      let filteredData = data || [];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter(d =>
          d.descricao?.toLowerCase().includes(searchLower) ||
          d.fornecedor?.toLowerCase().includes(searchLower)
        );
      }

      // Atualizar status automático de vencidas
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      filteredData = filteredData.map(d => {
        if (d.status === 'a_pagar') {
          const vencimento = new Date(d.data_vencimento);
          if (vencimento < hoje) {
            return { ...d, status: 'vencido' };
          }
        }
        return d;
      });

      setDespesas(filteredData);
      calculateStats(filteredData);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      showToast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoriaFilter, mesFilter, anoFilter, searchTerm]);

  useEffect(() => {
    fetchDespesas();
  }, [fetchDespesas]);

  // Calcular estatísticas
  const calculateStats = (data) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const stats = data.reduce((acc, d) => {
      acc.quantidade++;
      const vencimento = new Date(d.data_vencimento);

      if (d.status === 'a_pagar') {
        acc.totalAPagar += parseFloat(d.valor || 0);
        if (vencimento < hoje) {
          acc.totalVencido += parseFloat(d.valor || 0);
        }
      } else if (d.status === 'pago') {
        acc.totalPago += parseFloat(d.valor || 0);
      } else if (d.status === 'vencido') {
        acc.totalVencido += parseFloat(d.valor || 0);
      }

      return acc;
    }, {
      totalAPagar: 0,
      totalPago: 0,
      totalVencido: 0,
      quantidade: 0
    });

    setStats(stats);
  };

  // Criar/Editar despesa
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const valor = parseFloat(formData.valor);

      if (isNaN(valor) || valor <= 0) {
        showToast.error('Valor deve ser maior que zero');
        return;
      }

      if (!formData.descricao?.trim()) {
        showToast.error('Descrição é obrigatória');
        return;
      }

      if (!formData.data_vencimento) {
        showToast.error('Data de vencimento é obrigatória');
        return;
      }

      const dataToSave = {
        descricao: formData.descricao.trim(),
        categoria: formData.categoria,
        valor: valor,
        data_vencimento: formData.data_vencimento,
        fornecedor: formData.fornecedor?.trim() || null,
        observacoes: formData.observacoes?.trim() || null,
        status: 'a_pagar'
      };

      let despesaId;

      if (editingDespesa) {
        const { error } = await supabase
          .from('despesas')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', editingDespesa.id);

        if (error) throw error;
        despesaId = editingDespesa.id;
        showToast.success('Despesa atualizada com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('despesas')
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        despesaId = data.id;
        showToast.success('Despesa cadastrada com sucesso!');
      }

      // Upload de comprovante se houver
      if (selectedFile) {
        await uploadComprovante(despesaId, selectedFile);
      }

      setShowModal(false);
      setEditingDespesa(null);
      setFormData({
        descricao: '',
        categoria: 'outras',
        valor: '',
        data_vencimento: '',
        fornecedor: '',
        observacoes: ''
      });
      setSelectedFile(null);
      fetchDespesas();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      showToast.error('Erro ao salvar despesa');
    }
  };

  // Upload de comprovante
  const uploadComprovante = async (despesaId, file) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${despesaId}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('despesas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('despesas')
        .update({
          comprovante_url: filePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', despesaId);

      if (updateError) throw updateError;

      showToast.success('Comprovante enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showToast.error('Erro ao enviar comprovante');
    } finally {
      setUploading(false);
    }
  };

  // Download de comprovante
  const handleDownloadComprovante = async (despesa) => {
    if (!despesa.comprovante_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('despesas')
        .download(despesa.comprovante_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprovante_${despesa.descricao}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast.success('Download iniciado!');
    } catch (error) {
      console.error('Erro ao baixar comprovante:', error);
      showToast.error('Erro ao baixar comprovante');
    }
  };

  // Marcar como pago
  const handleMarkAsPaid = async (e) => {
    e.preventDefault();

    if (!selectedDespesa) return;

    try {
      const { error } = await supabase
        .from('despesas')
        .update({
          status: 'pago',
          data_pagamento: paymentData.data_pagamento,
          forma_pagamento: paymentData.forma_pagamento,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDespesa.id);

      if (error) throw error;

      showToast.success('Despesa marcada como paga!');
      setShowPaymentModal(false);
      setSelectedDespesa(null);
      setPaymentData({
        data_pagamento: new Date().toISOString().split('T')[0],
        forma_pagamento: 'dinheiro'
      });
      fetchDespesas();
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      showToast.error('Erro ao marcar como pago');
    }
  };

  // Deletar despesa
  const handleDelete = async (despesa) => {
    if (!window.confirm(`Deseja realmente excluir a despesa "${despesa.descricao}"?`)) {
      return;
    }

    try {
      // Deletar comprovante se existir
      if (despesa.comprovante_url) {
        await supabase.storage
          .from('despesas')
          .remove([despesa.comprovante_url]);
      }

      const { error } = await supabase
        .from('despesas')
        .delete()
        .eq('id', despesa.id);

      if (error) throw error;

      showToast.success('Despesa excluída com sucesso!');
      fetchDespesas();
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      showToast.error('Erro ao excluir despesa');
    }
  };

  // Abrir modal de edição
  const handleEdit = (despesa) => {
    setEditingDespesa(despesa);
    setFormData({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: despesa.valor.toString(),
      data_vencimento: despesa.data_vencimento,
      fornecedor: despesa.fornecedor || '',
      observacoes: despesa.observacoes || ''
    });
    setShowModal(true);
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

  // Obter label da categoria
  const getCategoriaLabel = (categoria) => {
    const cat = categorias.find(c => c.value === categoria);
    return cat ? cat.label : categoria;
  };

  // Obter badge de status
  const getStatusBadge = (despesa) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(despesa.data_vencimento);

    // Detectar se está vencida
    if (despesa.status === 'a_pagar' && vencimento < hoje) {
      return <span className="status-badge status-vencido">Vencida</span>;
    }

    const statusMap = {
      a_pagar: { label: 'A Pagar', class: 'status-a-pagar' },
      pago: { label: 'Pago', class: 'status-pago' },
      vencido: { label: 'Vencida', class: 'status-vencido' }
    };

    const statusInfo = statusMap[despesa.status] || statusMap.a_pagar;
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  // Obter label do mês
  const getMesLabel = (mes) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || mes;
  };

  return (
    <div className="despesa-manager">
      {/* Header */}
      <div className="manager-header">
        <div className="header-left">
          <FileText size={32} />
          <div>
            <h2>Gestão de Despesas</h2>
            <p className="header-subtitle">
              Controle de contas e comprovantes
            </p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingDespesa(null);
            setFormData({
              descricao: '',
              categoria: 'outras',
              valor: '',
              data_vencimento: '',
              fornecedor: '',
              observacoes: ''
            });
            setSelectedFile(null);
            setShowModal(true);
          }}
        >
          <Plus size={20} />
          Nova Despesa
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por descrição ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
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
          <option value="a_pagar">A Pagar</option>
          <option value="pago">Pago</option>
          <option value="vencido">Vencida</option>
        </select>

        <select
          className="filter-select"
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
        >
          <option value="todas">Todas as Categorias</option>
          {categorias.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
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
      </div>

      {/* Estatísticas */}
      <div className="stats-bar">
        <div className="stat-item stat-a-pagar">
          <AlertCircle size={24} />
          <div className="stat-value">{formatCurrency(stats.totalAPagar)}</div>
          <div className="stat-label">A Pagar</div>
        </div>

        <div className="stat-item stat-pago">
          <CheckCircle size={24} />
          <div className="stat-value">{formatCurrency(stats.totalPago)}</div>
          <div className="stat-label">Pago</div>
        </div>

        <div className="stat-item stat-vencido">
          <Calendar size={24} />
          <div className="stat-value">{formatCurrency(stats.totalVencido)}</div>
          <div className="stat-label">Vencidas</div>
        </div>

        <div className="stat-item">
          <DollarSign size={24} />
          <div className="stat-value">{stats.quantidade}</div>
          <div className="stat-label">Total Despesas</div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Carregando despesas...</p>
        </div>
      ) : despesas.length === 0 ? (
        <div className="empty-state">
          <FileText size={64} />
          <p>Nenhuma despesa encontrada</p>
          <button className="btn-link" onClick={() => setShowModal(true)}>
            Cadastrar primeira despesa
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Fornecedor</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Comprovante</th>
                <th className="actions-column">Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesas.map((despesa) => (
                <tr key={despesa.id}>
                  <td>
                    <strong>{despesa.descricao}</strong>
                    {despesa.observacoes && (
                      <span className="info-secondary">{despesa.observacoes}</span>
                    )}
                  </td>
                  <td>{getCategoriaLabel(despesa.categoria)}</td>
                  <td>{despesa.fornecedor || '-'}</td>
                  <td>
                    <span className="date-info">
                      {formatDate(despesa.data_vencimento)}
                    </span>
                  </td>
                  <td>
                    <span className="valor-highlight">
                      {formatCurrency(despesa.valor)}
                    </span>
                  </td>
                  <td>{getStatusBadge(despesa)}</td>
                  <td>
                    {despesa.comprovante_url ? (
                      <button
                        className="btn-icon-small"
                        onClick={() => handleDownloadComprovante(despesa)}
                        title="Baixar Comprovante"
                      >
                        <Download size={16} />
                      </button>
                    ) : (
                      <span className="info-secondary">-</span>
                    )}
                  </td>
                  <td className="actions-column">
                    <div className="action-buttons">
                      {despesa.status !== 'pago' && (
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setSelectedDespesa(despesa);
                            setShowPaymentModal(true);
                          }}
                          title="Marcar como Pago"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(despesa)}
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => handleDelete(despesa)}
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
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingDespesa ? 'Editar Despesa' : 'Nova Despesa'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Descrição *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Ex: Conta de luz"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Categoria *</label>
                    <select
                      className="form-select"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      required
                    >
                      {categorias.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Valor *</label>
                    <input
                      type="number"
                      className="form-input"
                      step="0.01"
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Data de Vencimento *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fornecedor</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.fornecedor}
                      onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                      placeholder="Nome do fornecedor (opcional)"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Observações</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Informações adicionais (opcional)"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Comprovante (PDF ou Imagem)</label>
                    <div className="file-upload">
                      <input
                        type="file"
                        id="comprovante"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        className="file-input"
                      />
                      <label htmlFor="comprovante" className="file-label">
                        <Upload size={20} />
                        {selectedFile ? selectedFile.name : 'Escolher arquivo'}
                      </label>
                    </div>
                    <span className="form-hint">
                      Formatos aceitos: PDF, JPG, PNG (máx. 5MB)
                    </span>
                  </div>
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
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Enviando...' : (editingDespesa ? 'Atualizar' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedDespesa && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Marcar como Pago</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleMarkAsPaid}>
              <div className="modal-body">
                <div className="info-box">
                  <p>
                    <strong>Despesa:</strong> {selectedDespesa.descricao}<br />
                    <strong>Valor:</strong> {formatCurrency(selectedDespesa.valor)}<br />
                    <strong>Vencimento:</strong> {formatDate(selectedDespesa.data_vencimento)}
                  </p>
                </div>

                <div className="form-row">
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
                      <option value="transferencia">Transferência</option>
                      <option value="debito_automatico">Débito Automático</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                    </select>
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

export default DespesaManager;
