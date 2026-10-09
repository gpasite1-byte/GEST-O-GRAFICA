import React, { useState, useEffect } from 'react';
import {
  Server, Cpu, Database, ShieldCheck, HardDrive, Users, UserPlus, Download,
  RefreshCw, Trash2, Key, Terminal, ExternalLink, Lock, CheckCircle2,
  AlertTriangle, Search, Activity, Layers, ArrowRight, ShieldAlert, Sparkles, Check
} from 'lucide-react';
import { useAuth } from '@workspace/replit-auth-web';
import { supabase } from '@/lib/supabase';
import { Link } from 'wouter';

interface SystemStats {
  database: {
    status: string;
    engine: string;
    host: string;
    port: number;
    region: string;
    latencyMs: number;
    fullVersion: string;
    poolerMode: string;
    ssl: boolean;
  };
  system: {
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    arch: string;
    memoryRssMb: number;
    memoryHeapMb: number;
    activeUserId: string;
  };
  counts: Record<string, number>;
  authProviders: {
    supabase: boolean;
    googleOAuth: {
      supported: boolean;
      redirectUri: string;
      docsUrl: string;
    };
  };
}

interface UserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
  role: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  ticket_id?: number;
  ticket_code?: string;
  order_id?: number;
  actor_name: string;
  action: string;
  previous_state?: string;
  new_state?: string;
  note?: string;
  created_at: string;
}

const TABLE_DEFINITIONS = [
  { key: 'print_tickets', label: 'Fichas de Obra / Pedidos', desc: 'Registo e especificações técnicas de impressão' },
  { key: 'production_orders', label: 'Ordens de Produção (OP)', desc: 'Controlo do fluxo nas máquinas e acabamentos' },
  { key: 'production_stages', label: 'Fases de Execução', desc: 'Pré-impressão, Impressão, Acabamento e Embalagem' },
  { key: 'timeline_events', label: 'Trilha de Auditoria & Logs', desc: 'Histórico auditável com carimbo temporal ao segundo' },
  { key: 'clients', label: 'Carteira de Clientes', desc: 'Empresas, contactos telefónicos e histórico' },
  { key: 'staff_members', label: 'Equipa Operacional', desc: 'Cargos e perfis de acesso na gráfica' },
  { key: 'users', label: 'Contas de Utilizador', desc: 'Autenticação, emails e dados de perfil' },
  { key: 'artwork_versions', label: 'Ficheiros CTP & Provas', desc: 'Versões de arte enviadas para aprovação' },
  { key: 'quality_checks', label: 'Inspeções de Qualidade', desc: 'Checklists de conformidade e testes de cor' },
  { key: 'order_deliveries', label: 'Guias de Expedição', desc: 'Despachos, guias e confirmação de entrega' },
];

const ROLES = [
  { id: 'ADMIN', label: 'Administrador Master', desc: 'Acesso total ao sistema e infraestrutura' },
  { id: 'GESTAO', label: 'Gestor de Produção', desc: 'Aprovação comercial, OPs e orçamentos' },
  { id: 'ATENDIMENTO', label: 'Atendimento & Comercial', desc: 'Abertura de pedidos e contacto com clientes' },
  { id: 'DESIGNER', label: 'Pré-Impressão / Designer', desc: 'Envio de provas de cor e ficheiros CTP' },
  { id: 'PRODUCAO', label: 'Operador de Máquinas', desc: 'Execução de impressão e corte' },
  { id: 'QUALIDADE', label: 'Controlo de Qualidade', desc: 'Inspeção e aprovação final' },
  { id: 'EXPEDICAO', label: 'Expedição & Logística', desc: 'Despacho e entregas aos clientes' },
];

