import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle, Bell, RefreshCw, School, TrendingDown, Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface AlunoRisco {
  id: string;
  nome_completo: string;
  matricula: string;
  turma_nome: string;
  escola_nome: string;
  pct_presenca: number | null;
  faltas_consecutivas: number;
  total_registros: number;
  presentes: number;
}

type NivelRisco = 'critico' | 'atencao' | 'consecutivas';

function getNivel(a: AlunoRisco): NivelRisco {
  if (a.pct_presenca !== null && a.pct_presenca < 60) return 'critico';
  if (a.pct_presenca !== null && a.pct_presenca < 75) return 'atencao';
  return 'consecutivas';
}

const nivelConfig: Record<NivelRisco, { label: string; badgeClass: string; border: string }> = {
  critico:       { label: 'Crítico',     badgeClass: 'bg-destructive/15 text-destructive border-destructive/30', border: 'border-destructive/30' },
  atencao:       { label: 'Atenção',     badgeClass: 'bg-amber-500/15 text-amber-700 border-amber-300',          border: 'border-amber-300' },
  consecutivas:  { label: 'Monitorar',   badgeClass: 'bg-blue-500/15 text-blue-700 border-blue-300',             border: 'border-blue-300' },
};

export default function BuscaAtiva() {
  const { perfil, escolaAtiva } = useAuthStore();
  const [alunos, setAlunos] = useState<AlunoRisco[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!perfil) return;
    setLoading(true);
    try {
      const escolaId = perfil.papel === 'DIRETOR' ? escolaAtiva : null;
      const profId   = perfil.papel === 'PROFESSOR' ? perfil.id : null;
      const { data } = await db.buscaAtiva.alunosEmRisco(escolaId, profId);
      setAlunos((data || []) as AlunoRisco[]);
    } catch (err) {
      console.error('Erro ao carregar alunos em risco:', err);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [perfil, escolaAtiva]);

  useEffect(() => { load(); }, [load]);

  const notificarResponsavel = async (aluno: AlunoRisco) => {
    if (!perfil) return;
    setNotifying(aluno.id);
    try {
      const { data: resps } = await db.buscaAtiva.getResponsaveis(aluno.id);
      const responsaveis = (resps || []) as { usuario_id: string; nome: string }[];

      if (responsaveis.length === 0) {
        toast.warning(`${aluno.nome_completo} não tem responsável vinculado.`);
        return;
      }

      const pct = aluno.pct_presenca != null ? `${aluno.pct_presenca}%` : '—';
      const titulo = `⚠️ Alerta de Frequência — ${aluno.nome_completo}`;
      const mensagem = aluno.faltas_consecutivas >= 3
        ? `${aluno.nome_completo} acumula ${aluno.faltas_consecutivas} faltas consecutivas (freq. atual: ${pct}). Por favor, entre em contato com a escola.`
        : `A frequência de ${aluno.nome_completo} está em ${pct} no mês atual. Por favor, entre em contato com a escola para regularizar a situação.`;

      await Promise.all(
        responsaveis.map(r =>
          db.notificacoes.insert({
            remetente_id: perfil.id,
            destinatario_id: r.usuario_id,
            titulo,
            mensagem,
          })
        )
      );

      toast.success(`Notificação enviada para ${responsaveis.length} responsável(is).`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar notificação.');
    } finally {
      setNotifying(null);
    }
  };

  const criticos   = alunos.filter(a => getNivel(a) === 'critico');
  const atencao    = alunos.filter(a => getNivel(a) === 'atencao');
  const monitorar  = alunos.filter(a => getNivel(a) === 'consecutivas');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Busca Ativa — Evasão Escolar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Alunos com frequência abaixo de 75% ou 3+ faltas consecutivas no mês.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Em situação crítica" count={criticos.length} icon={AlertTriangle} className="border-destructive/30 bg-destructive/5" />
        <SummaryCard label="Necessitam atenção" count={atencao.length} icon={TrendingDown} className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" />
        <SummaryCard label="Em monitoramento" count={monitorar.length} icon={Users} className="border-blue-300 bg-blue-50/50 dark:bg-blue-950/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : alunos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <School className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum aluno em risco identificado</p>
            <p className="text-sm mt-1">Todos os alunos estão com frequência adequada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {[
            { label: '🔴 Situação Crítica (< 60%)', list: criticos, nivel: 'critico' as NivelRisco },
            { label: '🟡 Necessita Atenção (60–74%)', list: atencao, nivel: 'atencao' as NivelRisco },
            { label: '🔵 Monitorar (Faltas Consecutivas)', list: monitorar, nivel: 'consecutivas' as NivelRisco },
          ].map(({ label, list, nivel }) =>
            list.length > 0 && (
              <div key={nivel}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">{label}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map(aluno => (
                    <RiscoCard
                      key={aluno.id}
                      aluno={aluno}
                      nivel={nivel}
                      notifying={notifying === aluno.id}
                      onNotificar={() => notificarResponsavel(aluno)}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, count, icon: Icon, className }: {
  label: string; count: number; icon: React.ElementType; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-2xl font-bold leading-none">{count}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RiscoCard({ aluno, nivel, notifying, onNotificar }: {
  aluno: AlunoRisco;
  nivel: NivelRisco;
  notifying: boolean;
  onNotificar: () => void;
}) {
  const cfg = nivelConfig[nivel];
  const pct = aluno.pct_presenca ?? 0;
  const initials = aluno.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Card className={`border ${cfg.border} flex flex-col`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{aluno.nome_completo}</p>
            <p className="text-xs text-muted-foreground">{aluno.turma_nome}</p>
            {aluno.escola_nome && (
              <p className="text-xs text-muted-foreground truncate">{aluno.escola_nome}</p>
            )}
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.badgeClass}`}>
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* Frequência */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Frequência no mês</span>
            <span className={`font-semibold ${pct < 60 ? 'text-destructive' : pct < 75 ? 'text-amber-600' : 'text-blue-600'}`}>
              {aluno.pct_presenca != null ? `${aluno.pct_presenca}%` : '—'}
            </span>
          </div>
          {aluno.pct_presenca != null && (
            <Progress
              value={aluno.pct_presenca}
              className={`h-1.5 ${pct < 60 ? '[&>div]:bg-destructive' : pct < 75 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
            />
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetricItem label="Registros" value={String(aluno.total_registros || 0)} />
          <MetricItem label="Presenças" value={String(aluno.presentes || 0)} />
          {aluno.faltas_consecutivas > 0 && (
            <MetricItem label="Faltas consec." value={String(aluno.faltas_consecutivas)} highlight />
          )}
        </div>

        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={onNotificar}
          disabled={notifying}
          variant="outline"
        >
          <Bell className="h-3.5 w-3.5" />
          {notifying ? 'Notificando…' : 'Notificar Responsável'}
        </Button>
      </CardContent>
    </Card>
  );
}

function MetricItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
