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

interface Serie { id: string; nome: string; escola_id: string; }
interface Turma { id: string; nome: string; serie_id: string; escola_id: string; }
interface Escola { id: string; nome: string; }

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

  const load = () => {
    const { data } = db.alunos.list();
    setAlunos((data as AlunoRow[]) || []);
    const { data: t } = db.turmas.listAll();
    setTurmas((t as Turma[]) || []);
    // TODO: get series from mock-db
    const { mockSeries, mockEscolas } = require('@/lib/mock-db');
    setSeries(mockSeries as Serie[]);
    setEscolas(mockEscolas.map((e: any) => ({ id: e.id, nome: e.nome })));
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

  const save = () => {
    if (!form.nome_completo.trim() || !form.matricula.trim() || !form.escola_id) {
      toast.error('Preencha nome, matrícula e escola.'); return;
    }
    // TODO: Replace with SQLite insert/update
    if (editing) {
      db.alunos.update(editing.id, { nome_completo: form.nome_completo, data_nascimento: form.data_nascimento || null, turma_id: form.turma_id || null, escola_id: form.escola_id });
      toast.success('Aluno atualizado.');
    } else {
      db.alunos.insert({ nome_completo: form.nome_completo, matricula: form.matricula, data_nascimento: form.data_nascimento || null, escola_id: form.escola_id, turma_id: form.turma_id || null });
      toast.success('Aluno cadastrado.');
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
            <TabsContent value="biometria"><BiometriaTab /></TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
