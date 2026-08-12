import React, { useState, lazy, Suspense } from 'react';
import { Layout, Avatar, Typography, Drawer, Button, message, Spin, Tooltip } from 'antd';
import logger from '../utils/logger';
import {
  CalendarOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  BarChartOutlined,
  LogoutOutlined,
  BellOutlined,
  CheckSquareOutlined,
  DollarOutlined,
  MenuOutlined,
  FormOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShopOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import './Dashboard.css';

// Lazy loading de componentes para reduzir bundle inicial
const AgendamentoManager    = lazy(() => import('./AgendamentoManager'));
const ListaConfirmacaoPresenca = lazy(() => import('./ListaConfirmacaoPresenca'));
const Configuracoes         = lazy(() => import('./Configuracoes'));
const Reports               = lazy(() => import('./Reports'));
const UserManager           = lazy(() => import('./UserManager'));
const TrabalhadorManager    = lazy(() => import('./TrabalhadorManager'));
const PresencaManager       = lazy(() => import('./PresencaManager'));
const PresencaReports       = lazy(() => import('./PresencaReports'));
const AdvertenciaManager    = lazy(() => import('./AdvertenciaManager'));
const FinanceiroManager     = lazy(() => import('./financeiro/FinanceiroManager'));
const EscalasManager        = lazy(() => import('./escalas/EscalasManager'));
const FormularioEditor      = lazy(() => import('./FormularioEditor'));
const AlterarSenha          = lazy(() => import('./AlterarSenha'));
const LanchoneteManager     = lazy(() => import('./lanchonete/LanchoneteManager'));
const AvaliacaoManager      = lazy(() => import('./AvaliacaoManager'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
    <Spin size="large" tip="Carregando..." />
  </div>
);

const { Sider, Content } = Layout;
const { Text } = Typography;

const SIDEBAR_WIDTH           = 240;
const SIDEBAR_COLLAPSED_WIDTH = 68;
const MOBILE_BREAKPOINT       = 768;

// Items do menu principal
const MENU_ITEMS = [
  { key: 'agendamentos',      icon: <CalendarOutlined />,    label: 'Agendamentos' },
  { key: 'lista-confirmacao', icon: <CheckSquareOutlined />, label: 'Lista de Confirmação' },
  { key: 'avaliacoes',        icon: <AuditOutlined />,       label: 'Avaliações', roles: ['admin', 'coordinator'] },
  { key: 'editor-quiz',       icon: <FormOutlined />,        label: 'Editor de Quiz' },
  { key: 'presenca',          icon: <CheckSquareOutlined />, label: 'Presença' },
  { key: 'escalas',           icon: <CalendarOutlined />,    label: 'Escalas' },
  { key: 'financeiro',        icon: <DollarOutlined />,      label: 'Financeiro' },
  { key: 'lanchonete',        icon: <ShopOutlined />,        label: 'Lanchonete', roles: ['admin', 'coordenador_lanches'] },
  { key: 'usuarios',          icon: <UserOutlined />,        label: 'Usuários', roles: ['admin', 'coordenador_lanches'] },
  { key: 'reports',           icon: <BarChartOutlined />,    label: 'Relatórios' },
];

// Sub-itens da seção Presença
const PRESENCA_ITEMS = [
  { key: 'trabalhadores', icon: <TeamOutlined />,       label: 'Trabalhadores' },
  { key: 'presenca',      icon: <CheckSquareOutlined />, label: 'Registrar' },
  { key: 'advertencias',  icon: <BellOutlined />,        label: 'Advertências' },
  { key: 'relatorios',    icon: <BarChartOutlined />,    label: 'Relatórios' },
];

function Dashboard({ session }) {
  const [activeTab,      setActiveTab]      = useState('agendamentos');
  const [presencaSubTab, setPresencaSubTab] = useState('trabalhadores');
  const [userProfile,    setUserProfile]    = useState(null);
  const [drawerVisible,  setDrawerVisible]  = useState(false);
  const [collapsed,      setCollapsed]      = useState(false);
  const [isMobile,       setIsMobile]       = useState(window.innerWidth < MOBILE_BREAKPOINT);

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) setDrawerVisible(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      logger.error('Erro ao carregar perfil:', error);
      message.error('Não foi possível carregar o perfil do usuário.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navigate = (key) => {
    setActiveTab(key);
    setDrawerVisible(false);
  };

  const effectiveRole = userProfile?.is_admin ? 'admin' : userProfile?.role;
  const visibleMenuItems = MENU_ITEMS.filter(item => !item.roles || item.roles.includes(effectiveRole));

  // ── Sidebar Content (reutilizado no Sider e no Drawer) ───────────────────────
  const SidebarContent = ({ isCollapsed = false }) => (
    <div className="sidebar-inner">

      {/* Logo / Brand */}
      <div className={`sidebar-brand ${isCollapsed ? 'collapsed' : ''}`}>
        <img src="/logo-cesca.jpeg" alt="CESCA" className="sidebar-logo-img" />
        {!isCollapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Admin CESCA</span>
            <span className="sidebar-brand-sub">Centro Espírita</span>
          </div>
        )}
        {!isMobile && (
          <Tooltip title={isCollapsed ? 'Expandir' : 'Recolher'} placement="right">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setCollapsed(c => !c)}
              aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </Tooltip>
        )}
      </div>

      {/* Navegação principal */}
      <nav className="sidebar-nav" role="navigation" aria-label="Menu principal">
        {visibleMenuItems.map(item => (
          <Tooltip key={item.key} title={isCollapsed ? item.label : ''} placement="right">
            <button
              className={`sidebar-nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => navigate(item.key)}
              aria-current={activeTab === item.key ? 'page' : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
            </button>
          </Tooltip>
        ))}
      </nav>

      {/* Rodapé: usuário + ações */}
      <div className="sidebar-footer">
        {/* Info do usuário */}
        <div className={`sidebar-user ${isCollapsed ? 'collapsed' : ''}`}>
          <Avatar
            style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff', flexShrink: 0 }}
            icon={<UserOutlined />}
            size={36}
          />
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <Text className="sidebar-user-name">{userProfile?.name || 'Usuário'}</Text>
              <Text className="sidebar-user-role">
                {effectiveRole === 'admin' ? 'Administrador' : effectiveRole === 'coordinator' ? 'Coordenador' : effectiveRole === 'vendedor' ? 'Vendedor' : 'Usuário'}
              </Text>
            </div>
          )}
        </div>

        {/* Ações do usuário */}
        <div className="sidebar-actions">
          <Tooltip title={isCollapsed ? 'Configurações' : ''} placement="right">
            <button
              className={`sidebar-action-btn ${activeTab === 'configuracoes' ? 'active' : ''}`}
              onClick={() => navigate('configuracoes')}
            >
              <SettingOutlined />
              {!isCollapsed && <span>Configurações</span>}
            </button>
          </Tooltip>
          <Tooltip title={isCollapsed ? 'Alterar Senha' : ''} placement="right">
            <button
              className={`sidebar-action-btn ${activeTab === 'alterar-senha' ? 'active' : ''}`}
              onClick={() => navigate('alterar-senha')}
            >
              <LockOutlined />
              {!isCollapsed && <span>Alterar Senha</span>}
            </button>
          </Tooltip>
          <Tooltip title={isCollapsed ? 'Sair' : ''} placement="right">
            <button className="sidebar-action-btn danger" onClick={handleLogout}>
              <LogoutOutlined />
              {!isCollapsed && <span>Sair</span>}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  // ── Sub-tabs da seção Presença ───────────────────────────────────────────────
  const renderPresencaContent = () => (
    <>
      <div className="presenca-subtabs" role="tablist">
        {PRESENCA_ITEMS.map(item => (
          <button
            key={item.key}
            role="tab"
            aria-selected={presencaSubTab === item.key}
            className={`presenca-subtab-btn ${presencaSubTab === item.key ? 'active' : ''}`}
            onClick={() => setPresencaSubTab(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {presencaSubTab === 'trabalhadores' && <TrabalhadorManager />}
      {presencaSubTab === 'presenca'      && <PresencaManager userProfile={userProfile} />}
      {presencaSubTab === 'advertencias'  && <AdvertenciaManager userProfile={userProfile} />}
      {presencaSubTab === 'relatorios'    && <PresencaReports />}
    </>
  );

  const currentSidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>

      {/* ── Sidebar Desktop ────────────────────────────────────────────────────── */}
      {!isMobile && (
        <Sider
          width={SIDEBAR_WIDTH}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          collapsed={collapsed}
          trigger={null}
          className="app-sider"
          style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100, overflow: 'hidden' }}
        >
          <SidebarContent isCollapsed={collapsed} />
        </Sider>
      )}

      {/* ── Drawer Mobile ──────────────────────────────────────────────────────── */}
      <Drawer
        placement="left"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={`min(${SIDEBAR_WIDTH}px, 88vw)`}
        styles={{
          body:    { padding: 0, background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)' },
          header:  { display: 'none' },
          wrapper: { boxShadow: 'none' },
        }}
      >
        <SidebarContent isCollapsed={false} />
      </Drawer>

      {/* ── Área Principal ─────────────────────────────────────────────────────── */}
      <Layout
        style={{
          marginLeft:  isMobile ? 0 : currentSidebarWidth,
          transition:  'margin-left 0.2s ease',
          minHeight:   '100vh',
          background:  '#f5f7fa',
        }}
      >
        {/* Top bar mobile */}
        {isMobile && (
          <div className="mobile-topbar">
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setDrawerVisible(true)}
              aria-label="Abrir menu"
            />
            <div className="mobile-topbar-brand">
              <img src="/logo-cesca.jpeg" alt="CESCA" className="mobile-logo-img" />
              <Text strong style={{ fontSize: 16, color: '#222' }}>Admin CESCA</Text>
            </div>
            <Avatar
              style={{ backgroundColor: '#667eea', flexShrink: 0 }}
              icon={<UserOutlined />}
              size={32}
            />
          </div>
        )}

        {/* Conteúdo da página */}
        <Content className="main-content">
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === 'agendamentos'      && <AgendamentoManager userProfile={userProfile} />}
            {activeTab === 'lista-confirmacao' && <ListaConfirmacaoPresenca userProfile={userProfile} />}
            {activeTab === 'editor-quiz'       && <FormularioEditor />}
            {activeTab === 'presenca'          && renderPresencaContent()}
            {activeTab === 'escalas'           && <EscalasManager userProfile={userProfile} />}
            {activeTab === 'avaliacoes'        && ['admin', 'coordinator'].includes(effectiveRole) && <AvaliacaoManager userProfile={userProfile} />}
            {activeTab === 'financeiro'        && <FinanceiroManager userProfile={userProfile} />}
            {activeTab === 'lanchonete'        && <LanchoneteManager />}
            {activeTab === 'usuarios'          && <UserManager currentUserRole={effectiveRole} />}
            {activeTab === 'configuracoes'     && <Configuracoes />}
            {activeTab === 'alterar-senha'     && <AlterarSenha />}
            {activeTab === 'reports'           && <Reports />}
          </Suspense>
        </Content>
      </Layout>

    </Layout>
  );
}

export default Dashboard;
