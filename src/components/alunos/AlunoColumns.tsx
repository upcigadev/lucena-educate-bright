import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Column } from '@/components/shared/DataTable';

export interface AlunoRow {
  id: string;
  nome_completo: string;
  matricula: string;
  turma_id: string | null;
  escola_id: string;
  ativo: boolean;
  data_nascimento: string | null;
  responsavel_id: string | null;
  avatar_url?: string | null;
  idface_user_id?: string | null;
  turma_nome?: string;
  serie_nome?: string;
  escola_nome?: string;
  frequencia_pct?: number;
}

function getFreqColor(pct: number) {
  if (pct >= 90) return 'text-emerald-600';
  if (pct >= 75) return 'text-amber-600';
  return 'text-destructive';
}

function getFreqBarClass(pct: number) {
  if (pct >= 90) return '[&>div]:bg-emerald-500';
  if (pct >= 75) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-destructive';
}

export function getAlunoColumns(): Column<AlunoRow>[] {
  return [
    {
      key: 'avatar',
      header: 'Foto',
      sortable: false,
      render: (r) => (
        <Avatar className="h-9 w-9">
          <AvatarImage
            src={r.avatar_url || ''}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {r.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ),
    },
    {
      key: 'nome_completo',
      header: 'Aluno',
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.nome_completo}</p>
          <p className="text-xs text-muted-foreground">{r.matricula}</p>
        </div>
      ),
    },
    {
      key: 'escola_nome',
      header: 'Escola',
      render: (r) => (
        <span className="text-sm text-foreground">{r.escola_nome || '—'}</span>
      ),
    },
    {
      key: 'serie_turma',
      header: 'Série / Turma',
      render: (r) => {
        const serie = r.serie_nome || '';
        const turma = r.turma_nome || '';
        const label = serie && turma ? `${serie} ${turma}` : turma || 'Sem turma';
        return (
          <Badge variant="outline" className="font-normal">
            {label}
          </Badge>
        );
      },
    },
    {
      key: 'frequencia_pct',
      header: 'Frequência',
      render: (r) => {
        const pct = r.frequencia_pct;
        if (pct == null) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span className={`text-sm font-semibold ${getFreqColor(pct)}`}>{pct}%</span>
            <Progress value={pct} className={`h-2 flex-1 ${getFreqBarClass(pct)}`} />
          </div>
        );
      },
    },
  ];
}
