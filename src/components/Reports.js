import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Download, TrendingUp, Calendar, CheckCircle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Reports.css';

function Reports() {
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    confirmados: 0,
    cancelados: 0,
    porServico: {},
    ultimos7Dias: 0
  });
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [availableServices, setAvailableServices] = useState([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, serviceFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      let query = supabase.from('agendamentos').select('*');

      // Filtro por data
      if (dateFilter === '7days') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        query = query.gte('data_solicitacao', date.toISOString());
      } else if (dateFilter === '30days') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        query = query.gte('data_solicitacao', date.toISOString());
      }

      // Filtro por serviço
      if (serviceFilter !== 'all') {
        query = query.eq('primeira_opcao', serviceFilter);
      }

      const { data, error } = await query.order('data_solicitacao', { ascending: false });

      if (error) throw error;

      const agendamentosData = data || [];
      setAgendamentos(agendamentosData);

      // Extrair serviços únicos de todos os agendamentos (sem filtro)
      const { data: allData } = await supabase.from('agendamentos').select('primeira_opcao');
      const services = [...new Set(allData?.map(a => a.primeira_opcao).filter(Boolean))];
      setAvailableServices(services.sort());

      // Calcular estatísticas
      const porServico = {};
      agendamentosData.forEach(ag => {
        porServico[ag.primeira_opcao] = (porServico[ag.primeira_opcao] || 0) + 1;
      });

      const date7DaysAgo = new Date();
      date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);

      setStats({
        total: agendamentosData.length,
        pendentes: agendamentosData.filter(a => a.status === 'Pendente de confirmação').length,
        confirmados: agendamentosData.filter(a => a.status === 'Confirmado').length,
        cancelados: agendamentosData.filter(a => a.status === 'Cancelado').length,
        porServico,
        ultimos7Dias: agendamentosData.filter(a =>
          new Date(a.data_solicitacao) >= date7DaysAgo
        ).length
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Relatório de Agendamentos - CESCA', 14, 22);

    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    doc.autoTable({
      startY: 40,
      head: [['Estatística', 'Valor']],
      body: [
        ['Total de Agendamentos', stats.total],
        ['Pendentes', stats.pendentes],
        ['Confirmados', stats.confirmados],
        ['Cancelados', stats.cancelados],
        ['Últimos 7 Dias', stats.ultimos7Dias]
      ]
    });

    const serviceData = Object.entries(stats.porServico).map(([service, count]) => [service, count]);
    if (serviceData.length > 0) {
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Serviço', 'Quantidade']],
        body: serviceData
      });
    }

    // Adicionar tabela completa de agendamentos
    if (agendamentos.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Lista Completa de Agendamentos', 14, 20);

      const agendamentosData = agendamentos.map(ag => [
        new Date(ag.data_solicitacao).toLocaleDateString('pt-BR'),
        ag.nome_completo,
        ag.email,
        ag.telefone,
        ag.primeira_opcao,
        ag.segunda_opcao || '-',
        ag.status,
        ag.atendente || '-',
        ag.canal_preferencial,
        ag.observacoes || '-'
      ]);

      doc.autoTable({
        startY: 30,
        head: [['Data', 'Nome', 'Email', 'Telefone', '1ª Opção', '2ª Opção', 'Status', 'Atendente', 'Canal', 'Observações']],
        body: agendamentosData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [102, 126, 234] }
      });
    }

    doc.save(`relatorio_agendamentos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportExcel = () => {
    const dataToExport = agendamentos.map(ag => ({
      'Data': new Date(ag.data_solicitacao).toLocaleString('pt-BR'),
      'Nome': ag.nome_completo,
      'Email': ag.email,
      'Telefone': ag.telefone,
      'Primeira Opção': ag.primeira_opcao,
      'Segunda Opção': ag.segunda_opcao || '-',
      'Status': ag.status,
      'Atendente': ag.atendente || '-',
      'Canal': ag.canal_preferencial
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `relatorio_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div className="reports">
      <div className="reports-header">
        <h2>Relatórios e Estatísticas</h2>
        <div className="export-buttons">
          <button className="btn-secondary" onClick={exportPDF}>
            <Download size={18} />
            PDF
          </button>
          <button className="btn-primary" onClick={exportExcel}>
            <Download size={18} />
            Excel
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="all">Todos os períodos</option>
          <option value="7days">Últimos 7 dias</option>
          <option value="30days">Últimos 30 dias</option>
        </select>

        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="all">Todos os atendimentos</option>
          {availableServices.map(service => (
            <option key={service} value={service}>{service}</option>
          ))}
        </select>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Calendar className="text-blue-600" />
          </div>
          <div className="stat-content">
            <h3>{stats.total}</h3>
            <p>Total de Agendamentos</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp className="text-orange-600" />
          </div>
          <div className="stat-content">
            <h3>{stats.pendentes}</h3>
            <p>Pendentes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle className="text-green-600" />
          </div>
          <div className="stat-content">
            <h3>{stats.confirmados}</h3>
            <p>Confirmados</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <XCircle className="text-red-600" />
          </div>
          <div className="stat-content">
            <h3>{stats.cancelados}</h3>
            <p>Cancelados</p>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <h3>Agendamentos por Serviço</h3>
        <div className="service-stats">
          {Object.entries(stats.porServico)
            .sort((a, b) => b[1] - a[1])
            .map(([service, count]) => (
              <div key={service} className="service-bar">
                <div className="service-label">{service}</div>
                <div className="service-bar-container">
                  <div
                    className="service-bar-fill"
                    style={{
                      width: `${(count / stats.total) * 100}%`
                    }}
                  />
                </div>
                <div className="service-count">{count}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="results-section">
        <div className="results-header">
          <h3>Lista Completa de Agendamentos</h3>
          <span className="stat-detail">{agendamentos.length} registro(s)</span>
        </div>
        <div className="results-table-container">
          {agendamentos.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <table className="results-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Atendimento</th>
                  <th>Status</th>
                  <th>Atendente</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {agendamentos.map((ag) => (
                  <tr key={ag.id}>
                    <td>{new Date(ag.data_solicitacao).toLocaleString('pt-BR')}</td>
                    <td>
                      <strong>{ag.nome_completo}</strong>
                    </td>
                    <td>
                      <div>{ag.email}</div>
                      <div>{ag.telefone}</div>
                      <small>{ag.canal_preferencial}</small>
                    </td>
                    <td>
                      <div><strong>1ª:</strong> {ag.primeira_opcao}</div>
                      {ag.segunda_opcao && <div><strong>2ª:</strong> {ag.segunda_opcao}</div>}
                    </td>
                    <td>
                      <span className={`status-badge ${ag.status.toLowerCase().replace(/ /g, '-')}`}>
                        {ag.status}
                      </span>
                      {ag.data_confirmacao && (
                        <div>
                          <small>
                            {new Date(ag.data_confirmacao).toLocaleDateString('pt-BR')}
                          </small>
                        </div>
                      )}
                    </td>
                    <td>{ag.atendente || '-'}</td>
                    <td>{ag.observacoes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
