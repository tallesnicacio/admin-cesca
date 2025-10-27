import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Download, TrendingUp, Users, Award, BarChart2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import './PresencaReports.css';

function PresencaReports() {
  const [loading, setLoading] = useState(true);
  const [estatisticas, setEstatisticas] = useState([]);
  const [giras, setGiras] = useState([]);
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [detalhes, setDetalhes] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  useEffect(() => {
    loadData();
  }, [filtroDataInicio, filtroDataFim]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadEstatisticas(),
        loadGiras()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadEstatisticas = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_presenca_trabalhadores')
        .select('*');

      if (error) throw error;
      setEstatisticas(data || []);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      showToast.error('Erro ao carregar estatísticas');
    }
  };

  const loadGiras = async () => {
    try {
      let query = supabase
        .from('vw_presenca_giras')
        .select('*');

      if (filtroDataInicio) {
        query = query.gte('data', filtroDataInicio);
      }
      if (filtroDataFim) {
        query = query.lte('data', filtroDataFim);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGiras(data || []);
    } catch (error) {
      console.error('Erro ao carregar giras:', error);
      showToast.error('Erro ao carregar giras');
    }
  };

  const loadDetalhes = async (trabalhadorId) => {
    try {
      // Buscar informações do trabalhador
      const { data: trabalhador, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('id', trabalhadorId)
        .single();

      if (trabError) throw trabError;

      // Buscar todas as presenças do trabalhador
      let query = supabase
        .from('presencas')
        .select(`
          *,
          giras:gira_id (
            data,
            dia_semana,
            status
          )
        `)
        .eq('trabalhador_id', trabalhadorId)
        .order('created_at', { ascending: false });

      if (filtroDataInicio) {
        query = query.gte('giras.data', filtroDataInicio);
      }
      if (filtroDataFim) {
        query = query.lte('giras.data', filtroDataFim);
      }

      const { data: presencas, error: presError } = await query;

      if (presError) throw presError;

      setDetalhes({
        trabalhador,
        presencas: presencas || []
      });
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      showToast.error('Erro ao carregar detalhes');
    }
  };

  const handleVerDetalhes = (trabalhador) => {
    setSelectedTrabalhador(trabalhador);
    loadDetalhes(trabalhador.trabalhador_id || trabalhador.id);
  };

  const handleFecharDetalhes = () => {
    setSelectedTrabalhador(null);
    setDetalhes(null);
  };

  const exportarExcel = () => {
    const dataToExport = estatisticas.map(e => ({
      'Nome': e.nome_completo,
      'Telefone': e.telefone || '-',
      'Email': e.email || '-',
      'Status': e.status,
      'Total de Giras': e.total_giras,
      'Presenças': e.total_presencas,
      'Ausências': e.total_ausencias,
      '% Presença': e.percentual_presenca + '%'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estatísticas');

    // Segunda aba com giras
    const girasToExport = giras.map(g => ({
      'Data': new Date(g.data).toLocaleDateString('pt-BR'),
      'Dia': g.dia_semana,
      'Status': g.status,
      'Presentes': g.total_presentes,
      'Ausentes': g.total_ausentes,
      'Total': g.total_registros
    }));

    const ws2 = XLSX.utils.json_to_sheet(girasToExport);
    XLSX.utils.book_append_sheet(wb, ws2, 'Giras');

    XLSX.writeFile(wb, `relatorio_presenca_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast.success('Relatório exportado com sucesso!');
  };

  if (loading) {
    return <div className="loading">Carregando relatórios...</div>;
  }

  const totalTrabalhadores = estatisticas.length;
  const totalGiras = giras.length;
  const mediaPresenca = estatisticas.length > 0
    ? (estatisticas.reduce((acc, e) => acc + parseFloat(e.percentual_presenca), 0) / estatisticas.length).toFixed(2)
    : 0;

  return (
    <div className="presenca-reports">
      <Toaster position="top-right" />

      <div className="reports-header">
        <h2>Relatórios de Presença</h2>
        <div className="reports-actions">
          <button className="btn-primary" onClick={exportarExcel}>
            <Download size={18} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="reports-filters">
        <div className="filter-group">
          <label>
            <Calendar size={16} />
            Data Início
          </label>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>
            <Calendar size={16} />
            Data Fim
          </label>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
          />
        </div>
        {(filtroDataInicio || filtroDataFim) && (
          <button
            className="btn-secondary"
            onClick={() => {
              setFiltroDataInicio('');
              setFiltroDataFim('');
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Cards de Estatísticas Gerais */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{totalTrabalhadores}</h3>
            <p>Trabalhadores</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <h3>{totalGiras}</h3>
            <p>Giras Realizadas</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{mediaPresenca}%</h3>
            <p>Média de Presença</p>
          </div>
        </div>
      </div>

      {/* Ranking de Presença */}
      <div className="reports-section">
        <div className="section-header">
          <h3>
            <BarChart2 size={20} />
            Ranking de Presença
          </h3>
        </div>

        <div className="ranking-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nº</th>
                <th>Nome</th>
                <th>Grupo</th>
                <th>Função</th>
                <th className="center">Presentes (AP)</th>
                <th className="center">Justificadas (J)</th>
                <th className="center">Faltas (F)</th>
                <th className="center">Ausências (A)</th>
                <th className="center">% Presença</th>
                <th className="center">Advertências</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {estatisticas.map((trab, index) => (
                <tr key={trab.trabalhador_id} className={parseFloat(trab.percentual_presenca) >= 80 ? 'destaque' : ''}>
                  <td>
                    <div className="ranking-position">
                      {index + 1}
                      {index === 0 && <span className="medal gold">🥇</span>}
                      {index === 1 && <span className="medal silver">🥈</span>}
                      {index === 2 && <span className="medal bronze">🥉</span>}
                    </div>
                  </td>
                  <td><strong>{trab.numero || '-'}</strong></td>
                  <td>
                    <strong>{trab.nome_completo}</strong>
                    <span className={`status-badge ${trab.status}`}>
                      {trab.status === 'ativo' ? 'Ativo' : trab.status === 'afastado' ? 'Afastado' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: trab.grupo === 'Direção' ? '#667eea' : '#10b981',
                      color: '#fff'
                    }}>
                      {trab.grupo || '-'}
                    </span>
                  </td>
                  <td>{trab.funcao_permanente || '-'}</td>
                  <td className="center">
                    <span className="badge success">{trab.presencas || 0}</span>
                  </td>
                  <td className="center">
                    <span className="badge warning">{trab.justificadas || 0}</span>
                  </td>
                  <td className="center">
                    <span className="badge danger">{trab.faltas || 0}</span>
                  </td>
                  <td className="center">
                    <span className="badge secondary">{trab.ausencias_afastamento || 0}</span>
                  </td>
                  <td className="center">
                    <div className="progress-cell">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${trab.percentual_presenca}%`,
                            background: parseFloat(trab.percentual_presenca) >= 80
                              ? 'linear-gradient(90deg, #10b981, #059669)'
                              : parseFloat(trab.percentual_presenca) >= 50
                              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                              : 'linear-gradient(90deg, #ef4444, #dc2626)'
                          }}
                        ></div>
                      </div>
                      <span className="progress-label">{trab.percentual_presenca}%</span>
                    </div>
                  </td>
                  <td className="center">
                    {trab.total_advertencias > 0 ? (
                      <span className="badge danger" title={`${trab.total_advertencias} advertência(s)`}>
                        {trab.total_advertencias}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-link"
                      onClick={() => handleVerDetalhes(trab)}
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {estatisticas.length === 0 && (
            <div className="empty-state">
              <p>Nenhum dado disponível no período selecionado</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedTrabalhador && detalhes && (
        <div className="modal-overlay" onClick={handleFecharDetalhes}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes - {detalhes.trabalhador.nome_completo}</h3>
              <button className="btn-icon" onClick={handleFecharDetalhes}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detalhes-info">
                <div className="info-item">
                  <strong>Telefone:</strong> {detalhes.trabalhador.telefone || '-'}
                </div>
                <div className="info-item">
                  <strong>Email:</strong> {detalhes.trabalhador.email || '-'}
                </div>
                <div className="info-item">
                  <strong>Status:</strong>
                  <span className={`status-badge ${detalhes.trabalhador.status}`}>
                    {detalhes.trabalhador.status}
                  </span>
                </div>
              </div>

              <h4>Histórico de Presenças</h4>

              {detalhes.presencas.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum registro de presença</p>
                </div>
              ) : (
                <div className="presencas-list">
                  {detalhes.presencas.map(p => (
                    <div key={p.id} className={`presenca-detail-item ${p.presente ? 'presente' : 'ausente'}`}>
                      <div className="presenca-date">
                        <strong>
                          {new Date(p.giras.data).toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </strong>
                        <span className={`badge ${p.presente ? 'success' : 'danger'}`}>
                          {p.presente ? '✓ Presente' : '✗ Ausente'}
                        </span>
                      </div>
                      {!p.presente && p.justificativa_ausencia && (
                        <div className="presenca-justificativa">
                          Justificativa: <em>{p.justificativa_ausencia}</em>
                        </div>
                      )}
                      {p.observacoes && (
                        <div className="presenca-obs">
                          Obs: {p.observacoes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PresencaReports;
