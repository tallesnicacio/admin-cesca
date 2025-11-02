import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Badge, Drawer, Button, message } from 'antd';
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
  CalendarTwoTone,
  MenuOutlined,
} from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import AgendamentoManager from './AgendamentoManager';
import Configuracoes from './Configuracoes';
import Reports from './Reports';
import UserManager from './UserManager';
import TrabalhadorManager from './TrabalhadorManager';
import PresencaManager from './PresencaManager';
import PresencaReports from './PresencaReports';
import AdvertenciaManager from './AdvertenciaManager';
import FinanceiroManager from './financeiro/FinanceiroManager';
import EscalasManager from './escalas/EscalasManager';

const { Header, Content } = Layout;
const { Text } = Typography;

function Dashboard({ session }) {
  const [activeTab, setActiveTab] = useState('agendamentos');
  const [presencaSubTab, setPresencaSubTab] = useState('trabalhadores');
  const [userProfile, setUserProfile] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
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
      console.error('Erro ao carregar perfil:', error);
      message.error('Não foi possível carregar o perfil do usuário. Por favor, recarregue a página.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    {
      key: 'agendamentos',
      icon: <CalendarOutlined style={{ fontSize: 16 }} />,
      label: 'Agendamentos',
    },
    {
      key: 'presenca',
      icon: <CheckSquareOutlined style={{ fontSize: 16 }} />,
      label: 'Presença',
    },
    {
      key: 'escalas',
      icon: <CalendarTwoTone style={{ fontSize: 16 }} />,
      label: 'Escalas',
    },
    {
      key: 'financeiro',
      icon: <DollarOutlined style={{ fontSize: 16 }} />,
      label: 'Financeiro',
    },
    {
      key: 'usuarios',
      icon: <UserOutlined style={{ fontSize: 16 }} />,
      label: 'Usuários',
    },
    {
      key: 'reports',
      icon: <BarChartOutlined style={{ fontSize: 16 }} />,
      label: 'Relatórios',
    },
  ];

  const userMenuItems = [
    {
      key: 'configuracoes',
      icon: <SettingOutlined />,
      label: 'Configurações',
      onClick: () => setActiveTab('configuracoes'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sair',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }) => {
    setActiveTab(key);
    setDrawerVisible(false); // Fecha o drawer ao selecionar
  };

  const renderPresencaContent = () => {
    const items = [
      {
        key: 'trabalhadores',
        label: 'Trabalhadores',
        icon: <TeamOutlined />,
      },
      {
        key: 'presenca',
        label: 'Registrar',
        icon: <CheckSquareOutlined />,
      },
      {
        key: 'advertencias',
        label: 'Advertências',
        icon: <BellOutlined />,
      },
      {
        key: 'relatorios',
        label: 'Relatórios',
        icon: <BarChartOutlined />,
      },
    ];

    return (
      <>
        <Menu
          mode={isMobile ? 'vertical' : 'horizontal'}
          selectedKeys={[presencaSubTab]}
          items={items}
          onClick={({ key }) => setPresencaSubTab(key)}
          style={{
            marginBottom: isMobile ? 16 : 32,
            borderBottom: isMobile ? 'none' : '1px solid #f0f0f0',
            background: isMobile ? '#fafafa' : 'transparent',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 500,
            borderRadius: isMobile ? 12 : 0,
            padding: isMobile ? 8 : 0,
            border: isMobile ? '1px solid #f0f0f0' : 'none',
          }}
        />
        {presencaSubTab === 'trabalhadores' && <TrabalhadorManager />}
        {presencaSubTab === 'presenca' && <PresencaManager userProfile={userProfile} />}
        {presencaSubTab === 'advertencias' && <AdvertenciaManager userProfile={userProfile} />}
        {presencaSubTab === 'relatorios' && <PresencaReports />}
      </>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#fafafa' }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: isMobile ? '0 16px' : '0 32px',
          height: isMobile ? 56 : 64,
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 48, flex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 14 : 16,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              C
            </div>
            {!isMobile && (
              <Text
                strong
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '-0.5px',
                }}
              >
                Admin CESCA
              </Text>
            )}
          </div>

          {/* Menu Desktop */}
          {!isMobile && (
            <Menu
              mode="horizontal"
              selectedKeys={[activeTab]}
              items={menuItems}
              onClick={handleMenuClick}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: 14,
                fontWeight: 500,
              }}
            />
          )}
        </div>

        {/* Right side */}
        <Space size={isMobile ? 12 : 24}>
          {!isMobile && (
            <Badge count={0} showZero={false}>
              <BellOutlined style={{ fontSize: 20, color: '#666', cursor: 'pointer' }} />
            </Badge>
          )}

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                style={{ backgroundColor: '#667eea' }}
                icon={<UserOutlined />}
                size={isMobile ? 32 : 36}
              />
              {!isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Text strong style={{ fontSize: 14, lineHeight: 1.2 }}>
                    {userProfile?.name || 'Usuário'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.2 }}>
                    {userProfile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </Text>
                </div>
              )}
            </Space>
          </Dropdown>

          {/* Menu Mobile */}
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setDrawerVisible(true)}
              style={{ padding: '4px 8px' }}
            />
          )}
        </Space>
      </Header>

      {/* Drawer Mobile Menu */}
      <Drawer
        title="Menu"
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="vertical"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            border: 'none',
            fontSize: 15,
            fontWeight: 500,
          }}
        />
      </Drawer>

      <Content
        style={{
          padding: isMobile ? '16px' : '32px 48px',
          maxWidth: 1440,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {activeTab === 'agendamentos' && <AgendamentoManager userProfile={userProfile} />}
        {activeTab === 'presenca' && renderPresencaContent()}
        {activeTab === 'escalas' && <EscalasManager userProfile={userProfile} />}
        {activeTab === 'financeiro' && <FinanceiroManager userProfile={userProfile} />}
        {activeTab === 'usuarios' && <UserManager />}
        {activeTab === 'configuracoes' && <Configuracoes />}
        {activeTab === 'reports' && <Reports />}
      </Content>
    </Layout>
  );
}

export default Dashboard;
