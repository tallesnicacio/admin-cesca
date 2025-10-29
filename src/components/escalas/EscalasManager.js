import React, { useState } from 'react';
import { Menu, Typography, Divider } from 'antd';
import {
  ThunderboltOutlined,
  EyeOutlined,
  SettingOutlined,
  TeamOutlined,
  SafetyOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';

import TiposAtendimentoConfig from './TiposAtendimentoConfig';
import CapacitacoesManager from './CapacitacoesManager';
import FuncoesFixasConfig from './FuncoesFixasConfig';
import RestricoesManager from './RestricoesManager';
import GeradorEscalas from './GeradorEscalas';
import PainelRevisao from './PainelRevisao';
import SubstituicoesManager from './SubstituicoesManager';
// import PresencaEscalas from './PresencaEscalas';
// import RelatoriosEscalas from './RelatoriosEscalas';

const { Title, Text } = Typography;

function EscalasManager({ userProfile }) {
  const [activeTab, setActiveTab] = useState('gerador');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { key: 'gerador', label: 'Gerar Escalas', icon: <ThunderboltOutlined /> },
    { key: 'revisao', label: 'Revisar Escalas', icon: <EyeOutlined /> },
    { key: 'tipos', label: 'Tipos de Atendimento', icon: <SettingOutlined /> },
    { key: 'capacitacoes', label: 'Capacitações', icon: <SafetyOutlined /> },
    { key: 'funcoes', label: 'Funções Fixas', icon: <TeamOutlined /> },
    { key: 'restricoes', label: 'Restrições', icon: <StopOutlined /> },
    { key: 'substituicoes', label: 'Substituições', icon: <SwapOutlined /> },
  ];

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
      // case 'presenca':
      //   return <PresencaEscalas userProfile={userProfile} />;
      // case 'relatorios':
      //   return <RelatoriosEscalas userProfile={userProfile} />;
      default:
        return <GeradorEscalas userProfile={userProfile} />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <Title level={2} style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Gestão de Escalas
        </Title>
        <Text type="secondary" style={{ fontSize: isMobile ? 13 : 15 }}>
          Sistema inteligente de escalas para segundas e sextas-feiras
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

export default EscalasManager;
