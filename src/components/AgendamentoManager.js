import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Check, X, Trash2, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import { ConfirmModal, SelectModal } from './Modal';
import './AgendamentoManager.css';

function AgendamentoManager({ userProfile }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [filteredAgendamentos, setFilteredAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Estados dos modais
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, agendamento: null });
  const [selectOpcaoModal, setSelectOpcaoModal] = useState({ isOpen: false, agendamento: null });
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadAgendamentos();
  }, []);

  useEffect(() => {
    filterAgendamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, agendamentos]);

  const loadAgendamentos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_solicitacao', { ascending: false });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      showToast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const filterAgendamentos = () => {
    let filtered = [...agendamentos];

    if (searchTerm) {
      filtered = filtered.filter(ag =>
        ag.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ag.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ag.telefone?.includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(ag => ag.status === filterStatus);
    }

    setFilteredAgendamentos(filtered);
  };

  const handleConfirmarAgendamento = async (agendamento) => {
    const nomeAtendente = userProfile?.name || 'Admin';

    // Se não houver segunda opção, usa a primeira automaticamente
    if (!agendamento.segunda_opcao) {
      setModalLoading(true);
      try {
        await handleUpdateStatus(agendamento.id, 'Confirmado', nomeAtendente, 'primeira');
      } finally {
        setModalLoading(false);
      }
      return;
    }

    // Se houver segunda opção, perguntar qual foi escolhida
    setSelectOpcaoModal({ isOpen: true, agendamento });
  };

  // Handler para quando a opção é selecionada
  const handleOpcaoSelecionada = async (opcao) => {
    const agendamento = selectOpcaoModal.agendamento;
    const nomeAtendente = userProfile?.name || 'Admin';

    setSelectOpcaoModal({ isOpen: false, agendamento: null });
    setModalLoading(true);

    try {
      await handleUpdateStatus(agendamento.id, 'Confirmado', nomeAtendente, opcao);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, atendente = null, opcaoEscolhida = null) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'Confirmado') {
        updateData.data_confirmacao = new Date().toISOString();
        if (atendente) updateData.atendente = atendente;
        if (opcaoEscolhida) updateData.opcao_escolhida = opcaoEscolhida;
      }

      const { error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      showToast.success('Status atualizado com sucesso!');
      loadAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showToast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDelete = (id) => {
    setDeleteModal({ isOpen: true, id });
  };

  const handleDeleteConfirm = async () => {
    setModalLoading(true);
    const id = deleteModal.id;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast.success('Agendamento excluído com sucesso!');
      loadAgendamentos();
      setDeleteModal({ isOpen: false, id: null });
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showToast.error('Erro ao excluir: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCancelarAgendamento = (id) => {
    setConfirmModal({ isOpen: true, agendamento: { id } });
  };

  const handleCancelarConfirm = async () => {
    setModalLoading(true);
    const id = confirmModal.agendamento.id;

    try {
      await handleUpdateStatus(id, 'Cancelado');
      setConfirmModal({ isOpen: false, agendamento: null });
    } catch (error) {
      // Erro já tratado no handleUpdateStatus
    } finally {
      setModalLoading(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredAgendamentos.map(ag => ({
      'Data Solicitação': new Date(ag.data_solicitacao).toLocaleString('pt-BR'),
      'Nome': ag.nome_completo,
      'Email': ag.email,
      'Telefone': ag.telefone,
      'Primeira Opção': ag.primeira_opcao,
      'Segunda Opção': ag.segunda_opcao || '-',
      'Opção Escolhida': ag.opcao_escolhida === 'primeira' ? '1ª Opção' : ag.opcao_escolhida === 'segunda' ? '2ª Opção' : '-',
      'Canal': ag.canal_preferencial,
      'Status': ag.status,
      'Atendente': ag.atendente || '-',
      'Observações': ag.observacoes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `agendamentos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const printCallList = () => {
    // Filtrar apenas confirmados
    const confirmados = agendamentos.filter(a => a.status === 'Confirmado');

    // Agrupar por tipo de atendimento (baseado na opção escolhida)
    const porTipo = {};
    confirmados.forEach(ag => {
      // Usar a opção escolhida se disponível, senão usa a primeira opção
      const tipo = ag.opcao_escolhida === 'segunda' ? ag.segunda_opcao : ag.primeira_opcao;
      if (!porTipo[tipo]) {
        porTipo[tipo] = [];
      }
      porTipo[tipo].push(ag);
    });

    // Gerar HTML para impressão
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Chamada - CESCA</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            text-align: center;
            color: #667eea;
            margin-bottom: 10px;
          }
          h2 {
            color: #333;
            background: #f0f0f0;
            padding: 10px;
            margin-top: 30px;
            border-left: 4px solid #667eea;
          }
          .date {
            text-align: center;
            margin-bottom: 30px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #667eea;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .count {
            font-size: 0.9em;
            color: #666;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
          }
        </style>
      </head>
      <body>
        <h1>🌟 Centro Espírita Santa Clara de Assis 🌟</h1>
        <div class="date">Lista de Chamada - ${new Date().toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</div>

        ${Object.keys(porTipo).sort().map(tipo => `
          <h2>${tipo} <span class="count">(${porTipo[tipo].length} pessoa${porTipo[tipo].length !== 1 ? 's' : ''})</span></h2>
          <table>
            <thead>
              <tr>
                <th style="width: 5%">#</th>
                <th style="width: 40%">Nome</th>
                <th style="width: 25%">Telefone</th>
                <th style="width: 30%">Observações</th>
              </tr>
            </thead>
            <tbody>
              ${porTipo[tipo].map((ag, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${ag.nome_completo}</strong></td>
                  <td>${ag.telefone}</td>
                  <td>${ag.observacoes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}

        <div class="footer">
          Total de agendamentos confirmados: <strong>${confirmados.length}</strong>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Aguardar carregamento e imprimir
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div className="quiz-manager">
      <Toaster position="top-right" />
      <div className="manager-header">
        <h2>Gerenciar Agendamentos</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={printCallList}>
            <Printer size={20} />
            Lista de Chamada
          </button>
          <button className="btn-primary" onClick={exportToExcel}>
            <Download size={20} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Todos os Status</option>
          <option value="Pendente de confirmação">Pendentes</option>
          <option value="Confirmado">Confirmados</option>
          <option value="Cancelado">Cancelados</option>
        </select>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{agendamentos.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {agendamentos.filter(a => a.status === 'Pendente de confirmação').length}
          </span>
          <span className="stat-label">Pendentes</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {agendamentos.filter(a => a.status === 'Confirmado').length}
          </span>
          <span className="stat-label">Confirmados</span>
        </div>
      </div>

      <div className="agendamentos-table">
        {filteredAgendamentos.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum agendamento encontrado</p>
          </div>
        ) : (
          <>
            {/* Cards para mobile */}
            {filteredAgendamentos.map((ag) => (
              <div key={`card-${ag.id}`} className="agendamento-card">
                <div className="agendamento-card-header">
                  <div className="agendamento-card-title">
                    <h3>{ag.nome_completo}</h3>
                    <p>{new Date(ag.data_solicitacao).toLocaleString('pt-BR')}</p>
                  </div>
                  <span className={`status-badge ${ag.status.toLowerCase().replace(/ /g, '-')}`}>
                    {ag.status}
                  </span>
                </div>

                <div className="agendamento-card-body">
                  <div className="agendamento-card-field">
                    <label>Contato</label>
                    <div className="value">
                      <div>{ag.email}</div>
                      <div>{ag.telefone}</div>
                      <small>{ag.canal_preferencial}</small>
                    </div>
                  </div>

                  <div className="agendamento-card-field">
                    <label>Opções de Atendimento</label>
                    <div className="value">
                      <div>
                        <strong>1ª:</strong> {ag.primeira_opcao}
                        {ag.opcao_escolhida === 'primeira' && <span style={{color: '#10b981', marginLeft: '4px'}}>✓</span>}
                      </div>
                      {ag.segunda_opcao && (
                        <div>
                          <strong>2ª:</strong> {ag.segunda_opcao}
                          {ag.opcao_escolhida === 'segunda' && <span style={{color: '#10b981', marginLeft: '4px'}}>✓</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {ag.atendente && (
                    <div className="agendamento-card-field">
                      <label>Atendente</label>
                      <div className="value">{ag.atendente}</div>
                    </div>
                  )}

                  {ag.observacoes && (
                    <div className="agendamento-card-field">
                      <label>Observações</label>
                      <div className="value">{ag.observacoes}</div>
                    </div>
                  )}
                </div>

                <div className="agendamento-card-actions">
                  {ag.status === 'Pendente de confirmação' && (
                    <button
                      className="btn-primary"
                      onClick={() => handleConfirmarAgendamento(ag)}
                      style={{ flex: 2 }}
                    >
                      <Check size={18} />
                      Confirmar
                    </button>
                  )}
                  {ag.status !== 'Cancelado' && (
                    <button
                      className="btn-secondary"
                      onClick={() => handleCancelarAgendamento(ag.id)}
                    >
                      <X size={18} />
                      Cancelar
                    </button>
                  )}
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(ag.id)}
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
                <th>Data</th>
                <th>Nome</th>
                <th>Contato</th>
                <th>Atendimento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgendamentos.map((ag) => (
                <tr key={ag.id}>
                  <td>{new Date(ag.data_solicitacao).toLocaleString('pt-BR')}</td>
                  <td>
                    <strong>{ag.nome_completo}</strong>
                    {ag.observacoes && <small title={ag.observacoes}>ℹ️</small>}
                  </td>
                  <td>
                    <div>{ag.email}</div>
                    <div>{ag.telefone}</div>
                    <small>{ag.canal_preferencial}</small>
                  </td>
                  <td>
                    <div>
                      <strong>1ª:</strong> {ag.primeira_opcao}
                      {ag.opcao_escolhida === 'primeira' && <span style={{color: '#10b981', marginLeft: '4px'}}>✓</span>}
                    </div>
                    {ag.segunda_opcao && (
                      <div>
                        <strong>2ª:</strong> {ag.segunda_opcao}
                        {ag.opcao_escolhida === 'segunda' && <span style={{color: '#10b981', marginLeft: '4px'}}>✓</span>}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${ag.status.toLowerCase().replace(/ /g, '-')}`}>
                      {ag.status}
                    </span>
                    {ag.atendente && <div><small>Por: {ag.atendente}</small></div>}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {ag.status === 'Pendente de confirmação' && (
                        <button
                          className="btn-icon success"
                          onClick={() => handleConfirmarAgendamento(ag)}
                          title="Confirmar"
                        >
                          <Check size={18} />
                        </button>
                      )}
                      {ag.status !== 'Cancelado' && (
                        <button
                          className="btn-icon warning"
                          onClick={() => handleCancelarAgendamento(ag.id)}
                          title="Cancelar"
                        >
                          <X size={18} />
                        </button>
                      )}
                      <button
                        className="btn-icon danger"
                        onClick={() => handleDelete(ag.id)}
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

      {/* Modais */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Excluir agendamento"
        message="Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        loading={modalLoading}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, agendamento: null })}
        onConfirm={handleCancelarConfirm}
        title="Cancelar agendamento"
        message="Tem certeza que deseja cancelar este agendamento?"
        confirmText="Sim, cancelar"
        cancelText="Não"
        type="warning"
        loading={modalLoading}
      />

      {selectOpcaoModal.agendamento && (
        <SelectModal
          isOpen={selectOpcaoModal.isOpen}
          onClose={() => setSelectOpcaoModal({ isOpen: false, agendamento: null })}
          onSelect={handleOpcaoSelecionada}
          title="Qual opção de atendimento foi aceita?"
          message="Selecione qual das opções de atendimento o assistido aceitou:"
          options={[
            { value: 'primeira', label: selectOpcaoModal.agendamento.primeira_opcao },
            { value: 'segunda', label: selectOpcaoModal.agendamento.segunda_opcao }
          ]}
          confirmText="Continuar"
          cancelText="Cancelar"
          loading={modalLoading}
        />
      )}
    </div>
  );
}

export default AgendamentoManager;
