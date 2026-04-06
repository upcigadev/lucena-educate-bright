import { useEffect, useState } from 'react';
import { db } from '@/lib/mock-db';
import { useAuthStore } from '@/stores/authStore';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/shared/PageHeader';
import { format, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FilhoRow {
  id: string;
  nome_completo: string;
  matricula: string;
  turma_nome: string;
  serie_nome: string;
  escola_nome: string;
  parentesco: string;
  avatar_url: string | null;
  frequencia_pct?: number;
}

const statusColor = (pct: number) =>
  pct >= 85 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-destructive';

export default function MeusFilhos() {
  const { perfil } = useAuthStore();
  const [filhos, setFilhos] = useState<FilhoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedFilho, setSelectedFilho] = useState<FilhoRow | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const openHistory = async (filho: FilhoRow) => {
    setSelectedFilho(filho);
    setHistoryOpen(true);
    // last 30 days
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const { data } = await db.frequencias.listByAlunos([filho.id], startDate, endDate);
    setHistory((data || []) as any[]);
  };

  useEffect(() => {
    const load = async () => {
      if (!perfil?.id) return;
      const { data } = await db.alunos.listByResponsavelUsuarioId(perfil.id);
      const rows = ((data || []) as FilhoRow[]);
      // Enrich with monthly attendance %
      const withFreq = await Promise.all(
        rows.map(async (a) => {
          const { data: pct } = await db.frequencias.monthlyPct(a.id);
          return { ...a, frequencia_pct: pct ?? undefined };
        })
      );
      setFilhos(withFreq);
      setLoading(false);
    };
    load();
  }, [perfil?.id]);

  const columns: Column<FilhoRow>[] = [
    {
      key: 'avatar_url',
      header: 'Foto',
      sortable: false,
      render: (r) => (
        <Avatar className="h-9 w-9">
          <AvatarImage src={r.avatar_url || ''} className="object-cover" />
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {r.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ),
    },
    {
      key: 'nome_completo',
      header: 'Nome',
      render: (r) => (
        <div>
          <p className="font-medium text-sm">{r.nome_completo}</p>
          <p className="text-xs text-muted-foreground font-mono">{r.matricula}</p>
        </div>
      ),
    },
    {
      key: 'escola_nome',
      header: 'Escola',
      render: (r) => (
        <div>
          <p className="text-sm">{r.escola_nome}</p>
          <p className="text-xs text-muted-foreground">{r.serie_nome} · {r.turma_nome}</p>
        </div>
      ),
    },
    {
      key: 'parentesco',
      header: 'Vínculo',
      render: (r) => <Badge variant="secondary" className="text-xs">{r.parentesco}</Badge>,
    },
    {
      key: 'frequencia_pct',
      header: 'Frequência',
      render: (r) => {
        const pct = r.frequencia_pct ?? 0;
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <Progress value={pct} className="h-1.5 flex-1" />
            <span className={`text-xs font-semibold tabular-nums ${statusColor(pct)}`}>{pct}%</span>
          </div>
        );
      },
    },
    {
      key: 'acoes',
      header: '',
      render: (r) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => openHistory(r)} className="text-primary hover:text-primary/80">
            <History className="h-4 w-4 mr-2" /> Histórico
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Meus Filhos"
        description="Frequência e informações dos seus filhos matriculados"
      />
      {filhos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">Nenhum filho vinculado à sua conta.</p>
          <p className="text-sm mt-1">Entre em contato com a secretaria da escola para realizar o vínculo.</p>
        </div>
      ) : (
        <DataTable
          data={filhos}
          columns={columns}
          searchPlaceholder="Buscar filho…"
        />
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de Acessos</DialogTitle>
            <DialogDescription>
              {selectedFilho?.nome_completo} (Últimos 30 dias)
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-3">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhum registro encontrado</p>
                <p className="text-xs mt-1">nos últimos 30 dias.</p>
              </div>
            ) : (
              history.map(h => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(h.data + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                    {h.hora_entrada ? (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{h.hora_entrada}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Sem registro horário</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${
                    h.status === 'presente' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200' :
                    h.status === 'atrasado' ? 'bg-amber-500/15 text-amber-700 border-amber-200' :
                    h.status === 'justificada' ? 'bg-blue-500/15 text-blue-700 border-blue-200' :
                    'bg-destructive/15 text-destructive border-destructive/20'
                  }`}>
                    {h.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
