import React, { useState } from 'react';
import { Menu, Typography, Divider } from 'antd';
import {
  DollarOutlined,
  UserOutlined,
  BookOutlined,
  CreditCardOutlined,
  WalletOutlined,
  FileTextOutlined,
  PieChartOutlined,
} from '@ant-design/icons';

import AlunoManager from './AlunoManager';
import CursoManager from './CursoManager';
import MatriculaManager from './MatriculaManager';
import MensalidadeManager from './MensalidadeManager';
import CaixaManager from './CaixaManager';
import DespesaManager from './DespesaManager';

const { Title, Text } = Typography;

function FinanceiroManager({ userProfile }) {
  const [activeTab, setActiveTab] = useState('caixa');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { key: 'caixa', label: 'Caixa Diário', icon: <WalletOutlined /> },
    { key: 'mensalidades', label: 'Mensalidades', icon: <CreditCardOutlined /> },
    { key: 'alunos', label: 'Alunos', icon: <UserOutlined /> },
    { key: 'cursos', label: 'Cursos', icon: <BookOutlined /> },
    { key: 'matriculas', label: 'Matrículas', icon: <FileTextOutlined /> },
    { key: 'despesas', label: 'Despesas', icon: <DollarOutlined /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'caixa':
        return <CaixaManager userProfile={userProfile} />;
      case 'mensalidades':
        return <MensalidadeManager userProfile={userProfile} />;
      case 'alunos':
        return <AlunoManager userProfile={userProfile} />;
      case 'cursos':
        return <CursoManager userProfile={userProfile} />;
      case 'matriculas':
        return <MatriculaManager userProfile={userProfile} />;
      case 'despesas':
        return <DespesaManager userProfile={userProfile} />;
      default:
        return <CaixaManager userProfile={userProfile} />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <Title level={2} style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Gestão Financeira
        </Title>
        <Text type="secondary" style={{ fontSize: isMobile ? 13 : 15 }}>
          Sistema integrado de controle financeiro - Caixa, Mensalidades e Despesas
        </Text>
      </div>

      <Divider style={{ margin: isMobile ? '16px 0' : '24px 0', borderColor: '#f0f0f0' }} />

      {/* Tabs Navigation */}
      <Menu
        mode={isMobile ? 'vertical' : 'horizontal'}
        selectedKeys={[activeTab]}
        items={menuItems}
        onClick={({ key }) => setActiveTab(key)}
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

      {/* Tab Content */}
      <div
        style={{
          background: '#fff',
          borderRadius: isMobile ? 12 : 16,
          border: '1px solid #f0f0f0',
          padding: isMobile ? 16 : 24,
          minHeight: isMobile ? 300 : 500,
        }}
      >
        {renderTabContent()}
      </div>
    </div>
  );
}

// Componente de Visão Geral Financeira (placeholder)
function VisaoGeralFinanceira({ userProfile }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <PieChartOutlined style={{ fontSize: 64, color: '#6366f1', marginBottom: 16 }} />
      <Title level={2}>Visão Geral Financeira</Title>
      <Text type="secondary" style={{ fontSize: 15 }}>
        Dashboard com indicadores, gráficos e resumo financeiro será implementado em breve.
      </Text>
    </div>
  );
}

export default FinanceiroManager;
