# REFERÊNCIAS DE CÓDIGO - SISTEMA DE CAPACITAÇÕES

## Índice Rápido de Referências

### 1. DEFINIÇÃO E SCHEMA

#### Arquivo: `/root/admin-cesca/supabase-escalas-schema.sql`

**Tabela Principal (Linhas 35-60):**
```sql
CREATE TABLE IF NOT EXISTS trabalhadores_capacitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE CASCADE,
  nivel_experiencia TEXT DEFAULT 'intermediario',
  preferencia_prioridade INTEGER DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trabalhador_id, tipo_atendimento_id)
);
```

**Índices (Linhas 52-55):**
```sql
CREATE INDEX idx_trabalhadores_capacitacoes_trabalhador 
  ON trabalhadores_capacitacoes(trabalhador_id);
CREATE INDEX idx_trabalhadores_capacitacoes_tipo 
  ON trabalhadores_capacitacoes(tipo_atendimento_id);
CREATE INDEX idx_trabalhadores_capacitacoes_prioridade 
  ON trabalhadores_capacitacoes(preferencia_prioridade);
```

**RLS Policy (Linhas 411-412):**
```sql
CREATE POLICY "Admins acesso total trabalhadores_capacitacoes" 
  ON trabalhadores_capacitacoes 
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

**Trigger (Linhas 358-361):**
```sql
CREATE TRIGGER update_trabalhadores_capacitacoes_updated_at
  BEFORE UPDATE ON trabalhadores_capacitacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
