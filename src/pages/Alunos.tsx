import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cpfMask, validateCPF } from '@/lib/cpf';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, ScanFace } from 'lucide-react';

interface AlunoRow {
  id: string;
  nome_completo: string;
  matricula: string;
  turma_id: string | null;
  escola_id: string;
  ativo: boolean;
  data_nascimento: string | null;
  responsavel_id: string | null;
  turma_nome?: string;
}

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

  const load = async () => {
    const { data } = await supabase
      .from('alunos')
      .select('*, turmas(nome)')
      .order('nome_completo');
    if (data) {
      setAlunos(data.map((a: any) => ({ ...a, turma_nome: a.turmas?.nome || 'Sem turma' })));
    }
    const { data: t } = await supabase.from('turmas').select('id, nome, serie_id, escola_id').order('nome');
    setTurmas(t as any[] || []);
    const { data: s } = await supabase.from('series').select('id, nome, escola_id').order('nome');
    setSeries(s as any[] || []);
    const { data: e } = await supabase.from('escolas').select('id, nome').order('nome');
    setEscolas(e as any[] || []);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      nome_completo: '', matricula: '', data_nascimento: '',
      escola_id: '', serie_id: '', turma_id: '',
      resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe'
    });
    setOpen(true);
  };

  const openEdit = (row: AlunoRow) => {
    setEditing(row);
    // Find the serie_id from the turma
    const turma = turmas.find(t => t.id === row.turma_id);
    setForm({
      nome_completo: row.nome_completo, matricula: row.matricula,
      data_nascimento: row.data_nascimento || '', escola_id: row.escola_id,
      serie_id: turma?.serie_id || '', turma_id: row.turma_id || '',
      resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe'
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome_completo.trim() || !form.matricula.trim() || !form.escola_id) {
      toast.error('Preencha nome, matrícula e escola.'); return;
    }

    if (editing) {
      const oldTurma = editing.turma_id;
      const newTurma = form.turma_id || null;
      const { error } = await supabase.from('alunos').update({
        nome_completo: form.nome_completo,
        data_nascimento: form.data_nascimento || null,
        turma_id: newTurma,
        escola_id: form.escola_id,
      }).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      if (oldTurma !== newTurma) {
        if (oldTurma) {
          await supabase.from('aluno_turma_historico')
            .update({ data_fim: new Date().toISOString() })
            .eq('aluno_id', editing.id).is('data_fim', null);
        }
        if (newTurma) {
          const turma = turmas.find(t => t.id === newTurma);
          await supabase.from('aluno_turma_historico').insert({
            aluno_id: editing.id, turma_id: newTurma,
            turma_nome: turma?.nome || '', serie_nome: ''
          });
        }
      }
      toast.success('Aluno atualizado.');
    } else {
      // Validate responsável CPF
      if (!form.resp_cpf.trim()) {
        toast.error('CPF do Responsável é obrigatório.'); return;
      }
      const cpfClean = form.resp_cpf.replace(/\D/g, '');
      if (!validateCPF(cpfClean)) { toast.error('CPF do responsável inválido.'); return; }

      let responsavel_id: string | null = null;
      if (form.resp_nome.trim()) {
        const { data: usr, error } = await supabase.from('usuarios').insert({
          nome: form.resp_nome, cpf: cpfClean, papel: 'RESPONSAVEL'
        }).select().single();
        if (error) {
          toast.error(error.message.includes('duplicate') ? 'CPF do responsável já cadastrado.' : error.message);
          return;
        }
        const { data: resp } = await supabase.from('responsaveis').insert({
          usuario_id: (usr as any).id, telefone: form.resp_telefone || null
        }).select().single();
        if (resp) responsavel_id = (resp as any).id;
      }

      const { data: aluno, error } = await supabase.from('alunos').insert({
        nome_completo: form.nome_completo, matricula: form.matricula,
        data_nascimento: form.data_nascimento || null,
        escola_id: form.escola_id, turma_id: form.turma_id || null,
        responsavel_id
      }).select().single();
      if (error) {
        toast.error(error.message.includes('duplicate') ? 'Matrícula já cadastrada.' : error.message);
        return;
      }
      if (responsavel_id && aluno) {
        await supabase.from('aluno_responsaveis').insert({
          aluno_id: (aluno as any).id, responsavel_id, parentesco: form.resp_parentesco
        });
      }
      if (form.turma_id && aluno) {
        const turma = turmas.find(t => t.id === form.turma_id);
        await supabase.from('aluno_turma_historico').insert({
          aluno_id: (aluno as any).id, turma_id: form.turma_id,
          turma_nome: turma?.nome || '', serie_nome: ''
        });
      }
      toast.success('Aluno cadastrado.');
    }
    setOpen(false);
    load();
  };

  // Cascading filters: Escola → Série → Turma
  const filteredSeries = form.escola_id ? series.filter(s => s.escola_id === form.escola_id) : [];
  const filteredTurmas = form.serie_id ? turmas.filter(t => t.serie_id === form.serie_id && t.escola_id === form.escola_id) : [];

  const columns: Column<AlunoRow>[] = [
    { key: 'nome_completo', header: 'Nome' },
    { key: 'matricula', header: 'Matrícula' },
    { key: 'turma_nome', header: 'Turma' },
    { key: 'ativo', header: 'Status', render: r => (
      <Badge variant={r.ativo ? 'default' : 'secondary'}>{r.ativo ? 'Ativo' : 'Inativo'}</Badge>
    )},
  ];

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
              {!editing && <TabsTrigger value="resp" className="flex-1">Responsável</TabsTrigger>}
              <TabsTrigger value="biometria" className="flex-1">Biometria</TabsTrigger>
            </TabsList>

            {/* ===== ABA DADOS DO ALUNO ===== */}
            <TabsContent value="aluno">
              <div className="space-y-4 mt-3">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.nome_completo} onChange={e => setForm({ ...form, nome_completo: e.target.value })} />
                </div>
                {!editing && (
                  <div className="space-y-2">
                    <Label>Matrícula *</Label>
                    <Input value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
                </div>

                {/* Cascata: Escola → Série → Turma */}
                <div className="space-y-2">
                  <Label>Escola *</Label>
                  <Select value={form.escola_id} onValueChange={v => setForm({ ...form, escola_id: v, serie_id: '', turma_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a escola" /></SelectTrigger>
                    <SelectContent>
                      {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Série *</Label>
                  <Select
                    value={form.serie_id}
                    onValueChange={v => setForm({ ...form, serie_id: v, turma_id: '' })}
                    disabled={!form.escola_id}
                  >
                    <SelectTrigger><SelectValue placeholder={form.escola_id ? 'Selecione a série' : 'Selecione a escola primeiro'} /></SelectTrigger>
                    <SelectContent>
                      {filteredSeries.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Turma</Label>
                  <Select
                    value={form.turma_id}
                    onValueChange={v => setForm({ ...form, turma_id: v })}
                    disabled={!form.serie_id}
                  >
                    <SelectTrigger><SelectValue placeholder={form.serie_id ? 'Selecione a turma' : 'Selecione a série primeiro'} /></SelectTrigger>
                    <SelectContent>
                      {filteredTurmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* CPF do Responsável inline (obrigatório) */}
                {!editing && (
                  <div className="space-y-2">
                    <Label>CPF do Responsável *</Label>
                    <Input
                      value={form.resp_cpf}
                      onChange={e => setForm({ ...form, resp_cpf: cpfMask(e.target.value) })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                )}

                <Button onClick={save} className="w-full" disabled={!form.nome_completo.trim() || !form.escola_id}>
                  Salvar
                </Button>
              </div>
            </TabsContent>

            {/* ===== ABA RESPONSÁVEL ===== */}
            {!editing && (
              <TabsContent value="resp">
                <div className="space-y-4 mt-3">
                  <p className="text-sm text-muted-foreground">Cadastre o responsável primário do aluno.</p>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.resp_nome} onChange={e => setForm({ ...form, resp_nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF *</Label>
                    <Input value={form.resp_cpf} onChange={e => setForm({ ...form, resp_cpf: cpfMask(e.target.value) })} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.resp_telefone} onChange={e => setForm({ ...form, resp_telefone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parentesco</Label>
                    <Select value={form.resp_parentesco} onValueChange={v => setForm({ ...form, resp_parentesco: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pai/Mãe">Pai/Mãe</SelectItem>
                        <SelectItem value="Avô/Avó">Avô/Avó</SelectItem>
                        <SelectItem value="Tio/Tia">Tio/Tia</SelectItem>
                        <SelectItem value="Responsavel">Responsável Legal</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ===== ABA BIOMETRIA FACIAL ===== */}
            <TabsContent value="biometria">
              <div className="space-y-4 mt-3">
                <Card className="border-dashed border-2">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ScanFace className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Biometria Facial</h4>
                        <p className="text-xs text-muted-foreground">Capture a face do aluno para reconhecimento automático</p>
                      </div>
                    </div>

                    {/* Camera feed placeholder */}
                    <div className="relative aspect-[4/3] w-full rounded-xl bg-muted flex flex-col items-center justify-center gap-3 border border-border overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />
                      <Camera className="h-12 w-12 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Feed da câmera aparecerá aqui</p>
                      {/* Scan guides */}
                      <div className="absolute inset-8 border-2 border-dashed border-primary/20 rounded-full" />
                    </div>

                    <Button size="lg" className="w-full gap-2 text-base font-semibold h-12">
                      <Camera className="h-5 w-5" />
                      Iniciar Captura Facial
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Posicione o rosto do aluno dentro do guia oval e clique para capturar.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
