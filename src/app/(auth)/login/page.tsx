'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Zap, ArrowRight, Eye, EyeOff } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const supabase = createClient();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError('Credenciales inválidas. Intenta de nuevo.');
            setLoading(false);
            return;
        }

        router.push('/');
        router.refresh();
    }

    return (
        <div className={styles.container}>
            {/* Decorative elements */}
            <div className={styles.bgGlow1}></div>
            <div className={styles.bgGlow2}></div>
            <div className={styles.bgGrid}></div>

            <div className={styles.card}>
                {/* Logo */}
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>
                        <Zap size={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h1 className={styles.logoTitle} style={{ marginBottom: '-4px' }}>SmartSignage</h1>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>by JPAT Digital</span>
                    </div>
                    <p className={styles.logoSubtitle}>
                        Gestión de señalización digital
                    </p>
                </div>

                {/* Divider */}
                <div className={styles.divider}></div>

                {/* Form */}
                <form onSubmit={handleLogin} className={styles.form}>
                    <div className="form-group">
                        <label className="label" htmlFor="email">
                            Correo electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            placeholder="tu@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label" htmlFor="password">
                            Contraseña
                        </label>
                        <div className={styles.passwordWrapper}>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className={styles.eyeBtn}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className={styles.errorMsg}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`btn btn-primary ${styles.submitBtn}`}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            <>
                                Iniciar Sesión
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                <p className={styles.footerText}>
                    Sistema de señalización digital empresarial
                </p>
            </div>
        </div>
    );
}
