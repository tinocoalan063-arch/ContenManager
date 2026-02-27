'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, User, Building, HardDrive, Shield, Palette, Image as LucideImage } from 'lucide-react';
import styles from './settings.module.css';

interface SettingsClientProps {
    userId: string;
    isAdmin: boolean;
}

export default function SettingsClient({ userId, isAdmin }: SettingsClientProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingCompany, setSavingCompany] = useState(false);
    const [modalMessage, setModalMessage] = useState<{ title: string, message: string, type: 'success' | 'error' } | null>(null);

    // Profile State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Company State
    const [companyName, setCompanyName] = useState('');
    const [timezone, setTimezone] = useState('America/Mexico_City');
    const [storageUsed, setStorageUsed] = useState(0);
    const [storageLimit, setStorageLimit] = useState(5120); // 5GB default

    // Branding State
    const [appName, setAppName] = useState('');
    const [theme, setTheme] = useState('dark');
    const [accentColor, setAccentColor] = useState('#8b46ff'); // Default purple
    const [logoBase64, setLogoBase64] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);

        // Fetch user data via Supabase generic route or direct DB logic here since it's client-side
        // But for cleaner architecture matching our plan, we'll fetch the company endpoint first
        if (isAdmin) {
            const res = await fetch('/api/v1/settings/company');
            if (res.ok) {
                const json = await res.json();
                if (json.data) {
                    setCompanyName(json.data.name || '');
                    if (json.data.settings?.timezone) {
                        setTimezone(json.data.settings.timezone);
                    }
                    if (json.data.settings?.branding) {
                        const b = json.data.settings.branding;
                        if (b.appName) setAppName(b.appName);
                        if (b.theme) setTheme(b.theme);
                        if (b.accentColor) setAccentColor(b.accentColor);
                        if (b.logoBase64) setLogoBase64(b.logoBase64);
                    }
                    const limit = json.data.storage_limit_mb || json.data.max_storage_mb || 5120;
                    setStorageLimit(limit);
                    setStorageUsed(json.data.total_used_bytes || 0);
                }
            }
        }

        // To get basic profile data without writing a specific GET endpoint for it
        // We can just rely on Supabase client directly since RLS allows self-read
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: userData } = await supabase.from('users').select('full_name, email').eq('id', userId).single();
        if (userData) {
            setFullName(userData.full_name || '');
            setEmail(userData.email || '');
        }

        setLoading(false);
    }

    async function handleSaveProfile() {
        setSavingProfile(true);
        const body: any = { full_name: fullName, email };
        if (password) body.password = password;

        const res = await fetch('/api/v1/settings/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            setModalMessage({ title: '¡Éxito!', message: 'Perfil actualizado exitosamente.', type: 'success' });
            setPassword(''); // Clear password field after save
        } else {
            const data = await res.json();
            setModalMessage({ title: 'Error al guardar', message: data.error || 'Ocurrió un error inesperado.', type: 'error' });
        }
        setSavingProfile(false);
    }

    async function handleSaveCompany() {
        if (!isAdmin) return;
        setSavingCompany(true);

        const body = {
            name: companyName,
            settings: {
                timezone,
                branding: { appName, theme, accentColor, logoBase64 }
            }
        };

        const res = await fetch('/api/v1/settings/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            setModalMessage({ title: '¡Guardado!', message: 'Ajustes de la organización guardados exitosamente.', type: 'success' });
            router.refresh();
        } else {
            const data = await res.json();
            setModalMessage({ title: 'Error al guardar', message: data.error || 'Ocurrió un error inesperado.', type: 'error' });
        }
        setSavingCompany(false);
    }

    if (loading) {
        return (
            <div className="loading-state">
                <Loader2 size={24} className="loading-spinner" />
                <span>Cargando configuración...</span>
            </div>
        );
    }

    // Calculate Storage progress
    const usedMB = storageUsed / (1024 * 1024);
    const progressPercent = Math.min(100, Math.max(0, (usedMB / storageLimit) * 100));
    const isNearingLimit = progressPercent > 85;

    return (
        <div className={styles.settingsGrid}>

            {/* --- PERSONAL PROFILE --- */}
            <div className={styles.settingsCard}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}><User size={20} /></div>
                    <h2>Mi Perfil</h2>
                </div>
                <div className={styles.cardBody}>
                    <div className="form-group">
                        <label className="label">Nombre completo</label>
                        <input
                            className="input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="label">Correo electrónico</label>
                        <input
                            className="input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="label">Cambiar Contraseña</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="Dejar en blanco para conservar actual"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <span className={styles.fieldHint}>La sesión no se cerrará al actualizarla.</span>
                    </div>

                    <div className={styles.cardActions}>
                        <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                            {savingProfile ? <Loader2 size={16} className="loading-spinner" /> : <Save size={16} />}
                            Guardar Perfil
                        </button>
                    </div>
                </div>
            </div>

            {/* --- COMPANY PROFILE (Admins only) --- */}
            {isAdmin ? (
                <div className={styles.settingsCard}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}><Building size={20} /></div>
                        <h2>Organización</h2>
                    </div>
                    <div className={styles.cardBody}>

                        {/* Storage Widget */}
                        <div className={styles.storageWidget}>
                            <div className={styles.storageHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <HardDrive size={18} />
                                    <span style={{ fontWeight: 500 }}>Almacenamiento en Nube</span>
                                </div>
                                <span className={styles.storageText}>
                                    {usedMB.toFixed(2)} MB / {storageLimit} MB
                                </span>
                            </div>
                            <div className={styles.progressBarBg}>
                                <div
                                    className={`${styles.progressBarFill} ${isNearingLimit ? styles.progressBarDanger : ''}`}
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                            <span className={styles.fieldHint}>Incluye todo el peso de tu Biblioteca de Medios.</span>
                        </div>

                        <div className={styles.divider}></div>

                        <div className="form-group">
                            <label className="label">Nombre de la Empresa</label>
                            <input
                                className="input"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Zona Horaria (Timezone)</label>
                            <select
                                className="select"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                            >
                                <option value="America/Mexico_City">Ciudad de México (CDMX)</option>
                                <option value="America/Monterrey">Monterrey</option>
                                <option value="America/Tijuana">Tijuana</option>
                                <option value="America/Chihuahua">Chihuahua</option>
                                <option value="America/Los_Angeles">Pacífico (US/CA) - Los Angeles</option>
                                <option value="America/New_York">Este (US/CA) - New York</option>
                                <option value="America/Bogota">Bogotá / Lima / Quito</option>
                                <option value="America/Buenos_Aires">Buenos Aires</option>
                                <option value="Europe/Madrid">Madrid (CET)</option>
                                <option value="UTC">UTC Universal</option>
                            </select>
                            <span className={styles.fieldHint}>
                                Determina cómo se evalúan las lógicas de tiempo de las listas de reproducción en tus pantallas.
                            </span>
                        </div>

                        <div className={styles.cardActions}>
                            <button className="btn btn-primary" onClick={handleSaveCompany} disabled={savingCompany}>
                                {savingCompany ? <Loader2 size={16} className="loading-spinner" /> : <Save size={16} />}
                                Guardar Organización
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* --- PERSONALIZATION / BRANDING (Admins only) --- */}
            {isAdmin ? (
                <div className={styles.settingsCard}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}><Palette size={20} /></div>
                        <h2>Personalización</h2>
                    </div>
                    <div className={styles.cardBody}>

                        <div className="form-group">
                            <label className="label">Nombre de la Aplicación</label>
                            <input
                                className="input"
                                value={appName}
                                placeholder="Ej. Panel Dental Digital"
                                onChange={(e) => setAppName(e.target.value)}
                            />
                            <span className={styles.fieldHint}>Se mostrará en la navegación arriba del sello de JPAT Digital. Dejar en blanco para usar "SmartSignage".</span>
                        </div>

                        <div className="form-group">
                            <label className="label">Esquema de Colores (Tema)</label>
                            <select
                                className="select"
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                            >
                                <option value="dark">Modo Oscuro (Por Defecto)</option>
                                <option value="light">Modo Claro</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Color Principal (Accent Color)</label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={accentColor}
                                    onChange={(e) => setAccentColor(e.target.value)}
                                    style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                                />
                                <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{accentColor}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="label">Logo Personalizado</label>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                                }}>
                                    {logoBase64 ? (
                                        <img src={logoBase64} alt="Logo Prev" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <LucideImage size={24} color="var(--text-muted)" />
                                    )}
                                </div>
                                <div>
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/svg+xml"
                                        style={{ display: 'none' }}
                                        id="logo-upload"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (file.size > 500 * 1024) {
                                                setModalMessage({ title: 'Error', message: 'La imagen debe ser menor a 500KB', type: 'error' });
                                                return;
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setLogoBase64(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                        }}
                                    />
                                    <label htmlFor="logo-upload" className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer', marginBottom: '4px' }}>
                                        Elegir Imagen
                                    </label>
                                    <p className={styles.fieldHint} style={{ margin: 0 }}>PNG, JPG o SVG. Máx 500KB. Ideal cuadrada o transparente.</p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.cardActions}>
                            <button className="btn btn-primary" onClick={handleSaveCompany} disabled={savingCompany}>
                                {savingCompany ? <Loader2 size={16} className="loading-spinner" /> : <Save size={16} />}
                                Guardar Personalización
                            </button>
                        </div>

                    </div>
                </div>
            ) : (
                <div className={styles.settingsCard}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}><Shield size={20} /></div>
                        <h2>Organización</h2>
                    </div>
                    <div className={styles.cardBody} style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <Shield size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <h3 style={{ marginBottom: '8px' }}>Acceso Limitado</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Solo los administradores pueden modificar los parámetros de la empresa y la zona horaria.
                        </p>
                    </div>
                </div>
            )}

            {/* Custom Modal for Alerts */}
            {modalMessage && (
                <div className="modal-overlay" onClick={() => setModalMessage(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: modalMessage.type === 'success' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: modalMessage.type === 'success' ? '#34d399' : '#ef4444'
                        }}>
                            {modalMessage.type === 'success' ? <Shield size={24} /> : <div style={{ fontWeight: 'bold', fontSize: '20px' }}>!</div>}
                        </div>
                        <h2 style={{ marginBottom: '8px' }}>{modalMessage.title}</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{modalMessage.message}</p>
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setModalMessage(null)}>
                            Aceptar
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