```

---

### 2. COMPONENTE UI - CapacitacoesManager

#### Arquivo: `/root/admin-cesca/src/components/escalas/CapacitacoesManager.js`

**Imports (Linhas 1-13):**
```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { showToast } from '../index';
import {
  Award,
  Search,
  X,
  Edit2,
  User,
  CheckCircle
} from 'lucide-react';
import './CapacitacoesManager.css';
```

**Estados (Linhas 16-23):**
```javascript
const [trabalhadores, setTrabalhadores] = useState([]);
const [tiposAtendimento, setTiposAtendimento] = useState([]);
const [capacitacoes, setCapacitacoes] = useState([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
const [showModal, setShowModal] = useState(false);
const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
const [selectedTipos, setSelectedTipos] = useState([]);
```

**Fetch Data (Linhas 26-64):**
```javascript
const fetchData = useCallback(async () => {
  try {
    setLoading(true);

    // Carregar trabalhadores ativos
    const { data: trabData, error: trabError } = await supabase
      .from('trabalhadores')
      .select('*')
      .eq('status', 'ativo')
      .order('nome_completo');

    // Carregar tipos de atendimento ativos
    const { data: tiposData, error: tiposError } = await supabase
      .from('tipos_atendimento')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    // Carregar capacitações
    const { data: capData, error: capError } = await supabase
      .from('trabalhadores_capacitacoes')
      .select('*');

    setTrabalhadores(trabData || []);
    setTiposAtendimento(tiposData || []);
    setCapacitacoes(capData || []);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast.error('Erro ao carregar dados');
  } finally {
    setLoading(false);
  }
}, []);
```

**Get Capacitações por Trabalhador (Linhas 71-75):**
```javascript
const getCapacitacoesTrabalhador = (trabalhadorId) => {
  return capacitacoes
    .filter(c => c.trabalhador_id === trabalhadorId)
    .map(c => c.tipo_atendimento_id);
};
```

**Handle Save (Linhas 100-147):**
```javascript
const handleSave = async () => {
  if (!selectedTrabalhador) return;

  try {
    const trabalhadorId = selectedTrabalhador.id;
    const capacitacoesAtuais = getCapacitacoesTrabalhador(trabalhadorId);

    // Tipos a adicionar
    const tiposAdicionar = selectedTipos.filter(t => !capacitacoesAtuais.includes(t));

    // Tipos a remover
    const tiposRemover = capacitacoesAtuais.filter(t => !selectedTipos.includes(t));

    // Adicionar novas capacitações
    if (tiposAdicionar.length > 0) {
      const novasCapacitacoes = tiposAdicionar.map(tipoId => ({
        trabalhador_id: trabalhadorId,
        tipo_atendimento_id: tipoId
      }));

      const { error: insertError } = await supabase
        .from('trabalhadores_capacitacoes')
        .insert(novasCapacitacoes);

      if (insertError) throw insertError;
    }

    // Remover capacitações
    if (tiposRemover.length > 0) {
      const { error: deleteError } = await supabase
        .from('trabalhadores_capacitacoes')
        .delete()
        .eq('trabalhador_id', trabalhadorId)
        .in('tipo_atendimento_id', tiposRemover);

      if (deleteError) throw deleteError;
    }

    showToast.success('Capacitações atualizadas com sucesso!');
    setShowModal(false);
    setSelectedTrabalhador(null);
    setSelectedTipos([]);
    fetchData();
  } catch (error) {
    console.error('Erro ao salvar capacitações:', error);
    showToast.error('Erro ao salvar capacitações');
  }
};
```

**UI - Trabalhador Card (Linhas 200-239):**
```javascript
<div className="trabalhador-card">
  <div className="trabalhador-info">
    <div className="trabalhador-avatar">
      <User size={24} />
    </div>
    <div className="trabalhador-details">
      <h3>{trabalhador.nome_completo}</h3>
      {trabalhador.funcao && (
        <span className="trabalhador-funcao">{trabalhador.funcao}</span>
      )}
    </div>
  </div>

  <div className="capacitacoes-badges">
    {capacitacoesIds.length === 0 ? (
      <span className="no-capacitacoes">Nenhuma capacitação</span>
    ) : (
      capacitacoesIds.map(tipoId => (
        <span key={tipoId} className="capacitacao-badge">
          <CheckCircle size={14} />
          {getTipoNome(tipoId)}
        </span>
      ))
    )}
  </div>

  <button
    className="btn btn-secondary btn-small"
    onClick={() => handleEditCapacitacoes(trabalhador)}
  >
    <Edit2 size={16} />
    Editar
  </button>
</div>
```

**Modal de Edição (Linhas 244-311):**
```javascript
{showModal && selectedTrabalhador && (
  <div className="modal-overlay" onClick={() => setShowModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <div>
          <h3>Editar Capacitações</h3>
          <p className="modal-subtitle">{selectedTrabalhador.nome_completo}</p>
        </div>
        <button className="modal-close" onClick={() => setShowModal(false)}>
          <X size={24} />
        </button>
      </div>

      <div className="modal-body">
        <div className="tipos-checkboxes">
          {tiposAtendimento.map(tipo => (
            <label key={tipo.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={selectedTipos.includes(tipo.id)}
                onChange={() => toggleTipo(tipo.id)}
              />
              <span>{tipo.nome}</span>
              <span className="tipo-info">
                ({tipo.qtd_pessoas_necessarias} {tipo.qtd_pessoas_necessarias === 1 ? 'pessoa' : 'pessoas'})
              </span>
            </label>
          ))}
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
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={tiposAtendimento.length === 0}
        >
          <CheckCircle size={20} />
          Salvar
        </button>
      </div>
    </div>
  </div>
)}
```

---

### 3. ALGORITMO DE ESCALAS

#### Arquivo: `/root/admin-cesca/src/components/escalas/utils/algoritmoEscalas.js`

**Função: obterTrabalhadoresCapacitados (Linhas 39-43):**
```javascript
function obterTrabalhadoresCapacitados(tipoAtendimentoId, trabalhadores, capacitacoes) {
  return trabalhadores.filter((trab) =>
    temCapacitacao(trab.id, tipoAtendimentoId, capacitacoes)
  );
}
```

**Função: gerarEscalasAutomaticas - Carregamento (Linhas 109-117):**
```javascript
export function gerarEscalasAutomaticas(
  ano,
  mes,
  tiposAtendimento,
  trabalhadores,
  capacitacoes,  // ◄─── AQUI
  funcoesFixas,
  restricoes
)
```

**Função: gerarEscalasAutomaticas - Alocação (Linhas 206-248):**
```javascript
// ETAPA 2: Alocação automática (sem função fixa)
const candidatos = obterTrabalhadoresCapacitados(tipo.id, trabalhadores, capacitacoes);

if (candidatos.length === 0) {
  erros.push(
    `Nenhum trabalhador capacitado para ${tipo.nome} em ${data}`
  );
  return;
}

const selecionado = selecionarMelhorTrabalhador(
  candidatos,
  data,
  tipo,
  escalasGeradas,
  restricoes,
  cargaTrabalho
);

if (!selecionado) {
  avisos.push(
    `Não foi possível alocar ninguém para ${tipo.nome} em ${data} (conflitos ou restrições)`
  );
  return;
}

// Alocar
escalasGeradas.push({
  id: `temp_${Date.now()}_${Math.random()}`,
  trabalhador_id: selecionado.id,
  trabalhador_nome: selecionado.nome_completo,
  tipo_atendimento_id: tipo.id,
  tipo_nome: tipo.nome,
  data_atendimento: data,
  dia_semana: diaSemana,
  horario_inicio: tipo.horario_inicio,
  horario_fim: tipo.horario_fim,
  funcao: null,
  funcao_fixa: false,
});

cargaTrabalho[selecionado.id] = (cargaTrabalho[selecionado.id] || 0) + 1;
```

---

### 4. DETECTOR DE CONFLITOS

#### Arquivo: `/root/admin-cesca/src/components/escalas/utils/detectorConflitos.js`

**Função: temCapacitacao (Linhas 75-84):**
```javascript
export function temCapacitacao(trabalhadorId, tipoAtendimentoId, capacitacoes) {
  return capacitacoes.some(
    (cap) =>
      cap.trabalhador_id === trabalhadorId &&
      cap.tipo_atendimento_id === tipoAtendimentoId &&
      cap.ativo  // ◄─── BUG: Campo não existe na tabela!
  );
}
```

**Função: validarAlocacao (Linhas 113-152):**
```javascript
export function validarAlocacao(
  trabalhadorId,
  tipoAtendimento,
  data,
  escalasExistentes,
  capacitacoes,
  restricoes
) {
  const erros = [];

  // 1. Verificar capacitação
  if (!temCapacitacao(trabalhadorId, tipoAtendimento.id, capacitacoes)) {
    erros.push('Trabalhador não tem capacitação para este tipo de atendimento');
  }

  // 2. Verificar restrição de data
  if (temRestricao(trabalhadorId, data, restricoes)) {
    erros.push('Trabalhador tem restrição cadastrada para esta data');
  }

  // 3. Verificar conflito de horário
  const conflito = detectarConflito(
    trabalhadorId,
    data,
    tipoAtendimento.horario_inicio,
    tipoAtendimento.horario_fim,
    escalasExistentes
  );

  if (conflito.temConflito) {
    erros.push(
      `Conflito de horário: já escalado em ${conflito.conflitos[0].tipo}`
    );
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}
```

---

### 5. GERADOR DE ESCALAS

#### Arquivo: `/root/admin-cesca/src/components/escalas/GeradorEscalas.js`

**Carregamento de Dados (Linhas 48-102):**
```javascript
const loadDados = async () => {
  setLoading(true);
  try {
    // Buscar tipos de atendimento
    const { data: tipos, error: erroTipos } = await supabase
      .from('tipos_atendimento')
      .select('*')
      .order('nome');

    // Buscar trabalhadores ativos
    const { data: trabs, error: erroTrabs } = await supabase
      .from('trabalhadores')
      .select('*')
      .eq('status', 'ativo')
      .order('nome_completo');

    // Buscar capacitações
    const { data: caps, error: erroCaps } = await supabase
      .from('trabalhadores_capacitacoes')
      .select('*');

    // Buscar funções fixas
    const { data: funcoes, error: erroFuncoes } = await supabase
      .from('funcoes_fixas')
      .select('*');

    // Buscar restrições
    const { data: rests, error: erroRests } = await supabase
      .from('restricoes_datas')
      .select('*');

    setTiposAtendimento(tipos || []);
    setTrabalhadores(trabs || []);
    setCapacitacoes(caps || []);
    setFuncoesFixas(funcoes || []);
    setRestricoes(rests || []);

    toast.success('Dados carregados com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    toast.error('Erro ao carregar dados: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

**Geração (Linhas 104-145):**
```javascript
const handleGerarEscalas = () => {
  if (tiposAtendimento.length === 0) {
    toast.error('Nenhum tipo de atendimento cadastrado!');
    return;
  }

  if (trabalhadores.length === 0) {
    toast.error('Nenhum trabalhador ativo cadastrado!');
    return;
  }

  setGerando(true);

  try {
    const resultado = gerarEscalasAutomaticas(
      anoSelecionado,
      mesSelecionado,
      tiposAtendimento,
      trabalhadores,
      capacitacoes,  // ◄─── PASSADO AQUI
      funcoesFixas,
      restricoes
    );

    setResultado(resultado);
    setVisualizacao(agruparEscalasPorData(resultado.escalas));

    // Mostrar resumo
    if (resultado.erros.length > 0) {
      toast.error(`${resultado.erros.length} erro(s) encontrado(s)!`);
    } else if (resultado.avisos.length > 0) {
      toast.warning(`${resultado.avisos.length} aviso(s) encontrado(s)!`);
    } else {
      toast.success(`${resultado.escalas.length} escalas geradas com sucesso!`);
    }
  } catch (error) {
    console.error('Erro ao gerar escalas:', error);
    toast.error('Erro ao gerar escalas: ' + error.message);
  } finally {
    setGerando(false);
  }
};
```

---

### 6. HUB CENTRAL - EscalasManager

#### Arquivo: `/root/admin-cesca/src/components/escalas/EscalasManager.js`

**Tabs Configuração (Linhas 31-41):**
```javascript
const tabs = [
  { id: 'gerador', label: 'Gerar Escalas', icon: Zap, color: '#f59e0b' },
  { id: 'revisao', label: 'Revisar Escalas', icon: Eye, color: '#3b82f6' },
  { id: 'tipos', label: 'Tipos de Atendimento', icon: Settings, color: '#8b5cf6' },
  { id: 'capacitacoes', label: 'Capacitações', icon: Shield, color: '#10b981' },
  { id: 'funcoes', label: 'Funções Fixas', icon: Users, color: '#ef4444' },
  { id: 'restricoes', label: 'Restrições', icon: Ban, color: '#f43f5e' },
  { id: 'substituicoes', label: 'Substituições', icon: Repeat, color: '#06b6d4' },
];
```

**Render Tab Content (Linhas 43-66):**
```javascript
const renderTabContent = () => {
  switch (activeTab) {
    case 'gerador':
      return <GeradorEscalas userProfile={userProfile} />;
    case 'revisao':
      return <PainelRevisao userProfile={userProfile} />;
    case 'tipos':
      return <TiposAtendimentoConfig userProfile={userProfile} />;
    case 'capacitacoes':
      return <CapacitacoesManager userProfile={userProfile} />;
    case 'funcoes':
      return <FuncoesFixasConfig userProfile={userProfile} />;
    case 'restricoes':
      return <RestricoesManager userProfile={userProfile} />;
    case 'substituicoes':
      return <SubstituicoesManager userProfile={userProfile} />;
    default:
      return <GeradorEscalas userProfile={userProfile} />;
  }
};
```

---

### 7. PAINEL DE REVISÃO

#### Arquivo: `/root/admin-cesca/src/components/escalas/PainelRevisao.js`

**Carregamento de Dados Auxiliares (Linhas 53-81):**
```javascript
const loadDadosAuxiliares = async () => {
  try {
    const { data: trabs } = await supabase
      .from('trabalhadores')
      .select('*')
      .eq('status', 'ativo')
      .order('nome_completo');

    const { data: tipos } = await supabase
      .from('tipos_atendimento')
      .select('*')
      .order('nome');

    const { data: caps } = await supabase
      .from('trabalhadores_capacitacoes')
      .select('*');  // ◄─── CARREGA CAPACITAÇÕES

    const { data: rests } = await supabase
      .from('restricoes_datas')
      .select('*');

    setTrabalhadores(trabs || []);
    setTiposAtendimento(tipos || []);
    setCapacitacoes(caps || []);
    setRestricoes(rests || []);
  } catch (error) {
    console.error('Erro ao carregar dados auxiliares:', error);
  }
};
```

---

### 8. TIPOS DE ATENDIMENTO

#### Arquivo: `/root/admin-cesca/src/components/escalas/TiposAtendimentoConfig.js`

**Deleção com Validação (aprox. linha 150):**
```javascript
// Nota: Há validação que impede deletar tipo se há capacitações/escalas vinculadas:
showToast.error('Não é possível excluir: existem capacitações ou escalas vinculadas a este tipo');
```

---

### 9. VIEWS PARA RELATÓRIOS

#### Arquivo: `/root/admin-cesca/supabase-escalas-schema.sql`

**Vista: vw_resumo_participacao_trabalhadores (Linhas 240-299):**
```sql
CREATE OR REPLACE VIEW vw_resumo_participacao_trabalhadores AS
SELECT
  t.id as trabalhador_id,
  t.numero,
  t.nome_completo,
  t.grupo,
  t.status,
  
  -- ... outras agregações ...
  
  -- Capacitações (quantos tipos de atendimento pode fazer)
  COUNT(DISTINCT tc.tipo_atendimento_id) as qtd_capacitacoes

FROM trabalhadores t
LEFT JOIN escalas_detalhes ed ON ed.trabalhador_id = t.id
LEFT JOIN presencas_escalas pe ON pe.escala_detalhe_id = ed.id
LEFT JOIN substituicoes s ON s.trabalhador_original_id = t.id OR s.trabalhador_substituto_id = t.id
LEFT JOIN trabalhadores_capacitacoes tc ON tc.trabalhador_id = t.id  -- ◄─── AQUI

WHERE t.status = 'ativo'
GROUP BY t.id, t.numero, t.nome_completo, t.grupo, t.status
ORDER BY t.nome_completo;
```

---

## Sumário de Funções Chave

| Função | Arquivo | Linha | Função |
|--------|---------|-------|--------|
| `fetchData()` | CapacitacoesManager.js | 26 | Carrega dados iniciais |
| `getCapacitacoesTrabalhador()` | CapacitacoesManager.js | 71 | Obtém capacitações de um trabalhador |
| `handleSave()` | CapacitacoesManager.js | 100 | Salva capacitações alteradas |
| `obterTrabalhadoresCapacitados()` | algoritmoEscalas.js | 39 | Filtra candidatos capacitados |
| `gerarEscalasAutomaticas()` | algoritmoEscalas.js | 109 | Gera escalas automáticas |
| `temCapacitacao()` | detectorConflitos.js | 77 | Verifica capacitação |
| `validarAlocacao()` | detectorConflitos.js | 113 | Valida se alocação é possível |
| `handleGerarEscalas()` | GeradorEscalas.js | 104 | Dispara geração de escalas |

---

## Fluxo de Requisições Supabase

### 1. Carregar Capacitações
```javascript
const { data: capData, error: capError } = await supabase
  .from('trabalhadores_capacitacoes')
  .select('*');
```

### 2. Inserir Nova Capacitação
```javascript
await supabase
  .from('trabalhadores_capacitacoes')
  .insert({
    trabalhador_id: trabalhadorId,
    tipo_atendimento_id: tipoId
  });
```

### 3. Deletar Capacitação
```javascript
await supabase
  .from('trabalhadores_capacitacoes')
  .delete()
  .eq('trabalhador_id', trabalhadorId)
  .in('tipo_atendimento_id', tiposRemover);
```

---

## CSS Classes Principais

**Arquivo: `/root/admin-cesca/src/components/escalas/CapacitacoesManager.css`**

- `.capacitacoes-manager` - Container principal
- `.trabalhador-card` - Card de cada trabalhador
- `.capacitacao-badge` - Badge mostrando capacitação
- `.modal-overlay` - Overlay do modal
- `.modal-content` - Conteúdo do modal
- `.tipos-checkboxes` - Container dos checkboxes
- `.checkbox-item` - Item de checkbox

