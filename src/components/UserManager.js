import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  Space,
  Tag,
  Row,
  Col,
  Spin,
  Empty,
  message,
  Typography,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { supabase } from '../supabaseClient';

const { Title, Text } = Typography;

const USE_EDGE_FUNCTION = false;

function UserManager() {
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Debounce search term para melhorar performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [modalMode, setModalMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      message.error('Erro ao carregar usuários: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (debouncedSearchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    form.resetFields();
    setSelectedUser(null);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    form.setFieldsValue({
      email: user.email || '',
      name: user.name || '',
      role: user.role || 'user'
    });
    setSelectedUser(user);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    form.resetFields();
    setSelectedUser(null);
  };

  const handleSubmit = async (values) => {
    setModalLoading(true);

    try {
      if (modalMode === 'create') {
        if (USE_EDGE_FUNCTION) {
          const { data: functionData, error: functionError } = await supabase.functions.invoke('create-user', {
            body: {
              email: values.email,
              name: values.name,
              role: values.role
            }
          });

          if (functionError) throw functionError;

          message.success(
            functionData.message || 'Usuário criado com sucesso! Email de confirmação enviado.',
            5
          );
        } else {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              emailRedirectTo: window.location.origin + '/set-password',
              data: {
                name: values.name,
                role: values.role
              }
            }
          });

          if (authError) throw authError;

          if (authData.user) {
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: authData.user.id,
                email: values.email,
                name: values.name,
                role: values.role,
                is_admin: values.role === 'admin'
              }, {
                onConflict: 'id'
              });

            if (profileError) {
              console.warn('Aviso ao criar perfil:', profileError);
            }
          }

          message.success('Usuário criado com sucesso!', 3);
        }
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: values.name,
            role: values.role,
            is_admin: values.role === 'admin'
          })
          .eq('id', selectedUser.id);

        if (error) throw error;
        message.success('Usuário atualizado com sucesso!');
      }

      closeModal();
      loadUsers();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);

      let errorMessage = 'Erro ao salvar usuário';

      if (error.message?.includes('already registered')) {
        errorMessage = 'Este email já está cadastrado no sistema';
      } else if (error.message?.includes('invalid email')) {
        errorMessage = 'Email inválido';
      } else if (error.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = (user) => {
    Modal.confirm({
      title: 'Desativar usuário',
      content: `Tem certeza que deseja desativar o usuário ${user.name}? O usuário não terá mais acesso ao sistema.`,
      okText: 'Sim, desativar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ active: false })
            .eq('id', user.id);

          if (error) throw error;
          message.success('Usuário desativado com sucesso!');
          loadUsers();
        } catch (error) {
          console.error('Erro ao excluir usuário:', error);
          message.error('Erro ao excluir usuário: ' + error.message);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name || 'Sem nome'}</Text>,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => <Text type="secondary">{email}</Text>,
      sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
    },
    {
      title: 'Perfil',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag
          color={role === 'admin' ? 'purple' : 'blue'}
          style={{ borderRadius: 6, fontWeight: 500 }}
        >
          {role === 'admin' ? 'Administrador' : 'Usuário'}
        </Tag>
      ),
      filters: [
        { text: 'Administrador', value: 'admin' },
        { text: 'Usuário', value: 'user' },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'Criado em',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => <Text type="secondary">{date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A'}</Text>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Title level={2} style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.5px' }}>
              Usuários
            </Title>
            <Text type="secondary" style={{ fontSize: 15 }}>
              Gerencie usuários e permissões do sistema
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            size="large"
            style={{ height: 48, paddingLeft: 24, paddingRight: 24, fontSize: 15, fontWeight: 500 }}
          >
            Novo Usuário
          </Button>
        </div>

        <Divider style={{ margin: '24px 0', borderColor: '#f0f0f0' }} />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <div
              style={{
                padding: 24,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #f0f0f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>Total de Usuários</Text>
              <div style={{ fontSize: 36, fontWeight: 600, marginTop: 8, color: '#1a1a1a' }}>
                {users.length}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div
              style={{
                padding: 24,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #f0f0f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>Administradores</Text>
              <div style={{ fontSize: 36, fontWeight: 600, marginTop: 8, color: '#667eea' }}>
                {users.filter(u => u.role === 'admin').length}
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div
              style={{
                padding: 24,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #f0f0f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>Usuários Comuns</Text>
              <div style={{ fontSize: 36, fontWeight: 600, marginTop: 8, color: '#3b82f6' }}>
                {users.filter(u => u.role === 'user').length}
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #f0f0f0',
          padding: 24,
        }}
      >
        <Input
          placeholder="Buscar por nome ou email..."
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="large"
          style={{ marginBottom: 24, borderRadius: 12 }}
          allowClear
        />

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} usuários` }}
          locale={{
            emptyText: <Empty description="Nenhum usuário encontrado" />
          }}
          style={{ overflow: 'hidden' }}
        />
      </div>

      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            {modalMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
          </Title>
        }
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ role: 'user' }}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="name"
            label="Nome Completo"
            rules={[{ required: true, message: 'Nome é obrigatório' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#999' }} />}
              placeholder="Nome completo do usuário"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email é obrigatório' },
              { type: 'email', message: 'Email inválido' }
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#999' }} />}
              placeholder="usuario@exemplo.com"
              disabled={modalMode === 'edit'}
              size="large"
            />
          </Form.Item>

          {modalMode === 'create' && (
            <>
              <Form.Item
                name="password"
                label="Senha"
                rules={[
                  { required: true, message: 'Senha é obrigatória' },
                  { min: 6, message: 'Senha deve ter pelo menos 6 caracteres' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#999' }} />}
                  placeholder="Mínimo 6 caracteres"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirmar Senha"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Confirmação de senha é obrigatória' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('As senhas não coincidem'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#999' }} />}
                  placeholder="Digite a senha novamente"
                  size="large"
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="role"
            label="Perfil"
            rules={[{ required: true, message: 'Perfil é obrigatório' }]}
          >
            <Select size="large" suffixIcon={<SafetyOutlined style={{ color: '#999' }} />}>
              <Select.Option value="user">Usuário</Select.Option>
              <Select.Option value="admin">Administrador</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={closeModal} size="large">
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={modalLoading} size="large">
                {modalMode === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserManager;
