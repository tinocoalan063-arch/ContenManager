'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Activity,
    Monitor,
    Clock,
    Search,
    Filter,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import styles from './logs.module.css';

interface LogEntry {
    id: string;
    player_id: string;
    event: string;
    details: any;
    created_at: string;
    players?: {
        name: string;
    } | { name: string }[] | null;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const supabase = createClient();

    useEffect(() => {
        fetchLogs();
    }, []);

    async function fetchLogs() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) return;

        const { data } = await supabase
            .from('player_logs')
            .select('*, players(name)')
            .order('created_at', { ascending: false })
            .limit(100);

        setLogs((data || []) as LogEntry[]);
        setLoading(false);
    }

    function getEventBadgeClass(event: string) {
        const e = event.toLowerCase();
        if (e.includes('error') || e.includes('fail')) return styles.eventError;
        if (e.includes('sync') || e.includes('update')) return styles.eventSync;
        if (e.includes('auth') || e.includes('login')) return styles.eventAuth;
        return styles.eventInfo;
    }

    function getPlayerName(log: LogEntry): string {
        if (!log.players) return 'Desconocido';
        const playerData = Array.isArray(log.players) ? log.players[0] : log.players;
        return playerData?.name || 'Desconocido';
    }

    const filteredLogs = logs.filter(log => {
        const name = getPlayerName(log).toLowerCase();
        const event = log.event.toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || event.includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || event.includes(filterType);
        return matchesSearch && matchesFilter;
    });

    return (
        <>
            <Topbar title="Eventos" subtitle="Registro de actividad de todos los players" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Actividad del Sistema</h1>
                        <p className={styles.headerSubtext}>Últimos 100 eventos registrados</p>
                    </div>
                    <div className="page-header-actions">
                        <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por player o evento..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="search-box" style={{ flex: 1, minWidth: '150px' }}>
                            <Filter size={16} />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', outline: 'none' }}
                            >
                                <option value="all">Todos</option>
                                <option value="sync">Sincronización</option>
                                <option value="error">Errores</option>
                                <option value="auth">Autenticación</option>
                            </select>
                        </div>
                        <button className="btn btn-secondary btn-sm btn-full-mobile" onClick={fetchLogs}>
                            <RefreshCw size={14} />
                            Actualizar
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={24} className="loading-spinner" />
                        <span>Cargando registros...</span>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Activity size={48} className={styles.emptyIcon} />
                        <h3>Sin eventos</h3>
                        <p>No se han encontrado registros que coincidan con los filtros.</p>
                    </div>
                ) : (
                    <div className="mobile-table-wrapper">
                        <div className="table-container">
                            <table className={styles.logTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '180px' }}>Fecha y Hora</th>
                                        <th style={{ width: '200px' }}>Player</th>
                                        <th style={{ width: '150px' }}>Evento</th>
                                        <th>Detalles</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log) => (
                                        <tr key={log.id} className={styles.logRow}>
                                            <td className={styles.timestamp}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={12} />
                                                    {new Date(log.created_at).toLocaleString('es-MX', {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                    })}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.playerCell}>
                                                    <Monitor size={14} className={styles.playerIcon} />
                                                    {getPlayerName(log)}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${styles.eventBadge} ${getEventBadgeClass(log.event)}`}>
                                                    {log.event}
                                                </span>
                                            </td>
                                            <td className={styles.detailsText} title={JSON.stringify(log.details)}>
                                                {typeof log.details === 'object'
                                                    ? JSON.stringify(log.details)
                                                    : String(log.details)
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

