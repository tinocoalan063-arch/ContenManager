'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/ui/Topbar';
import {
    BarChart3,
    TrendingUp,
    Play,
    Clock,
    Loader2,
    Filter,
    Download
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar
} from 'recharts';
import styles from './analytics.module.css';

interface AnalyticsData {
    totalPlays: number;
    dailyData: { date: string, count: number }[];
    distributionData: { name: string, value: number }[];
    topMediaData: { name: string, count: number }[];
}

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#facc15'];

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('7');

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    async function fetchAnalytics() {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/admin/analytics/summary?days=${period}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading && !data) {
        return (
            <>
                <Topbar title="Estadísticas" subtitle="Reportes de reproducción y rendimiento" />
                <div className="loading-state">
                    <Loader2 size={24} className="loading-spinner" />
                    <span>Cargando reportes...</span>
                </div>
            </>
        );
    }

    return (
        <>
            <Topbar title="Estadísticas" subtitle="Reportes de reproducción y rendimiento" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Reportes de Reproducción</h1>
                        <p className={styles.statLabel}>Proof of Play y métricas de red</p>
                    </div>
                    <div className="page-header-actions">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={14} className={styles.statLabel} />
                            <select
                                className={styles.periodSelect}
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                            >
                                <option value="1">Últimas 24h</option>
                                <option value="7">Últimos 7 días</option>
                                <option value="30">Últimos 30 días</option>
                            </select>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                            <Download size={14} />
                            Exportar PDF
                        </button>
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="glass-card stat-card">
                        <div className="stat-icon"><Play size={20} /></div>
                        <div className="stat-info">
                            <h3>{data?.totalPlays || 0}</h3>
                            <p>Reproducciones Totales</p>
                        </div>
                    </div>
                    <div className="glass-card stat-card">
                        <div className="stat-icon"><TrendingUp size={20} /></div>
                        <div className="stat-info">
                            <h3>{Math.round((data?.totalPlays || 0) / parseInt(period))}</h3>
                            <p>Promedio Diario</p>
                        </div>
                    </div>
                    <div className="glass-card stat-card">
                        <div className="stat-icon"><Clock size={20} /></div>
                        <div className="stat-info">
                            <h3>99.9%</h3>
                            <p>Uptime Global</p>
                        </div>
                    </div>
                </div>

                <div className={styles.grid}>
                    {/* Activity Chart */}
                    <div className={`glass-card ${styles.fullWidth} ${styles.section}`}>
                        <div className={styles.chartHeader}>
                            <h2>Actividad de Reproducción</h2>
                            <BarChart3 size={16} className={styles.statLabel} />
                        </div>
                        {data?.totalPlays === 0 ? (
                            <div className={styles.emptyChart}>
                                <TrendingUp size={32} />
                                <p>Sin actividad reciente en este periodo</p>
                            </div>
                        ) : (
                            <div className={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data?.dailyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="rgba(255,255,255,0.4)"
                                            fontSize={12}
                                            tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                        />
                                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#a78bfa' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke="#a78bfa"
                                            strokeWidth={3}
                                            dot={{ fill: '#a78bfa', strokeWidth: 2, r: 4 }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Distribution Chart */}
                    <div className={`glass-card ${styles.section}`}>
                        <h2>Distribución de Media</h2>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data?.distributionData.filter(d => d.value > 0)}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {data?.distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Content */}
                    <div className={`glass-card ${styles.section}`}>
                        <h2>Top Contenido</h2>
                        <div className={styles.tableSection}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Archivo</th>
                                        <th style={{ textAlign: 'right' }}>Vistas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.topMediaData.map((item, i) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '0.85rem' }}>{item.name}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                                                {item.count.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {data?.topMediaData.length === 0 && (
                                        <tr>
                                            <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                                Sin datos suficientes
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
