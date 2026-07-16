import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import {
  agruparPorGira,
  getGirasOrdenadas,
  formatarDataGira,
  formatarDataCurta,
  giraJaPassou,
  calcularEstatisticasGira
} from '../utils/giraUtils'
import './ListaConfirmacaoPresenca.css'

function ListaConfirmacaoPresenca({ userProfile }) {
  const [agendamentos, setAgendamentos] = useState([])
  const [giras, setGiras] = useState([])
  const [giraSelecionada, setGiraSelecionada] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' })

  // Carregar agendamentos confirmados
  useEffect(() => {
    carregarAgendamentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Atualizar lista de giras quando agendamentos mudam
  useEffect(() => {
    if (agendamentos.length > 0) {
      const grupos = agruparPorGira(agendamentos)
      const girasOrdenadas = getGirasOrdenadas(grupos)
      setGiras(girasOrdenadas)

      // Se não há gira selecionada, selecionar a mais recente que já passou
      if (!giraSelecionada && girasOrdenadas.length > 0) {
        const giraPassada = girasOrdenadas.find(g => giraJaPassou(g.data))
        if (giraPassada) {
          setGiraSelecionada(giraPassada.chave)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos])

  const carregarAgendamentos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('status', 'Confirmado')
        .order('data_confirmacao', { ascending: false })

      if (error) throw error
      setAgendamentos(data || [])
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error)
      mostrarMensagem('erro', 'Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }

  const handleMarcarPresenca = async (agendamentoId, compareceu) => {
    try {
      setSalvando(true)

      const updateData = {
        compareceu,
        data_registro_presenca: new Date().toISOString(),
        responsavel_registro: userProfile?.name || 'Admin',
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', agendamentoId)
        .select()

      if (error) throw error

      // Atualizar estado local
      setAgendamentos(prev =>
        prev.map(ag => (ag.id === agendamentoId ? { ...ag, ...updateData } : ag))
      )

      const texto = compareceu ? 'Presença confirmada' : 'Falta registrada (suspensão de 2 semanas criada)'
      mostrarMensagem('sucesso', texto)
    } catch (error) {
      console.error('Erro ao marcar presença:', error)
      mostrarMensagem('erro', 'Erro ao registrar presença')
    } finally {
      setSalvando(false)
    }
  }

  const handleResetarPresenca = async (agendamentoId) => {
    if (!window.confirm('Tem certeza que deseja resetar o registro de presença?')) {
      return
    }

    try {
      setSalvando(true)

      const { error } = await supabase.functions.invoke('manage-appointments', {
        body: {
          action: 'reset_presence',
          ids: [agendamentoId],
          actor: userProfile?.name || 'Admin'
        }
      })

      if (error) throw error

      // Atualizar estado local
      setAgendamentos(prev =>
        prev.map(ag =>
          ag.id === agendamentoId
            ? {
                ...ag,
                compareceu: null,
                data_registro_presenca: null,
                responsavel_registro: null
              }
            : ag
        )
      )

      mostrarMensagem('sucesso', 'Presença resetada e eventual suspensão desativada')
    } catch (error) {
      console.error('Erro ao resetar presença:', error)
      mostrarMensagem('erro', 'Erro ao resetar presença')
    } finally {
      setSalvando(false)
    }
  }

  const mostrarMensagem = (tipo, texto) => {
    setMensagem({ tipo, texto })
    setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000)
  }

  const getAgendamentosGiraSelecionada = () => {
    if (!giraSelecionada) return []
    const gira = giras.find(g => g.chave === giraSelecionada)
    return gira ? gira.agendamentos : []
  }

  const getEstatisticasGiraSelecionada = () => {
    const agendamentosGira = getAgendamentosGiraSelecionada()
    return calcularEstatisticasGira(agendamentosGira)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando lista de giras...</p>
      </div>
    )
  }

  const giraSelecionadaObj = giras.find(g => g.chave === giraSelecionada)
  const agendamentosGira = getAgendamentosGiraSelecionada()
  const estatisticas = getEstatisticasGiraSelecionada()

  return (
    <div className="lista-confirmacao-container">
      <div className="header-section">
        <h1>📋 Lista de Confirmação de Presença</h1>
        <p className="subtitle">Registre a presença dos consulentes após cada gira</p>
      </div>

      {mensagem.texto && (
        <div className={`mensagem ${mensagem.tipo}`}>
          {mensagem.texto}
        </div>
      )}

      <div className="content-layout">
        {/* Sidebar com lista de giras */}
        <div className="sidebar-giras">
          <h2>Giras</h2>
          {giras.length === 0 ? (
            <p className="empty-message">Nenhuma gira com agendamentos confirmados</p>
          ) : (
            <div className="giras-list">
              {giras.map(gira => {
                const jaPassou = giraJaPassou(gira.data)
                return (
                  <div
                    key={gira.chave}
                    className={`gira-item ${giraSelecionada === gira.chave ? 'active' : ''} ${
                      !jaPassou ? 'futura' : ''
                    }`}
                    onClick={() => setGiraSelecionada(gira.chave)}
                  >
                    <div className="gira-data">
                      {formatarDataCurta(gira.data)}
                      {!jaPassou && <span className="badge-futura">Futura</span>}
                    </div>
                    <div className="gira-stats">
                      <span className="total">{gira.total} agendados</span>
                      {gira.pendentes > 0 && (
                        <span className="pendentes">{gira.pendentes} pendentes</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Área principal com lista de agendamentos */}
        <div className="main-content">
          {!giraSelecionadaObj ? (
            <div className="empty-state">
              <p>Selecione uma gira na lista ao lado</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho da gira */}
              <div className="gira-header">
                <div className="gira-info">
                  <h2>{formatarDataGira(giraSelecionadaObj.data)}</h2>
                  {!giraJaPassou(giraSelecionadaObj.data) && (
                    <span className="badge-futura-grande">Esta gira ainda não aconteceu</span>
                  )}
                </div>

                {/* Estatísticas */}
                <div className="estatisticas-grid">
                  <div className="stat-card total">
                    <span className="stat-label">Total</span>
                    <span className="stat-value">{estatisticas.total}</span>
                  </div>
                  <div className="stat-card presentes">
                    <span className="stat-label">Presentes</span>
                    <span className="stat-value">{estatisticas.confirmados}</span>
                    <span className="stat-percent">{estatisticas.percentualPresenca}%</span>
                  </div>
                  <div className="stat-card ausentes">
                    <span className="stat-label">Ausentes</span>
                    <span className="stat-value">{estatisticas.ausentes}</span>
                    <span className="stat-percent">{estatisticas.percentualAusencia}%</span>
                  </div>
                  <div className="stat-card pendentes">
                    <span className="stat-label">Pendentes</span>
                    <span className="stat-value">{estatisticas.pendentes}</span>
                  </div>
                </div>
              </div>

              {/* Lista de agendamentos */}
              <div className="agendamentos-list">
                {agendamentosGira.length === 0 ? (
                  <p className="empty-message">Nenhum agendamento para esta gira</p>
                ) : (
                  <div className="table-responsive">
                    <table className="agendamentos-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Atendimento</th>
                          <th>Contato</th>
                          <th>Status Presença</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agendamentosGira.map(agendamento => (
                          <tr key={agendamento.id} className={`row-${agendamento.compareceu === true ? 'presente' : agendamento.compareceu === false ? 'ausente' : 'pendente'}`}>
                            <td>
                              <strong>{agendamento.nome_completo}</strong>
                            </td>
                            <td>{agendamento.opcao_escolhida === 'segunda' ? agendamento.segunda_opcao : agendamento.primeira_opcao}</td>
                            <td>
                              <div className="contato-info">
                                <div>{agendamento.email}</div>
                                <div>{agendamento.telefone}</div>
                              </div>
                            </td>
                            <td>
                              {agendamento.compareceu === null ? (
                                <span className="badge badge-pendente">Pendente</span>
                              ) : agendamento.compareceu ? (
                                <div className="status-registrado">
                                  <span className="badge badge-presente">✓ Compareceu</span>
                                  <small>
                                    Por {agendamento.responsavel_registro}
                                  </small>
                                </div>
                              ) : (
                                <div className="status-registrado">
                                  <span className="badge badge-ausente">✗ Não compareceu</span>
                                  <small>
                                    Por {agendamento.responsavel_registro}
                                  </small>
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="acoes-buttons">
                                {agendamento.compareceu === null ? (
                                  <>
                                    <button
                                      className="btn-acao btn-presente"
                                      onClick={() => handleMarcarPresenca(agendamento.id, true)}
                                      disabled={salvando}
                                      title="Marcar como presente"
                                    >
                                      ✓ Presente
                                    </button>
                                    <button
                                      className="btn-acao btn-ausente"
                                      onClick={() => handleMarcarPresenca(agendamento.id, false)}
                                      disabled={salvando}
                                      title="Marcar como ausente (suspende por 2 semanas)"
                                    >
                                      ✗ Ausente
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn-acao btn-resetar"
                                    onClick={() => handleResetarPresenca(agendamento.id)}
                                    disabled={salvando}
                                    title="Resetar registro de presença"
                                  >
                                    ↺ Resetar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ListaConfirmacaoPresenca