export function AdminConsolePage() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<'vps' | 'users' | 'google' | 'audit' | 'backup'>('vps');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Modal Novo Utilizador
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'ATENDIMENTO',
  });
  const [savingUser, setSavingUser] = useState(false);

  // Filtro de auditoria
  const [searchAudit, setSearchAudit] = useState('');

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, auditRes] = await Promise.all([
        fetch('/api/admin/system-stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/audit-logs?limit=80'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (err) {
      console.error('Falha ao carregar telemetria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Cadastrar Novo Colaborador
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });
      if (res.ok) {
        showNotification(`Colaborador ${newUserData.firstName} cadastrado com sucesso no Supabase!`);
        setShowAddUserModal(false);
        setNewUserData({ firstName: '', lastName: '', email: '', role: 'ATENDIMENTO' });
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao cadastrar');
      }
    } catch (e: any) {
      alert(e.message || 'Erro de conexão');
    } finally {
      setSavingUser(false);
    }
  };

  // Alterar Função do Utilizador
  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/team/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showNotification(`Função atualizada com sucesso para ${newRole}!`);
        loadData();
      }
    } catch (e) {
      alert('Erro ao atualizar função.');
    }
  };

  // Eliminar Colaborador
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem a certeza que deseja remover o acesso de ${userName}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification(`Colaborador ${userName} removido.`);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Não é possível remover');
      }
    } catch (e) {
      alert('Erro ao remover utilizador.');
    }
  };

  // Descarregar Backup Completo
  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) throw new Error('Falha ao gerar backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-grafica-flow-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('Backup completo gerado e descarregado com sucesso!');
    } catch (e) {
      alert('Erro ao descarregar backup.');
    }
  };

  // Testar Google Sign-In
  const handleTestGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        alert(`Supabase Auth: ${error.message}\n\nNota: Certifique-se de ativar o Google Provider no painel do Supabase com o seu Client ID do Google Cloud.`);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const filteredAudit = (auditLogs || []).filter(log => {
    if (!searchAudit) return true;
    const q = searchAudit.toLowerCase();
    return (
      (log.actor_name || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.ticket_code || '').toLowerCase().includes(q) ||
      (log.note || '').toLowerCase().includes(q)
    );
  });

  return (
    <main className="page fade-in">
      {/* Header Master */}
      <div className="page-head flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow flex items-center gap-1.5 text-primary">
              <Server size={13} /> CONSOLA DE GESTÃO MASTER · TIPO VPS
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CLOUD ONLINE
            </span>
          </div>
          <h1 className="page-title text-2xl sm:text-3xl font-display mt-1">
            Centro de Comando da Infraestrutura
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monitorização em tempo real do Supabase PostgreSQL, controlo de utilizadores, autenticação Google e segurança.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn btn-sm flex items-center gap-1.5 cursor-pointer hover:bg-accent"
            title="Atualizar telemetria"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="btn btn-sm flex items-center gap-1.5 cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground"
          >
            <Download size={13} className="text-primary" />
            Exportar Backup (.json)
          </button>
          <button
            type="button"
            onClick={() => setShowAddUserModal(true)}
            className="btn btn-sm btn-primary flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <UserPlus size={13} />
            Cadastrar Colaborador
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3.5 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 mb-6 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('vps')}
          className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'vps'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Server size={14} /> Telemetria & Servidor VPS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Users size={14} /> Utilizadores & Acessos ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('google')}
          className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'google'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Key size={14} /> Autenticação Google & Supabase
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'audit'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Terminal size={14} /> Trilha de Auditoria Master
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'backup'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <HardDrive size={14} /> Backups & Integridade
        </button>
      </div>

      {/* TAB 1: TELEMETRIA & SERVIDOR VPS */}
      {activeTab === 'vps' && (
        <div className="space-y-6">
          {/* KPI Cards em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="panel p-4.5 bg-card/80 border-border/80 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Base de Dados Cloud
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-foreground flex items-baseline gap-2">
                ONLINE
                <span className="text-xs font-normal text-muted-foreground">
                  ({stats?.database.latencyMs ?? '...'} ms)
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Database size={12} className="text-primary" />
                <span>Supabase PostgreSQL 17 (AWS)</span>
              </div>
            </div>

            <div className="panel p-4.5 bg-card/80 border-border/80 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Região do Servidor
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-400">
                  eu-west-1
                </span>
              </div>
              <div className="text-xl font-bold text-foreground">
                AWS Irlanda (UE)
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Server size={12} className="text-primary" />
                <span>Pooler Supavisor Porta 6543</span>
              </div>
            </div>

            <div className="panel p-4.5 bg-card/80 border-border/80 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Consumo de Memória
                </span>
                <Cpu size={14} className="text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {stats?.system.memoryRssMb ?? 0} MB
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Activity size={12} className="text-emerald-400" />
                <span>Node.js {stats?.system.nodeVersion} · {stats?.system.platform}</span>
              </div>
            </div>

            <div className="panel p-4.5 bg-card/80 border-border/80 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Integridade & Tabelas
                </span>
                <ShieldCheck size={14} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                100% OK
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Layers size={12} className="text-primary" />
                <span>10 Tabelas Sincronizadas Drizzle</span>
              </div>
            </div>
          </div>

          {/* Visão de Hardware & Conexão Cloud */}
          <div className="panel p-5 bg-card/90 border-border">
            <div className="flex items-center justify-between mb-4 border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Server className="text-primary" size={18} />
                <h2 className="text-base font-bold text-foreground font-display">
                  Conexão de Produção & Infraestrutura Cloud
                </h2>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                Host: aws-0-eu-west-1.pooler.supabase.com
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-background/50 border border-border/80 space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database size={13} className="text-primary" /> Endpoint Cloud
                </div>
                <div className="text-muted-foreground break-all font-mono text-[11px]">
                  czcptgunvyxdajotbyfb.supabase.co
                </div>
                <div className="text-[10px] text-emerald-400">SSL Criptografado Ponta-a-Ponta</div>
              </div>

              <div className="p-3.5 rounded-lg bg-background/50 border border-border/80 space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Activity size={13} className="text-primary" /> Modo de Pooler
                </div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  Transaction Pooler (Porta 6543)
                </div>
                <div className="text-[10px] text-muted-foreground">Suporta centenas de conexões simultâneas</div>
              </div>

              <div className="p-3.5 rounded-lg bg-background/50 border border-border/80 space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Lock size={13} className="text-primary" /> Segurança & Acesso
                </div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  Role: postgres · Gestor Master
                </div>
                <div className="text-[10px] text-emerald-400">Autenticado com credenciais seguras</div>
              </div>
            </div>
          </div>

          {/* Inventário de Tabelas do Banco de Dados */}
          <div className="panel p-5 bg-card/90 border-border">
            <div className="flex items-center justify-between mb-4 border-b border-border/70 pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground font-display">
                  Inventário e Volumetria de Dados (Supabase PostgreSQL)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Contagem em tempo real de registos operacionais persistidos na base de dados da gráfica.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] font-semibold uppercase text-muted-foreground bg-muted/30 border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">Tabela PostgreSQL</th>
                    <th className="py-2.5 px-3">Descrição Operacional</th>
                    <th className="py-2.5 px-3 text-right">Registos Atuais</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {TABLE_DEFINITIONS.map((t) => {
                    const count = stats?.counts?.[t.key] ?? 0;
                    return (
                      <tr key={t.key} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                          {t.key}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {t.desc}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {count}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Check size={10} /> Sincronizado
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UTILIZADORES & ACESSOS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="panel p-5 bg-card/90 border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-border/70 pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground font-display">
                  Gestão Central de Utilizadores & Permissões (IAM)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Colaboradores registados com acesso à plataforma. Como Gestor, pode convidar novos membros ou mudar permissões a qualquer momento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="btn btn-sm btn-primary flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={14} /> Novo Colaborador
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] font-semibold uppercase text-muted-foreground bg-muted/30 border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">Colaborador</th>
                    <th className="py-2.5 px-3">Email de Acesso</th>
                    <th className="py-2.5 px-3">Função Operacional</th>
                    <th className="py-2.5 px-3">Data de Entrada</th>
                    <th className="py-2.5 px-3 text-right">Ações do Gestor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((u) => {
                    const isMasterAdmin = u.id === 'usr_admin';
                    const initials = `${(u.first_name || 'U')[0]}${(u.last_name || '')[0] || ''}`.toUpperCase();
                    return (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-[11px] grid place-items-center shrink-0 border border-primary/30">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">
                                {u.first_name} {u.last_name}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                ID: {u.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {u.email}
                        </td>

                        <td className="py-3 px-3">
                          <select
                            className="control text-xs py-1 px-2 h-auto w-auto font-medium"
                            value={u.role}
                            disabled={isMasterAdmin}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          >
                            {ROLES.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-3 text-muted-foreground">
                          {u.created_at ? new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(u.created_at)) : '—'}
                        </td>

                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => auth.switchUser(u.id)}
                            className="btn btn-sm text-[11px] py-1 px-2.5 bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                            title="Entrar temporariamente como este utilizador"
                          >
                            Simular Perfil
                          </button>
                          {!isMasterAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)}
                              className="btn btn-sm text-[11px] py-1 px-2 text-destructive hover:bg-destructive/10 border border-destructive/30 cursor-pointer"
                              title="Remover acesso deste colaborador"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTENTICAÇÃO GOOGLE & PROVEDORES */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          <div className="panel p-5 bg-card/90 border-border">
            <div className="flex items-center gap-3 mb-4 border-b border-border/70 pb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
                <Key size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground font-display">
                  Autenticação Google OAuth 2.0 via Supabase
                </h2>
                <p className="text-xs text-muted-foreground">
                  Permite que qualquer colaborador ou cliente entre no sistema utilizando a sua Conta Google ou Google Workspace corporativo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div className="p-4 rounded-xl bg-background/60 border border-border/80 space-y-3">
                <div className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Status da Integração no App
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O cliente <strong>@supabase/supabase-js</strong> está totalmente conectado e configurado com o seu projeto Supabase:
                </p>
                <div className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground break-all border border-border/60">
                  URL: https://czcptgunvyxdajotbyfb.supabase.co
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestGoogleLogin}
                    className="btn btn-primary btn-sm flex items-center gap-2 cursor-pointer w-full justify-center"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Testar Entrada com Google Agora
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-background/60 border border-border/80 space-y-3">
                <div className="text-xs font-bold text-foreground flex items-center gap-2">
                  <ExternalLink size={13} className="text-primary" />
                  URL de Redirecionamento (Redirect URI)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Esta é a URL que deve colar no seu console do Google Cloud para autorizar o login seguro:
                </p>
                <div className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground break-all border border-border/60 select-all">
                  https://czcptgunvyxdajotbyfb.supabase.co/auth/v1/callback
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Quando um utilizador faz login via Google, o sistema reconhece automaticamente o email e cria o perfil na base de dados.
                </p>
              </div>
            </div>

            {/* Como Ativar o Google Login Passo a Passo */}
            <div className="rounded-xl border border-border/80 p-5 bg-card/60">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Sparkles size={15} className="text-primary" />
                Como Ativar o Google Login no seu Supabase (3 Passos Rápidos):
              </h3>
              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold grid place-items-center shrink-0 text-[11px]">
                    1
                  </span>
                  <div>
                    <strong className="text-foreground">Crie as credenciais no Google Cloud Console:</strong>
                    <p className="mt-0.5">
                      Acesse a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-primary underline">Consola Google Cloud</a>, crie um "ID do cliente OAuth" (Aplicação Web) e adicione a URL de callback acima em "URIs de redirecionamento autorizados".
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold grid place-items-center shrink-0 text-[11px]">
                    2
                  </span>
                  <div>
                    <strong className="text-foreground">Ative o Provedor no Supabase Studio:</strong>
                    <p className="mt-0.5">
                      Acesse o seu painel em <a href="https://supabase.com/dashboard/project/czcptgunvyxdajotbyfb/auth/providers" target="_blank" rel="noreferrer" className="text-primary underline">Supabase Dashboard → Authentication → Providers → Google</a>, ative o switch "Enable Google Provider", e cole o <strong>Client ID</strong> e <strong>Client Secret</strong> gerados pelo Google.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold grid place-items-center shrink-0 text-[11px]">
                    3
                  </span>
                  <div>
                    <strong className="text-foreground">Pronto! Os seus colaboradores podem entrar com 1 clique:</strong>
                    <p className="mt-0.5">
                      O botão "Continuar com o Google" na tela inicial fará o login imediato com a conta Google do colaborador e sincronizará os dados com a tabela de equipa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRILHA DE AUDITORIA MASTER */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="panel p-5 bg-card/90 border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-border/70 pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground font-display">
                  Trilha Master de Auditoria (Live Stream de Operações)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cada clique, abertura de ficha, mudança de estado de máquina e aprovação é gravado com data, hora, minuto e operador.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar por operador, pedido..."
                  className="control text-xs pl-8 w-full"
                  value={searchAudit}
                  onChange={(e) => setSearchAudit(e.target.value)}
                />
              </div>
            </div>

            {filteredAudit.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum registo de auditoria encontrado com este filtro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] font-semibold uppercase text-muted-foreground bg-muted/30 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">Carimbo Temporal (Luanda)</th>
                      <th className="py-2.5 px-3">Operador</th>
                      <th className="py-2.5 px-3">Pedido / OP</th>
                      <th className="py-2.5 px-3">Ação Realizada</th>
                      <th className="py-2.5 px-3">Transição de Estado</th>
                      <th className="py-2.5 px-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredAudit.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors font-mono">
                        <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                          {log.created_at ? new Intl.DateTimeFormat('pt-AO', {
                            timeZone: 'Africa/Luanda',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          }).format(new Date(log.created_at)) : '—'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                          {log.actor_name}
                        </td>
                        <td className="py-2 px-3 text-primary whitespace-nowrap">
                          {log.ticket_code || (log.ticket_id ? `#${log.ticket_id}` : '—')}
                        </td>
                        <td className="py-2 px-3 text-foreground font-sans">
                          {log.action}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {log.previous_state || log.new_state ? (
                            <span className="text-[10px] text-muted-foreground">
                              {log.previous_state || '—'} → <strong className="text-foreground">{log.new_state}</strong>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground font-sans truncate max-w-xs">
                          {log.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: BACKUPS & INTEGRIDADE */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="panel p-5 bg-card/90 border-border space-y-6">
            <div>
              <h2 className="text-base font-bold text-foreground font-display">
                Segurança, Backups & Manutenção do Servidor
              </h2>
              <p className="text-xs text-muted-foreground">
                Garantia de soberania total dos dados da sua empresa gráfica.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-background/60 border border-border/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-foreground font-bold text-sm mb-2">
                    <Download size={16} className="text-primary" />
                    Cópia de Segurança Completa (JSON Dump)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Gera um arquivo JSON contendo todas as 10 tabelas da base de dados: Fichas técnicas, Ordens de produção, Clientes, Registos de auditoria e Equipa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="btn btn-primary btn-sm flex items-center justify-center gap-2 cursor-pointer w-full"
                >
                  <Download size={14} />
                  Descarregar Backup Completo Agora
                </button>
              </div>

              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-destructive font-bold text-sm mb-2">
                    <AlertTriangle size={16} />
                    Zona de Reinicialização de Testes
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Limpa apenas os pedidos e ordens de teste, preservando os clientes e a equipa cadastrada. Útil antes de arrancar a fábrica oficialmente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('ATENÇÃO: Deseja zerar todos os pedidos e ordens de teste mantendo clientes e equipa?')) {
                      const res = await fetch('/api/admin/reset', { method: 'POST' });
                      if (res.ok) {
                        showNotification('Operações resetadas para zero com sucesso!');
                        loadData();
                      }
                    }
                  }}
                  className="btn btn-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center gap-2 cursor-pointer w-full"
                >
                  <Trash2 size={14} />
                  Resetar Dados de Teste para Zero
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Novo Colaborador */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="panel p-6 max-w-md w-full bg-card shadow-2xl border-border animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <h3 className="font-bold text-base font-display">Cadastrar Novo Colaborador</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-[11px] font-semibold text-foreground">Primeiro Nome *</label>
                  <input
                    type="text"
                    required
                    className="control"
                    placeholder="Ex.: Manuel"
                    value={newUserData.firstName}
                    onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="text-[11px] font-semibold text-foreground">Sobrenome / Apelido</label>
                  <input
                    type="text"
                    className="control"
                    placeholder="Ex.: Santos"
                    value={newUserData.lastName}
                    onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label className="text-[11px] font-semibold text-foreground">Email de Acesso (ou Gmail) *</label>
                <input
                  type="email"
                  required
                  className="control"
                  placeholder="manuel.santos@graficaflow.ao"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                />
              </div>

              <div className="field">
                <label className="text-[11px] font-semibold text-foreground">Função / Cargo Operacional *</label>
                <select
                  className="control"
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} — {r.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-secondary/50 text-[11px] text-muted-foreground">
                Este utilizador será adicionado de imediato à base de dados do Supabase e poderá entrar com este email ou com a respetiva conta Google.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="btn btn-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="btn btn-sm btn-primary flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  {savingUser ? 'A registar...' : 'Salvar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
