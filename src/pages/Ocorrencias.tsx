import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, ShieldAlert } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface OcorrenciaRow {
  id: string;
  aluno_id: string;
  usuario_id: string;
  titulo: string;
  descricao: string | null;
  gravidade: string;
  data: string;
  created_at: string;
  registrado_por: string;
  aluno_nome?: string;
  turma_nome?: string;
  escola_nome?: string;
}

interface AlunoOption {
  id: string;
  nome_completo: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const gravidadeConfig: Record<string, { label: string; cls: string }> = {
  Leve:  { label: 'Leve',  cls: 'bg-blue-500/15 text-blue-700 border-blue-300' },
  Média: { label: 'Média', cls: 'bg-amber-500/15 text-amber-700 border-amber-300' },
  Grave: { label: 'Grave', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

function GravidadeBadge({ gravidade }: { gravidade: string }) {
  const cfg = gravidadeConfig[gravidade] ?? gravidadeConfig.Leve;
  return <Badge variant="outline" className={`text-xs ${cfg.cls}`}>{cfg.label}</Badge>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Ocorrencias() {
  const { perfil, escolaAtiva } = useAuthStore();
  const isProfessor  = perfil?.papel === 'PROFESSOR';
  const isDiretor    = perfil?.papel === 'DIRETOR';
  const isSecretaria = perfil?.papel === 'SECRETARIA';
  const podeRegistrar = isDiretor || isSecretaria || isProfessor;

  const [ocorrencias, setOcorrencias] = useState<OcorrenciaRow[]>([]);
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ aluno_id: '', titulo: '', descricao: '', gravidade: 'Leve', data: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);

  // Detail
  const [detail, setDetail] = useState<OcorrenciaRow | null>(null);

  const loadData = useCallback(async () => {
    if (!perfil) return;
    setLoading(true);
    try {
      let rows: OcorrenciaRow[] = [];
      if (isProfessor) {
        const { data } = await db.ocorrencias.listByProfessor(perfil.id);
        rows = (data || []) as OcorrenciaRow[];
      } else if (isDiretor && escolaAtiva) {
        const { data } = await db.ocorrencias.listByEscola(escolaAtiva);
        rows = (data || []) as OcorrenciaRow[];
      } else {
        const { data } = await db.ocorrencias.listAll();
        rows = (data || []) as OcorrenciaRow[];
      }
      setOcorrencias(rows);

      // Carrega alunos para o formulário
      if (podeRegistrar) {
        let alunosData: AlunoOption[] = [];
        if (isDiretor && escolaAtiva) {
          const { data } = await db.alunos.listByEscola(escolaAtiva);
          alunosData = ((data || []) as any[]).map(a => ({ id: a.id, nome_completo: a.nome_completo }));
        } else if (isProfessor) {
          const { data } = await db.alunos.listByProfessorUsuarioId(perfil.id);
          alunosData = ((data || []) as any[]).map(a => ({ id: a.id, nome_completo: a.nome_completo }));
        } else {
          const { data } = await db.alunos.list();
          alunosData = ((data || []) as any[]).map(a => ({ id: a.id, nome_completo: a.nome_completo }));
        }
        setAlunos(alunosData);
      }
    } finally {
      setLoading(false);
    }
  }, [perfil, escolaAtiva, isProfessor, isDiretor, podeRegistrar]);

  useEffect(() => { loadData(); }, [loadData]);

  const openNew = () => {
    setForm({ aluno_id: '', titulo: '', descricao: '', gravidade: 'Leve', data: new Date().toISOString().split('T')[0] });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!perfil) return;
    if (!form.aluno_id) { toast.error('Selecione o aluno.'); return; }
    if (!form.titulo.trim()) { toast.error('Informe o título da ocorrência.'); return; }
    setSubmitting(true);
    try {
      await db.ocorrencias.insert({
        aluno_id: form.aluno_id,
        usuario_id: perfil.id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        gravidade: form.gravidade,
        data: form.data,
      });
      toast.success('Ocorrência registrada.');
      setSheetOpen(false);
      loadData();
    } catch (err) {
      toast.error('Erro ao registrar ocorrência.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta ocorrência permanentemente?')) return;
    await db.ocorrencias.delete(id);
    toast.success('Ocorrência excluída.');
    setDetail(null);
    loadData();
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }); }
    catch { return d; }
  };

  const columns: Column<OcorrenciaRow>[] = [
    { key: 'gravidade', header: 'Gravidade', render: r => <GravidadeBadge gravidade={r.gravidade} /> },
    { key: 'aluno_nome', header: 'Aluno', render: r => <p className="font-medium">{r.aluno_nome || '—'}</p> },
    { key: 'turma_nome', header: 'Turma', render: r => r.turma_nome || '—' },
    { key: 'titulo', header: 'Título' },
    { key: 'data', header: 'Data', render: r => formatDate(r.data) },
    { key: 'registrado_por', header: 'Registrado por' },
    {
      key: 'delete_action', header: '', sortable: false,
      render: r => (
        <button
          onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ocorrências Disciplinares"
        description="Registro de ocorrências de alunos"
        actionLabel={podeRegistrar ? 'Nova Ocorrência' : undefined}
        onAction={podeRegistrar ? openNew : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          data={ocorrencias}
          columns={columns}
          onRowClick={r => setDetail(r)}
          searchPlaceholder="Buscar ocorrência…"
        />
      )}

      {/* Nova Ocorrência */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Nova Ocorrência
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-5">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <Select value={form.aluno_id} onValueChange={v => setForm({ ...form, aluno_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                <SelectContent>
                  {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Gravidade *</Label>
              <Select value={form.gravidade} onValueChange={v => setForm({ ...form, gravidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Leve">Leve</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Grave">Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Comportamento inadequado em sala"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descreva a ocorrência com detalhes…"
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">{form.descricao.length}/1000</p>
            </div>

            <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
              {submitting ? 'Registrando…' : 'Registrar Ocorrência'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detalhe */}
      <Sheet open={!!detail} onOpenChange={v => { if (!v) setDetail(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhe da Ocorrência</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 mt-5">
              <GravidadeBadge gravidade={detail.gravidade} />
              <InfoRow label="Aluno" value={detail.aluno_nome || '—'} />
              <InfoRow label="Turma" value={detail.turma_nome || '—'} />
              <InfoRow label="Título" value={detail.titulo} />
              <InfoRow label="Data" value={formatDate(detail.data)} />
              <InfoRow label="Registrado por" value={detail.registrado_por} />
              {detail.descricao && <InfoRow label="Descrição" value={detail.descricao} />}
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => handleDelete(detail.id)}
              >
                <Trash2 className="h-4 w-4" /> Excluir Ocorrência
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}
