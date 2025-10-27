import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Plus, Save, Printer, ChevronLeft, ChevronRight, Users, CheckCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import { ConfirmModal } from './Modal';
import './PresencaManager.css';

function PresencaManager({ userProfile }) {
  const [view, setView] = useState('list'); // 'list' ou 'registro'
  const [giras, setGiras] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [selectedGira, setSelectedGira] = useState(null);
  const [presencas, setPresencas] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showNovaGiraModal, setShowNovaGiraModal] = useState(false);
  const [novaGiraData, setNovaGiraData] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadGiras(),
        loadTrabalhadores()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadGiras = async () => {
    try {
      const { data, error } = await supabase
        .from('giras')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;
      setGiras(data || []);
    } catch (error) {
      console.error('Erro ao carregar giras:', error);
      showToast.error('Erro ao carregar giras');
    }
  };

  const loadTrabalhadores = async () => {
    try {
      const { data, error } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (error) throw error;
      setTrabalhadores(data || []);
    } catch (error) {
      console.error('Erro ao carregar trabalhadores:', error);
      showToast.error('Erro ao carregar trabalhadores');
    }
  };

  const loadPresencas = async (giraId) => {
    try {
      const { data, error } = await supabase
        .from('presencas')
        .select('*')
        .eq('gira_id', giraId);

      if (error) throw error;

      // Converter array para objeto indexado por trabalhador_id
      const presencasMap = {};
      (data || []).forEach(p => {
        presencasMap[p.trabalhador_id] = p;
      });

      setPresencas(presencasMap);
    } catch (error) {
      console.error('Erro ao carregar presenças:', error);
      showToast.error('Erro ao carregar presenças');
    }
  };

  const getDiaSemana = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const dia = date.getDay();
    return dia === 1 ? 'Segunda' : dia === 5 ? 'Sexta' : null;
  };

  const handleNovaGira = async () => {
    if (!novaGiraData) {
      showToast.error('Selecione uma data');
      return;
    }

    const diaSemana = getDiaSemana(novaGiraData);

    if (!diaSemana) {
      showToast.error('A data deve ser uma Segunda ou Sexta-feira');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('giras')
        .insert([{
          data: novaGiraData,
          dia_semana: diaSemana,
          horario_inicio: '19:30',
          horario_fim: '23:00',
          status: 'planejada',
          criado_por: userProfile?.id
        }])
        .select()
        .single();

      if (error) throw error;

      showToast.success('Gira criada com sucesso!');
      setShowNovaGiraModal(false);
      setNovaGiraData('');
      loadGiras();

      // Abrir automaticamente para registrar presença
      handleRegistrarPresenca(data);
    } catch (error) {
      console.error('Erro ao criar gira:', error);
      if (error.code === '23505') {
        showToast.error('Já existe uma gira cadastrada para esta data');
      } else {
        showToast.error('Erro ao criar gira: ' + error.message);
      }
    }
  };

  const handleRegistrarPresenca = async (gira) => {
    setSelectedGira(gira);
    await loadPresencas(gira.id);
    setView('registro');
  };

  const handleChangeStatusPresenca = (trabalhadorId, status) => {
    setPresencas(prev => {
      const atual = prev[trabalhadorId] || {};
      return {
        ...prev,
        [trabalhadorId]: {
          ...atual,
          status_presenca: status,
          presente: status === 'P',
          justificativa_ausencia: ['J', 'F', 'A'].includes(status) ? atual.justificativa_ausencia : null
        }
      };
    });
  };

  const handleChangeJustificativa = (trabalhadorId, justificativa) => {
    setPresencas(prev => ({
      ...prev,
      [trabalhadorId]: {
        ...prev[trabalhadorId],
        justificativa_ausencia: justificativa
      }
    }));
  };

  const handleSalvarPresencas = async () => {
    try {
      setSaving(true);

      // Preparar dados para inserção/atualização
      const presencasParaSalvar = trabalhadores.map(t => {
        const presenca = presencas[t.id] || { status_presenca: 'F', presente: false };
        const status = presenca.status_presenca || (presenca.presente ? 'P' : 'F');

        return {
          gira_id: selectedGira.id,
          trabalhador_id: t.id,
          presente: status === 'P',
          status_presenca: status,
          justificativa_ausencia: ['J', 'F', 'A'].includes(status) ? presenca.justificativa_ausencia : null,
          registrado_por: userProfile?.id
        };
      });

      // Deletar presenças existentes
      const { error: deleteError } = await supabase
        .from('presencas')
        .delete()
        .eq('gira_id', selectedGira.id);

      if (deleteError) throw deleteError;

      // Inserir novas presenças
      const { error: insertError } = await supabase
        .from('presencas')
        .insert(presencasParaSalvar);

      if (insertError) throw insertError;

      // Atualizar status da gira para 'realizada'
      const { error: updateError } = await supabase
        .from('giras')
        .update({ status: 'realizada' })
        .eq('id', selectedGira.id);

      if (updateError) throw updateError;

      showToast.success('Presenças salvas com sucesso!');
      loadGiras();
      setView('list');
    } catch (error) {
      console.error('Erro ao salvar presenças:', error);
      showToast.error('Erro ao salvar presenças: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImprimirLista = () => {
    const presentes = trabalhadores.filter(t => presencas[t.id]?.presente);
    const ausentes = trabalhadores.filter(t => !presencas[t.id]?.presente);

    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Presença - ${new Date(selectedGira.data).toLocaleDateString('pt-BR')}</title>
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
          .info {
            text-align: center;
            margin-bottom: 30px;
            color: #666;
          }
          h2 {
            color: #333;
            background: #f0f0f0;
            padding: 10px;
            margin-top: 30px;
            border-left: 4px solid #667eea;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
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
          .ausentes {
            margin-top: 40px;
          }
          .count {
            font-size: 0.9em;
            color: #666;
          }
        </style>
      </head>
      <body>
        <h1>🌟 Centro Espírita Santa Clara de Assis 🌟</h1>
        <div class="info">
          <strong>Lista de Presença - ${selectedGira.dia_semana}-feira</strong><br>
          ${new Date(selectedGira.data).toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}<br>
          ${selectedGira.horario_inicio} às ${selectedGira.horario_fim}
        </div>

        <h2>✓ PRESENTES <span class="count">(${presentes.length} trabalhador${presentes.length !== 1 ? 'es' : ''})</span></h2>
        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 60%">Nome</th>
              <th style="width: 35%">Telefone</th>
            </tr>
          </thead>
          <tbody>
            ${presentes.map((t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${t.nome_completo}</strong></td>
                <td>${t.telefone || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${ausentes.length > 0 ? `
          <div class="ausentes">
            <h2>✗ AUSENTES <span class="count">(${ausentes.length} trabalhador${ausentes.length !== 1 ? 'es' : ''})</span></h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%">#</th>
                  <th style="width: 40%">Nome</th>
                  <th style="width: 25%">Telefone</th>
                  <th style="width: 30%">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                ${ausentes.map((t, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${t.nome_completo}</strong></td>
                    <td>${t.telefone || '-'}</td>
                    <td>${presencas[t.id]?.justificativa_ausencia || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666;">
          <strong>Total de trabalhadores: ${trabalhadores.length}</strong> |
          Presentes: ${presentes.length} |
          Ausentes: ${ausentes.length}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  // VIEW: Lista de Giras
  if (view === 'list') {
    const girasDoMes = giras.filter(g => {
      const giraDate = new Date(g.data);
      return giraDate.getMonth() === currentMonth.getMonth() &&
             giraDate.getFullYear() === currentMonth.getFullYear();
    });

    return (
      <div className="presenca-manager">
        <Toaster position="top-right" />

        <div className="manager-header">
          <h2>Controle de Presença</h2>
          <button className="btn-primary" onClick={() => setShowNovaGiraModal(true)}>
            <Plus size={20} />
            Nova Gira
          </button>
        </div>

        <div className="month-navigator">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
            <ChevronLeft size={20} />
          </button>
          <h3>
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="giras-list">
          {girasDoMes.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>Nenhuma gira cadastrada neste mês</p>
              <button className="btn-secondary" onClick={() => setShowNovaGiraModal(true)}>
                <Plus size={18} />
                Criar primeira gira
              </button>
            </div>
          ) : (
            girasDoMes.map(gira => (
              <div key={gira.id} className={`gira-card ${gira.status}`}>
                <div className="gira-card-header">
                  <div className="gira-info">
                    <h3>{new Date(gira.data).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long'
                    })}</h3>
                    <p>{gira.horario_inicio} às {gira.horario_fim}</p>
                  </div>
                  <span className={`status-badge ${gira.status}`}>
                    {gira.status === 'planejada' ? 'Planejada' :
                     gira.status === 'realizada' ? 'Realizada' : 'Cancelada'}
                  </span>
                </div>
                <div className="gira-card-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleRegistrarPresenca(gira)}
                  >
                    <Users size={18} />
                    {gira.status === 'realizada' ? 'Ver Presença' : 'Registrar Presença'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Nova Gira */}
        {showNovaGiraModal && (
          <div className="modal-overlay" onClick={() => setShowNovaGiraModal(false)}>
            <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Plus size={20} /> Nova Gira</h3>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Data da Gira *</label>
                  <input
                    type="date"
                    value={novaGiraData}
                    onChange={(e) => setNovaGiraData(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <small>Selecione uma Segunda ou Sexta-feira</small>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowNovaGiraModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleNovaGira}>
                  Criar Gira
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW: Registro de Presença
  return (
    <div className="presenca-manager">
      <Toaster position="top-right" />

      <div className="registro-header">
        <button className="btn-back" onClick={() => setView('list')}>
          <ChevronLeft size={20} />
          Voltar
        </button>
        <div className="registro-info">
          <h2>{new Date(selectedGira.data).toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}</h2>
          <p>{selectedGira.horario_inicio} às {selectedGira.horario_fim}</p>
        </div>
        <div className="registro-actions">
          <button className="btn-secondary" onClick={handleImprimirLista}>
            <Printer size={18} />
            Imprimir
          </button>
          <button
            className="btn-primary"
            onClick={handleSalvarPresencas}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="presenca-list">
        {trabalhadores.map(trabalhador => {
          const presenca = presencas[trabalhador.id] || { status_presenca: 'F', presente: false };
          const status = presenca.status_presenca || (presenca.presente ? 'P' : 'F');
          const isPresente = status === 'P';

          return (
            <div key={trabalhador.id} className={`presenca-item ${isPresente ? 'presente' : 'ausente'} status-${status}`}>
              <div className="presenca-status">
                <select
                  value={status}
                  onChange={(e) => handleChangeStatusPresenca(trabalhador.id, e.target.value)}
                  className={`status-select status-${status}`}
                >
                  <option value="P">✓ Presente</option>
                  <option value="F">✗ Falta</option>
                  <option value="J">⚠ Justificada</option>
                  <option value="A">⊗ Afastado</option>
                </select>
              </div>

              <div className="presenca-info">
                <strong>
                  {trabalhador.numero && <span className="trabalhador-numero">#{trabalhador.numero}</span>}
                  {trabalhador.nome_completo}
                </strong>
                <span>
                  {trabalhador.funcao_permanente && <span className="funcao-permanente">{trabalhador.funcao_permanente}</span>}
                  {trabalhador.telefone && <span>{trabalhador.telefone}</span>}
                </span>
              </div>

              {!isPresente && (
                <div className="presenca-justificativa">
                  <input
                    type="text"
                    placeholder="Justificativa (opcional)"
                    value={presenca.justificativa_ausencia || ''}
                    onChange={(e) => handleChangeJustificativa(trabalhador.id, e.target.value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="presenca-summary">
        <div className="summary-item">
          <span className="summary-label">Total</span>
          <span className="summary-value">{trabalhadores.length}</span>
        </div>
        <div className="summary-item presente">
          <span className="summary-label">Presente</span>
          <span className="summary-value">
            {trabalhadores.filter(t => {
              const status = presencas[t.id]?.status_presenca || (presencas[t.id]?.presente ? 'P' : 'F');
              return status === 'P';
            }).length}
          </span>
        </div>
        <div className="summary-item justificado">
          <span className="summary-label">Justificada</span>
          <span className="summary-value">
            {trabalhadores.filter(t => presencas[t.id]?.status_presenca === 'J').length}
          </span>
        </div>
        <div className="summary-item faltou">
          <span className="summary-label">Falta</span>
          <span className="summary-value">
            {trabalhadores.filter(t => presencas[t.id]?.status_presenca === 'F').length}
          </span>
        </div>
        <div className="summary-item ausente">
          <span className="summary-label">Afastado</span>
          <span className="summary-value">
            {trabalhadores.filter(t => presencas[t.id]?.status_presenca === 'A').length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PresencaManager;
