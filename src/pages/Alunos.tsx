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

export default function Alunos() {
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AlunoRow | null>(null);
  const [form, setForm] = useState({
    nome_completo: '', matricula: '', data_nascimento: '',
    escola_id: '', serie_id: '', turma_id: '',
    resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe'
  });

  const load = async () => {
    const { data } = await db.alunos.list();
    setAlunos((data as AlunoRow[]) || []);
    const { data: t } = await db.turmas.listAll();
    setTurmas((t as Turma[]) || []);
    const { data: e } = await db.escolas.list();
    setEscolas(((e || []) as any[]).map(x => ({ id: x.id, nome: x.nome })));

    // Load all series from all escolas
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
    setForm({ nome_completo: '', matricula: '', data_nascimento: '', escola_id: '', serie_id: '', turma_id: '', resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe' });
    setOpen(true);
  };

  const openEdit = (row: AlunoRow) => {
    setEditing(row);
    const turma = turmas.find(t => t.id === row.turma_id);
    setForm({ nome_completo: row.nome_completo, matricula: row.matricula, data_nascimento: row.data_nascimento || '', escola_id: row.escola_id, serie_id: turma?.serie_id || '', turma_id: row.turma_id || '', resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe' });
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
      return String(t).length === 5 ? `${t}:00` : String(t);
    };

    if (editing) {
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
    } else {
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
      const alunoId = inserted.id;
      toast.success('Aluno cadastrado.');

      // Sync with the biometric device without blocking UI flow if offline
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
    }
    setOpen(false);
    load();
  };

  const filteredSeries = form.escola_id ? series.filter(s => s.escola_id === form.escola_id) : [];
  const filteredTurmas = form.serie_id ? turmas.filter(t => t.serie_id === form.serie_id && t.escola_id === form.escola_id) : [];

  const columns = getAlunoColumns();

  return (
    <div>
      <PageHeader title="Alunos" description="Gestão de alunos matriculados" actionLabel="Novo Aluno" onAction={openNew} />
      <DataTable data={alunos} columns={columns} onRowClick={openEdit} searchPlaceholder="Buscar aluno…" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Editar Aluno' : 'Novo Aluno'}</SheetTitle></SheetHeader>
          <Tabs defaultValue="aluno" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="aluno" className="flex-1">Dados do Aluno</TabsTrigger>
              <TabsTrigger value="resp" className="flex-1">Responsável</TabsTrigger>
              <TabsTrigger value="biometria" className="flex-1">Biometria</TabsTrigger>
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
            <TabsContent value="resp"><ResponsavelTab form={form} onFormChange={(updates) => setForm({ ...form, ...updates })} /></TabsContent>
            <TabsContent value="biometria"><BiometriaTab aluno={form} /></TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
