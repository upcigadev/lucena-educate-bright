import { useEffect, useState } from 'react';
import { db } from '@/lib/mock-db';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type AlunoRow, getAlunoColumns } from '@/components/alunos/AlunoColumns';
import { ResponsavelTab } from '@/components/alunos/ResponsavelTab';
import { BiometriaTab } from '@/components/alunos/BiometriaTab';
import { useAuthStore } from '@/stores/authStore';
import { FileText, Trash2, ShieldAlert, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Serie { id: string; nome: string; escola_id: string; horario_inicio: string | null; tolerancia_min: number | null; limite_max: string | null; }
interface Turma { id: string; nome: string; serie_id: string; escola_id: string; horario_inicio: string | null; tolerancia_min: number | null; limite_max: string | null; }
interface Escola { id: string; nome: string; }

function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = String(time).split(':').map(Number);
  if (parts.length < 2 || parts.some(n => Number.isNaN(n))) return null;
  const [hh, mm] = parts;
  return hh * 60 + mm;
}

function minutesToHHMM(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const base = parseTimeToMinutes(time);
  if (base == null) return time;
  return minutesToHHMM(base + minutes);
}

// ── Declaração de Matrícula ──────────────────────────────────────────────────
function gerarDeclaracao(aluno: AlunoRow, escolaNome: string, escolaEndereco?: string) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const nascimento = aluno.data_nascimento
    ? (() => { try { return format(new Date(aluno.data_nascimento + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return aluno.data_nascimento; } })()
    : null;
  const serie = aluno.serie_nome || '';
  const turma = aluno.turma_nome && aluno.turma_nome !== 'Sem turma' ? aluno.turma_nome : '';
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Declaração de Matrícula</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:12pt;color:#000;background:#fff;padding:2.5cm}
  .hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:14px;margin-bottom:30px}
  .hdr h1{font-size:15pt;text-transform:uppercase;letter-spacing:.5px}.hdr p{font-size:10pt;color:#444;margin-top:3px}
  .ttl{text-align:center;margin:28px 0}.ttl h2{font-size:13pt;text-transform:uppercase;letter-spacing:1px;text-decoration:underline}
  .body{line-height:1.9;text-align:justify;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;border:1px solid #ccc;margin:24px 0}
  td{padding:5px 10px;font-size:11pt}td:first-child{font-weight:bold;width:38%;background:#f9f9f9}
  .sig{margin-top:60px;text-align:center}.sig .ln{border-top:1px solid #000;width:280px;margin:0 auto 6px}
  .date{text-align:right;margin-top:28px;font-size:11pt}
  @media print{body{padding:0}@page{size:A4;margin:2.2cm}}</style></head>
  <body>
  <div class="hdr"><h1>${escolaNome}</h1>${escolaEndereco ? `<p>${escolaEndereco}</p>` : ''}</div>
  <div class="ttl"><h2>Declaração de Matrícula</h2></div>
  <div class="body"><p>Declaramos, para os devidos fins, que o(a) aluno(a) abaixo identificado(a) encontra-se devidamente matriculado(a) nesta instituição de ensino no ano letivo de <strong>${new Date().getFullYear()}</strong>.</p></div>
  <table><tbody>
    <tr><td>Nome completo:</td><td>${aluno.nome_completo}</td></tr>
    <tr><td>Matrícula:</td><td>${aluno.matricula}</td></tr>
    ${nascimento ? `<tr><td>Data de nascimento:</td><td>${nascimento}</td></tr>` : ''}
    <tr><td>Escola:</td><td>${escolaNome}</td></tr>
    ${serie ? `<tr><td>Série:</td><td>${serie}</td></tr>` : ''}
    ${turma ? `<tr><td>Turma:</td><td>${turma}</td></tr>` : ''}
    <tr><td>Situação:</td><td>Matriculado(a) — Ativo(a)</td></tr>
    <tr><td>Ano letivo:</td><td>${new Date().getFullYear()}</td></tr>
  </tbody></table>
  <p class="date">Lucena, ${hoje}</p>
  <div class="sig"><div class="ln"></div><p>Secretaria Escolar — ${escolaNome}</p></div>
  <script>window.onload=()=>window.print();<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) setTimeout(() => URL.revokeObjectURL(url), 60_000);
  else URL.revokeObjectURL(url);
}

export default function Alunos() {
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AlunoRow | null>(null);
  const [pendingResp, setPendingResp] = useState<{ id: string; nome: string } | null>(null);
  // Ocorrências do aluno sendo editado
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [ocorrenciaForm, setOcorrenciaForm] = useState({ titulo: '', descricao: '', gravidade: 'Leve', data: new Date().toISOString().split('T')[0] });
  const [savingOcorrencia, setSavingOcorrencia] = useState(false);
  const [form, setForm] = useState({
    nome_completo: '', matricula: '', data_nascimento: '',
    escola_id: '', serie_id: '', turma_id: '',
    resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe'
  });

  const load = async () => {
    const { perfil, escolaAtiva } = useAuthStore.getState();
    let data;
    
    if (perfil?.papel === 'DIRETOR' && escolaAtiva) {
      const res = await db.alunos.listByEscola(escolaAtiva);
      data = res.data;
    } else if (perfil?.papel === 'PROFESSOR') {
      const res = await db.alunos.listByProfessorUsuarioId(perfil.id);
      data = res.data;
    } else {
      const res = await db.alunos.list();
      data = res.data;
    }

    const rows = (data as AlunoRow[]) || [];

    // Calcula a frequência real do mês atual para cada aluno
    const withFreq: AlunoRow[] = await Promise.all(
      rows.map(async (a) => {
        const { data: pct } = await db.frequencias.monthlyPct(a.id);
        return { ...a, frequencia_pct: pct ?? undefined };
      })
    );
    setAlunos(withFreq);

    const { data: t } = await db.turmas.listAll();
    setTurmas((t as Turma[]) || []);
    const { data: e } = await db.escolas.list();
    setEscolas(((e || []) as any[]).map(x => ({ id: x.id, nome: x.nome })));

    const allSeries: Serie[] = [];
    for (const escola of (e || []) as any[]) {
      const { data: s } = await db.series.listByEscola(escola.id);
      if (s) allSeries.push(...(s as Serie[]));
    }
    setSeries(allSeries);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setPendingResp(null);
    setForm({ nome_completo: '', matricula: '', data_nascimento: '', escola_id: '', serie_id: '', turma_id: '', resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe' });
    setOpen(true);
  };

  const openEdit = (row: AlunoRow) => {
    setEditing(row);
    const turma = turmas.find(t => t.id === row.turma_id);
    setForm({ nome_completo: row.nome_completo, matricula: row.matricula, data_nascimento: row.data_nascimento || '', escola_id: row.escola_id, serie_id: turma?.serie_id || '', turma_id: row.turma_id || '', resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe' });
    // Carrega ocorrências do aluno
    db.ocorrencias.listByAluno(row.id).then(res => setOcorrencias((res.data || []) as any[]));
    setOcorrenciaForm({ titulo: '', descricao: '', gravidade: 'Leve', data: new Date().toISOString().split('T')[0] });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome_completo.trim() || !form.matricula.trim() || !form.escola_id) {
      toast.error('Preencha nome, matrícula e escola.'); return;
    }

    const turmaSelecionada = form.turma_id ? turmas.find(t => t.id === form.turma_id) || null : null;
    const serieSelecionada = form.serie_id ? series.find(s => s.id === form.serie_id) || null : null;

    const horario_inicio = turmaSelecionada?.horario_inicio ?? serieSelecionada?.horario_inicio ?? null;
    const tolerancia_min =
      turmaSelecionada?.tolerancia_min ??
      serieSelecionada?.tolerancia_min ??
      15;
    const horario_fim =
      horario_inicio != null && tolerancia_min != null ? addMinutesToTime(horario_inicio, Number(tolerancia_min)) : null;
    const limite_max = turmaSelecionada?.limite_max ?? serieSelecionada?.limite_max ?? null;

    const toDeviceTime = (t: string | null) => {
      if (!t) return null;
      const s = String(t);
      return s.length >= 5 ? s.slice(0, 5) : s;
    };

    if (editing) {
      try {
        await db.alunos.update(editing.id, {
          nome_completo: form.nome_completo,
          data_nascimento: form.data_nascimento || null,
          turma_id: form.turma_id || null,
          escola_id: form.escola_id,
          horario_inicio,
          horario_fim,
          limite_max
        });
        toast.success('Aluno atualizado.');
        setOpen(false);
        load();
      } catch (err: any) {
        toast.error(`Erro ao atualizar aluno: ${err?.message || 'Tente novamente.'}`);
      }
    } else {
      // 1. Verifica duplicidade de matrícula ANTES de qualquer operação
      let alunoId: string | undefined;
      try {
        const inserted = await db.alunos.insert({
          nome_completo: form.nome_completo,
          matricula: form.matricula,
          data_nascimento: form.data_nascimento || null,
          escola_id: form.escola_id,
          turma_id: form.turma_id || null,
          horario_inicio,
          horario_fim,
          limite_max,
        });
        alunoId = inserted.data?.id;
      } catch (dbErr: any) {
        const msg = String(dbErr?.message || dbErr || '');
        if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('matricula')) {
          toast.error(`Matrícula "${form.matricula}" já está em uso por outro aluno ativo.`);
        } else {
          toast.error(`Erro ao cadastrar aluno: ${msg || 'Tente novamente.'}`);
        }
        return; 
      }

      toast.success('Aluno cadastrado.');

      // 2. Link pending responsável selected in the Responsável tab (before save)
      if (alunoId && pendingResp) {
        try {
          await db.alunoResponsaveis.insert({
            aluno_id: alunoId,
            responsavel_id: pendingResp.id,
            parentesco: form.resp_parentesco || 'Responsavel',
          });
        } catch (e) {
          console.warn('Falha ao vincular responsável pendente:', e);
        }
        setPendingResp(null);
      }

      // 3. Sync with the biometric device
      try {
        const configResult = await db.iotConfig.getByEscola(form.escola_id);
        const config = configResult.data;
        if (config && config.ip_address) {
          const regResponse = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip: config.ip_address,
              userData: {
                id: form.matricula,
                name: form.nome_completo,
                begin_time: toDeviceTime(horario_inicio),
                end_time: toDeviceTime(limite_max),
              }
            })
          });

          if (regResponse.ok) {
            const regData = await regResponse.json();
            const internalId = regData?.data?.internalUserId;
            if (internalId && alunoId) {
              await db.alunos.update(alunoId, { idface_user_id: String(internalId) });
            }
          }
        }
      } catch (err) {
        console.error('Error during biometric sync:', err);
      }
      setOpen(false);
      load();
    }
  };

  const deactivate = async (aluno: AlunoRow) => {
    if (!window.confirm(`Inativar ${aluno.nome_completo}? Esta ação remove o aluno do sistema de frequência e da biometria.`)) return;

    // 1. Soft-delete no banco local
    await db.alunos.deactivate(aluno.id);

    // 2. Remover biometria do equipamento Control iD (se configurado)
    if (aluno.idface_user_id && aluno.escola_id) {
      try {
        const configResult = await db.iotConfig.getByEscola(aluno.escola_id);
        const config = configResult.data as any;
        if (config?.ip_address) {
          await fetch('http://localhost:3000/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: config.ip_address, internalUserId: aluno.idface_user_id }),
          });
        }
      } catch (hwErr) {
        console.warn('Falha ao remover biometria do equipamento:', hwErr);
      }
    }

    toast.success(`${aluno.nome_completo} inativado com sucesso.`);
    load();
  };

  const filteredSeries = form.escola_id ? series.filter(s => s.escola_id === form.escola_id) : [];
  const filteredTurmas = form.serie_id ? turmas.filter(t => t.serie_id === form.serie_id && t.escola_id === form.escola_id) : [];

  const handleSaveOcorrencia = async () => {
    const { perfil } = useAuthStore.getState();
    if (!editing || !perfil) return;
    if (!ocorrenciaForm.titulo.trim()) { toast.error('Título obrigatório.'); return; }
    setSavingOcorrencia(true);
    try {
      await db.ocorrencias.insert({
        aluno_id: editing.id,
        usuario_id: perfil.id,
        titulo: ocorrenciaForm.titulo.trim(),
        descricao: ocorrenciaForm.descricao.trim() || null,
        gravidade: ocorrenciaForm.gravidade,
        data: ocorrenciaForm.data,
      });
      toast.success('Ocorrência registrada.');
      setOcorrenciaForm({ titulo: '', descricao: '', gravidade: 'Leve', data: new Date().toISOString().split('T')[0] });
      const res = await db.ocorrencias.listByAluno(editing.id);
      setOcorrencias((res.data || []) as any[]);
    } finally {
      setSavingOcorrencia(false);
    }
  };

  // Coluna de ação de exclusão
  const deleteColumn = {
    key: 'delete_action',
    header: '',
    sortable: false,
    render: (r: AlunoRow) => (
      <button
        onClick={(e) => { e.stopPropagation(); deactivate(r); }}
        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Inativar aluno"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    ),
  };

  // Coluna de Declaração de Matrícula
  const docColumn = {
    key: 'doc_action',
    header: '',
    sortable: false,
    render: (r: AlunoRow) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          const escola = escolas.find(e => e.id === r.escola_id);
          gerarDeclaracao(r, escola?.nome || 'Escola', undefined);
        }}
        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        title="Gerar Declaração de Matrícula"
      >
        <FileText className="h-4 w-4" />
      </button>
    ),
  };

  const columns = [...getAlunoColumns(), docColumn, deleteColumn];

  return (
    <div>
      <PageHeader title="Alunos" description="Gestão de alunos matriculados" actionLabel="Novo Aluno" onAction={openNew} />
      <DataTable data={alunos} columns={columns} onRowClick={openEdit} searchPlaceholder="Buscar aluno…" />

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPendingResp(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Editar Aluno' : 'Novo Aluno'}</SheetTitle></SheetHeader>
          <Tabs defaultValue="aluno" className="mt-4">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="aluno" className="text-xs">Dados</TabsTrigger>
              <TabsTrigger value="resp" className="text-xs">Responsável</TabsTrigger>
              <TabsTrigger value="biometria" className="text-xs">Biometria</TabsTrigger>
              <TabsTrigger value="ocorrencias" className="text-xs">
                Ocorrências {ocorrencias.length > 0 && <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5">{ocorrencias.length}</span>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="aluno">
              <div className="space-y-4 mt-3">
                <div className="space-y-2"><Label>Nome Completo *</Label><Input value={form.nome_completo} onChange={e => setForm({ ...form, nome_completo: e.target.value })} /></div>
                {!editing && (<div className="space-y-2"><Label>Matrícula *</Label><Input value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} /></div>)}
                <div className="space-y-2"><Label>Data de Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Escola *</Label>
                  <Select value={form.escola_id} onValueChange={v => setForm({ ...form, escola_id: v, serie_id: '', turma_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a escola" /></SelectTrigger>
                    <SelectContent>{escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Série *</Label>
                  <Select value={form.serie_id} onValueChange={v => setForm({ ...form, serie_id: v, turma_id: '' })} disabled={!form.escola_id}>
                    <SelectTrigger><SelectValue placeholder={form.escola_id ? 'Selecione a série' : 'Selecione a escola primeiro'} /></SelectTrigger>
                    <SelectContent>{filteredSeries.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Turma</Label>
                  <Select value={form.turma_id} onValueChange={v => setForm({ ...form, turma_id: v })} disabled={!form.serie_id}>
                    <SelectTrigger><SelectValue placeholder={form.serie_id ? 'Selecione a turma' : 'Selecione a série primeiro'} /></SelectTrigger>
                    <SelectContent>{filteredTurmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={save} className="w-full" disabled={!form.nome_completo.trim() || !form.escola_id}>Salvar</Button>
              </div>
            </TabsContent>
            <TabsContent value="resp">
              <ResponsavelTab
                alunoId={editing?.id}
                form={form}
                onFormChange={(updates) => setForm({ ...form, ...updates })}
                onSelectExisting={(r) => setPendingResp(r)}
              />
            </TabsContent>
            <TabsContent value="biometria"><BiometriaTab aluno={form} /></TabsContent>

            {/* Aba de Ocorrências — disponível apenas ao editar */}
            {editing && (
              <TabsContent value="ocorrencias" className="space-y-4 mt-3">
                {/* Nova ocorrência inline */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    Nova Ocorrência
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Título *</Label>
                      <Input value={ocorrenciaForm.titulo} onChange={e => setOcorrenciaForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Agressão verbal" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data</Label>
                      <Input type="date" value={ocorrenciaForm.data} onChange={e => setOcorrenciaForm(f => ({ ...f, data: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gravidade</Label>
                      <Select value={ocorrenciaForm.gravidade} onValueChange={v => setOcorrenciaForm(f => ({ ...f, gravidade: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Leve">Leve</SelectItem>
                          <SelectItem value="Média">Média</SelectItem>
                          <SelectItem value="Grave">Grave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Descrição</Label>
                      <Textarea value={ocorrenciaForm.descricao} onChange={e => setOcorrenciaForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className="text-sm" />
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5 w-full" onClick={handleSaveOcorrencia} disabled={savingOcorrencia}>
                    <Plus className="h-3.5 w-3.5" /> {savingOcorrencia ? 'Salvando…' : 'Registrar'}
                  </Button>
                </div>

                {/* Histórico */}
                <div className="space-y-2">
                  {ocorrencias.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ocorrência registrada.</p>
                  ) : ocorrencias.map((o: any) => (
                    <div key={o.id} className="rounded-lg border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{o.titulo}</p>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${
                          o.gravidade === 'Grave'  ? 'bg-destructive/15 text-destructive border-destructive/30' :
                          o.gravidade === 'Média'  ? 'bg-amber-500/15 text-amber-700 border-amber-300' :
                          'bg-blue-500/15 text-blue-700 border-blue-300'
                        }`}>{o.gravidade}</Badge>
                      </div>
                      {o.descricao && <p className="text-xs text-muted-foreground mt-0.5">{o.descricao}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{o.data} · {o.registrado_por}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
