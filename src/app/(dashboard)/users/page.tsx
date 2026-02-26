'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Users as UsersIcon,
    Mail,
    Shield,
    Trash2,
    Edit3,
    MoreVertical,
    Loader2,
    UserX,
} from 'lucide-react';
import styles from './users.module.css';

interface UserRow {
    id: string;
    full_name: string;
    email: string;
    role: string;
    created_at: string;
}

function getRoleBadge(role: string) {
    switch (role) {
        case 'super_admin':
            return { label: 'Super Admin', style: styles.roleSuperAdmin };
        case 'admin':
            return { label: 'Admin', style: styles.roleAdmin };
        case 'editor':
            return { label: 'Editor', style: styles.roleEditor };
        default:
            return { label: role, style: '' };
    }
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('editor');
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData) return;
        setCurrentUserRole(userData.role);

        if (userData.role === 'editor') {
            setLoading(false);
            return;
        }

        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('company_id', userData.company_id)
            .order('created_at', { ascending: false });

        setUsers(data || []);
        setLoading(false);
    }

    async function handleCreate() {
        if (!newName || !newEmail || !newPassword) return;
        setSaving(true);

        const res = await fetch('/api/v1/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: newName,
                email: newEmail,
                password: newPassword,
                role: newRole,
            }),
        });

        if (res.ok) {
            setShowModal(false);
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewRole('editor');
            fetchUsers();
        }
        setSaving(false);
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

        const res = await fetch(`/api/v1/admin/users?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchUsers();
    }

    return (
        <>
            <Topbar title="Usuarios" subtitle="Administración de usuarios del sistema" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Usuarios</h1>
                        <p className={styles.headerSubtext}>{users.length} usuarios registrados</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} />
                        Nuevo Usuario
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={20} className="loading-spinner" />
                        <span>Cargando usuarios...</span>
                    </div>
                ) : currentUserRole === 'editor' ? (
                    <div className="empty-state">
                        <Shield size={48} color="var(--accent)" />
                        <h3>Acceso Restringido</h3>
                        <p>Solo los administradores pueden gestionar usuarios.</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="empty-state">
                        <UserX size={48} />
                        <h3>Sin usuarios</h3>
                        <p>Aún no hay usuarios registrados en tu empresa.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Email</th>
                                    <th>Rol</th>
                                    <th>Fecha de registro</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const badge = getRoleBadge(user.role);
                                    return (
                                        <tr key={user.id}>
                                            <td>
                                                <div className={styles.userCell}>
                                                    <div className={styles.userAvatar}>
                                                        {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </div>
                                                    <span className={styles.userName}>{user.full_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.emailCell}>
                                                    <Mail size={14} className={styles.emailIcon} />
                                                    <span>{user.email}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${styles.roleBadge} ${badge.style}`}>
                                                    <Shield size={10} />
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.dateText}>
                                                    {new Date(user.created_at).toLocaleDateString('es-MX', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.actionBtns}>
                                                    <button className="btn btn-icon btn-danger btn-sm" title="Eliminar" onClick={() => handleDelete(user.id)}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nuevo Usuario</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="label">Nombre completo</label>
                            <input
                                className="input"
                                placeholder="ej. Juan Pérez"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Correo electrónico</label>
                            <input
                                className="input"
                                type="email"
                                placeholder="ej. juan@empresa.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Contraseña</label>
                            <input
                                className="input"
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Rol</label>
                            <select
                                className="select"
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                            >
                                <option value="editor">Editor de Contenido</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                                {saving ? <span className="loading-spinner"></span> : <Plus size={16} />}
                                Crear Usuario
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
