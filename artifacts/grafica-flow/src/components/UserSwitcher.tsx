import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@workspace/replit-auth-web';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronDown, LogOut, Shield, Sparkles } from 'lucide-react';

export interface ProfileItem {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  email: string;
  dept: string;
  badgeColor: string;
  avatarBg: string;
  icon: string;
  description: string;
}

export const STAFF_PROFILES: ProfileItem[] = [
  {
    id: 'usr_admin',
    name: 'Gestor Produção',
    role: 'ADMIN',
    roleLabel: 'Administrador',
    email: 'gestor@graficaflow.ao',
    dept: 'Direção Geral & Planeamento',
    badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    avatarBg: 'bg-purple-600 text-white',
    icon: '👔',
    description: 'Acesso total: relatórios, gestão de equipa e aprovação técnica de produção.',
  },
  {
    id: 'usr_atend',
    name: 'Ana Paula',
    role: 'ATENDIMENTO',
    roleLabel: 'Atendimento',
    email: 'ana@graficaflow.ao',
    dept: 'Front-Office & Comercial',
    badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    avatarBg: 'bg-blue-600 text-white',
    icon: '🎧',
    description: 'Registo de novos clientes, abertura de tickets de impressão e triagem de pedidos.',
  },
  {
    id: 'usr_des',
    name: 'Mateus Designer',
    role: 'DESIGNER',
    roleLabel: 'Designer',
    email: 'mateus@graficaflow.ao',
    dept: 'Estúdio & Pré-impressão',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    avatarBg: 'bg-amber-600 text-white',
    icon: '🎨',
    description: 'Upload de artes finais, geração de provas digitais e envio de links de aprovação.',
  },
  {
    id: 'usr_prod',
    name: 'João Baptista',
    role: 'PRODUCAO',
    roleLabel: 'Produção',
    email: 'joao@graficaflow.ao',
    dept: 'Chão de Fábrica (Heidelberg)',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    avatarBg: 'bg-emerald-600 text-white',
    icon: '⚙️',
    description: 'Gravação CTP, operação de máquinas offset SM 74 e avanço de tiragem de miolo.',
  },
  {
    id: 'usr_qual',
    name: 'Teresa Qualidade',
    role: 'QUALIDADE',
    roleLabel: 'Qualidade',
    email: 'teresa@graficaflow.ao',
    dept: 'Garantia de Qualidade',
    badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    avatarBg: 'bg-rose-600 text-white',
    icon: '🔍',
    description: 'Inspeção de densitometria, provas de registo de cor e libertação para acabamentos.',
  },
  {
    id: 'usr_exp',
    name: 'Carlos Expedição',
    role: 'EXPEDICAO',
    roleLabel: 'Expedição',
    email: 'carlos@graficaflow.ao',
    dept: 'Logística & Entrega',
    badgeColor: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
    avatarBg: 'bg-cyan-600 text-white',
    icon: '🚚',
    description: 'Empacotamento de lotes, guias de remessa e entrega ao cliente ou levantamento.',
  },
];

export function UserSwitcher() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentProfile = STAFF_PROFILES.find((p) => p.id === auth.user?.id) || STAFF_PROFILES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (profile: ProfileItem) => {
    if (profile.id === currentProfile.id) {
      setIsOpen(false);
      return;
    }
    setIsSwitching(true);
    try {
      await auth.switchUser(profile.id);
      await queryClient.invalidateQueries();
      toast({
        title: `Sessão alterada: ${profile.name}`,
        description: `Agora está a operar com o perfil de ${profile.roleLabel}.`,
      });
      setIsOpen(false);
    } catch {
      toast({
        title: 'Erro ao alternar perfil',
        description: 'Não foi possível alterar o utilizador.',
        variant: 'destructive',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Botão Gatilho no Topbar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border/80 bg-background/80 hover:bg-accent/50 hover:border-border transition-all shadow-xs cursor-pointer select-none text-left"
        aria-label="Alternar perfil de utilizador"
      >
        <span className={`w-7 h-7 rounded-full ${currentProfile.avatarBg} grid place-items-center text-xs font-bold shadow-xs`}>
          {currentProfile.icon}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-tight text-foreground flex items-center gap-1.5">
            {currentProfile.name}
          </span>
          <span className="text-[10px] text-muted-foreground leading-none font-medium">
            {currentProfile.roleLabel}
          </span>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu Dropdown de Seleção de Perfil */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[340px] sm:w-[380px] rounded-2xl border border-border/80 bg-card p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          style={{ background: 'hsl(var(--card))' }}
        >
          {/* Cabeçalho */}
          <div className="px-3 pt-2 pb-3 border-b border-border/60 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles size={14} className="text-primary" />
                <span>Simulador de Perfis Operacionais</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Escolha uma função para testar regras e permissões no fluxo:
              </p>
            </div>
          </div>

          {/* Lista de Colaboradores */}
          <div className="py-2 space-y-1.5 max-h-[360px] overflow-y-auto">
            {STAFF_PROFILES.map((p) => {
              const isSelected = p.id === currentProfile.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isSwitching}
                  onClick={() => handleSelect(p)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30 shadow-xs'
                      : 'hover:bg-accent/60 border border-transparent'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full ${p.avatarBg} grid place-items-center text-sm shrink-0 shadow-xs mt-0.5`}>
                    {p.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground truncate">{p.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                        {p.roleLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {p.description}
                    </p>
                    <div className="text-[10px] text-muted-foreground/75 mt-1 font-mono">
                      {p.dept}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="shrink-0 text-primary mt-1">
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Rodapé */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between px-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield size={12} className="text-emerald-500" />
              <span>Permissões em tempo real</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                auth.logout();
              }}
              className="flex items-center gap-1.5 text-xs text-destructive hover:underline cursor-pointer"
            >
              <LogOut size={12} />
              <span>Sair da sessão</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
