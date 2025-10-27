import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogOut, Calendar, Settings, BarChart3, Menu, X, Users, ClipboardCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import AgendamentoManager from './AgendamentoManager';
import Configuracoes from './Configuracoes';
import Reports from './Reports';
import UserManager from './UserManager';
import TrabalhadorManager from './TrabalhadorManager';
import PresencaManager from './PresencaManager';
import PresencaReports from './PresencaReports';
import AdvertenciaManager from './AdvertenciaManager';
import './Dashboard.css';

function Dashboard({ session }) {
  const [activeTab, setActiveTab] = useState('agendamentos');
  const [presencaSubTab, setPresencaSubTab] = useState('trabalhadores'); // 'trabalhadores' ou 'presenca'
  const [userProfile, setUserProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  React.useEffect(() => {
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabs = [
    { id: 'agendamentos', label: 'Agendamentos', icon: Calendar },
    { id: 'presenca', label: 'Presença', icon: ClipboardCheck },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  return (
    <div className="dashboard">
      <button
        className="menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>Admin CESCA</h1>
          <p>{userProfile?.name || session.user.email}</p>
        </div>

        <nav className="sidebar-nav">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="main-content">
        <div className="content-wrapper">
          {activeTab === 'agendamentos' && <AgendamentoManager userProfile={userProfile} />}

          {activeTab === 'presenca' && (
            <>
              <div className="sub-tabs">
                <button
                  className={presencaSubTab === 'trabalhadores' ? 'active' : ''}
                  onClick={() => setPresencaSubTab('trabalhadores')}
                >
                  <Users size={18} />
                  Trabalhadores
                </button>
                <button
                  className={presencaSubTab === 'presenca' ? 'active' : ''}
                  onClick={() => setPresencaSubTab('presenca')}
                >
                  <ClipboardCheck size={18} />
                  Registrar Presença
                </button>
                <button
                  className={presencaSubTab === 'advertencias' ? 'active' : ''}
                  onClick={() => setPresencaSubTab('advertencias')}
                >
                  <AlertTriangle size={18} />
                  Advertências
                </button>
                <button
                  className={presencaSubTab === 'relatorios' ? 'active' : ''}
                  onClick={() => setPresencaSubTab('relatorios')}
                >
                  <TrendingUp size={18} />
                  Relatórios
                </button>
              </div>
              {presencaSubTab === 'trabalhadores' && <TrabalhadorManager />}
              {presencaSubTab === 'presenca' && <PresencaManager userProfile={userProfile} />}
              {presencaSubTab === 'advertencias' && <AdvertenciaManager userProfile={userProfile} />}
              {presencaSubTab === 'relatorios' && <PresencaReports />}
            </>
          )}

          {activeTab === 'usuarios' && <UserManager />}
          {activeTab === 'configuracoes' && <Configuracoes />}
          {activeTab === 'reports' && <Reports />}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
