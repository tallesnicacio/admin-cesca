import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Edit2, Trash2, Plus, X, User, Mail, Shield, Lock } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { showToast } from './index';
import { ConfirmModal } from './Modal';
import './UserManager.css';

// Configuração: use Edge Function se estiver deployada, senão usa signUp
const USE_EDGE_FUNCTION = false; // Mude para true após fazer deploy da Edge Function

function UserManager() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, userId: null });
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, users]);

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
      showToast.error('Erro ao carregar usuários: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ email: '', name: '', role: 'user', password: '', confirmPassword: '' });
    setFormErrors({});
    setSelectedUser(null);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setFormData({
      email: user.email || '',
      name: user.name || '',
      role: user.role || 'user'
    });
    setFormErrors({});
    setSelectedUser(user);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ email: '', name: '', role: 'user', password: '', confirmPassword: '' });
    setFormErrors({});
    setSelectedUser(null);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email?.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }

    if (!formData.name?.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    // Validação de senha apenas para criação de usuário
    if (modalMode === 'create') {
      if (!formData.password?.trim()) {
        errors.password = 'Senha é obrigatória';
      } else if (formData.password.length < 6) {
        errors.password = 'Senha deve ter pelo menos 6 caracteres';
      }

      if (!formData.confirmPassword?.trim()) {
        errors.confirmPassword = 'Confirmação de senha é obrigatória';
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'As senhas não coincidem';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setModalLoading(true);

    try {
      if (modalMode === 'create') {
        if (USE_EDGE_FUNCTION) {
          // OPÇÃO 1: Usar Edge Function (requer deploy - mais seguro)
          const { data: functionData, error: functionError } = await supabase.functions.invoke('create-user', {
            body: {
              email: formData.email,
              name: formData.name,
              role: formData.role
            }
          });

          if (functionError) throw functionError;

          showToast.success(
            functionData.message || 'Usuário criado com sucesso! Email de confirmação enviado.',
            { duration: 5000 }
          );
        } else {
          // OPÇÃO 2: Usar signUp direto (funciona sem Edge Function)
          // IMPORTANTE: Criar usuário via frontend tem limitações de segurança
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password, // Senha fornecida pelo administrador
            options: {
              emailRedirectTo: window.location.origin + '/set-password',
              data: {
                name: formData.name,
                role: formData.role
              }
            }
          });

          if (authError) throw authError;

          if (authData.user) {
            // Atualizar perfil com informações adicionais
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: authData.user.id,
                email: formData.email,
                name: formData.name,
                role: formData.role,
                is_admin: formData.role === 'admin'
              }, {
                onConflict: 'id'
              });

            if (profileError) {
              console.warn('Aviso ao criar perfil:', profileError);
            }
          }

          showToast.success(
            'Usuário criado com sucesso! O usuário pode fazer login com a senha definida.',
            { duration: 5000 }
          );
        }
      } else {
        // Editar usuário existente
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            role: formData.role,
            is_admin: formData.role === 'admin'
          })
          .eq('id', selectedUser.id);

        if (error) throw error;
        showToast.success('Usuário atualizado com sucesso!');
      }

      closeModal();
      loadUsers();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);

      // Mensagens de erro mais amigáveis
      let errorMessage = 'Erro ao salvar usuário';

      if (error.message?.includes('already registered')) {
        errorMessage = 'Este email já está cadastrado no sistema';
      } else if (error.message?.includes('invalid email')) {
        errorMessage = 'Email inválido';
      } else if (error.message) {
        errorMessage = error.message;
      }

      showToast.error(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = (userId) => {
    setDeleteModal({ isOpen: true, userId });
  };

  const handleDeleteConfirm = async () => {
    setModalLoading(true);
    const userId = deleteModal.userId;

    try {
      // Nota: Excluir usuário do auth requer permissões especiais
      // Por enquanto, apenas marcamos como inativo no perfil
      const { error } = await supabase
        .from('profiles')
        .update({ active: false })
        .eq('id', userId);

      if (error) throw error;
      showToast.success('Usuário desativado com sucesso!');
      loadUsers();
      setDeleteModal({ isOpen: false, userId: null });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      showToast.error('Erro ao excluir usuário: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div className="user-manager">
      <Toaster position="top-right" />
      <div className="manager-header">
        <h2>Gerenciar Usuários</h2>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{users.length}</span>
          <span className="stat-label">Total de Usuários</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {users.filter(u => u.role === 'admin').length}
          </span>
          <span className="stat-label">Administradores</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {users.filter(u => u.role === 'user').length}
          </span>
          <span className="stat-label">Usuários</span>
        </div>
      </div>

      <div className="users-table">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : (
          <>
            {/* Cards para mobile */}
            {filteredUsers.map((user) => (
              <div key={`card-${user.id}`} className="user-card">
                <div className="user-card-header">
                  <div className="user-card-title">
                    <h3>{user.name || 'Sem nome'}</h3>
                    <p>{user.email}</p>
                  </div>
                  <span className={`role-badge ${user.role || 'user'}`}>
                    {user.role === 'admin' ? 'Admin' : 'Usuário'}
                  </span>
                </div>

                <div className="user-card-body">
                  <div className="user-card-field">
                    <label>Criado em</label>
                    <div className="value">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="user-card-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => openEditModal(user)}
                  >
                    <Edit2 size={18} />
                    Editar
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(user.id)}
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {/* Tabela para desktop */}
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Perfil</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name || 'Sem nome'}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-badge ${user.role || 'user'}`}>
                        {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                    <td>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => openEditModal(user)}
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => handleDelete(user.id)}
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {modalMode === 'create' ? (
                  <>
                    <Plus size={20} /> Novo Usuário
                  </>
                ) : (
                  <>
                    <Edit2 size={20} /> Editar Usuário
                  </>
                )}
              </h3>
              <button className="btn-icon" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form className="user-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>
                  <Mail size={16} /> Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={modalMode === 'edit'}
                  placeholder="usuario@exemplo.com"
                />
                {formErrors.email && <span className="error-text">{formErrors.email}</span>}
              </div>

              <div className="form-group">
                <label>
                  <User size={16} /> Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
                {formErrors.name && <span className="error-text">{formErrors.name}</span>}
              </div>

              {modalMode === 'create' && (
                <>
                  <div className="form-group">
                    <label>
                      <Lock size={16} /> Senha *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                    {formErrors.password && <span className="error-text">{formErrors.password}</span>}
                  </div>

                  <div className="form-group">
                    <label>
                      <Lock size={16} /> Confirmar Senha *
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Digite a senha novamente"
                      autoComplete="new-password"
                    />
                    {formErrors.confirmPassword && <span className="error-text">{formErrors.confirmPassword}</span>}
                  </div>
                </>
              )}

              <div className="form-group">
                <label>
                  <Shield size={16} /> Perfil *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, userId: null })}
        onConfirm={handleDeleteConfirm}
        title="Desativar usuário"
        message="Tem certeza que deseja desativar este usuário? O usuário não terá mais acesso ao sistema."
        confirmText="Sim, desativar"
        cancelText="Cancelar"
        type="warning"
        loading={modalLoading}
      />
    </div>
  );
}

export default UserManager;
