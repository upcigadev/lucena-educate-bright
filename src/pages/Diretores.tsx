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
import { maskCPF, cpfMask, validateCPF } from '@/lib/cpf';

interface DiretorRow {
  id: string;
  usuario_id: string;
  escola_id: string;
  nome: string;
  cpf: string;
  email: string;
  escola_nome: string;
}

export default function Diretores() {
  const [data, setData] = useState<DiretorRow[]>([]);
  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiretorRow | null>(null);
  const [form, setForm] = useState({ nome: '', cpf: '', email: '', escola_id: '' });

  const load = async () => {
    const { data: dirs } = await supabase
      .from('diretores')
      .select('id, usuario_id, escola_id, usuarios(nome, cpf, email), escolas(nome)');
    if (dirs) {
      setData(dirs.map((d: any) => ({
        id: d.id,
        usuario_id: d.usuario_id,
        escola_id: d.escola_id,
        nome: d.usuarios?.nome || '',
        cpf: d.usuarios?.cpf || '',
        email: d.usuarios?.email || '',
        escola_nome: d.escolas?.nome || '',
      })));
    }
    const { data: e } = await supabase.from('escolas').select('id, nome').order('nome');
    setEscolas(e as any[] || []);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', cpf: '', email: '', escola_id: '' });
    setOpen(true);
  };

  const openEdit = (row: DiretorRow) => {
    setEditing(row);
    setForm({ nome: row.nome, cpf: row.cpf, email: row.email, escola_id: row.escola_id });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim() || !form.cpf || !form.escola_id) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    const cpfClean = form.cpf.replace(/\D/g, '');
    if (!validateCPF(cpfClean)) { toast.error('CPF inválido.'); return; }

    if (editing) {
      await supabase.from('usuarios').update({ nome: form.nome, email: form.email || null }).eq('id', editing.usuario_id);
      await supabase.from('diretores').update({ escola_id: form.escola_id }).eq('id', editing.id);
      toast.success('Diretor atualizado.');
    } else {
      const { data: usr, error: usrErr } = await supabase.from('usuarios').insert({
        nome: form.nome, cpf: cpfClean, email: form.email || null, papel: 'DIRETOR'
      }).select().single();
      if (usrErr) {
        if (usrErr.message.includes('duplicate') || usrErr.message.includes('unique')) {
          toast.error('CPF já cadastrado no sistema.');
        } else toast.error(usrErr.message);
        return;
      }
      const { error: dirErr } = await supabase.from('diretores').insert({
        usuario_id: (usr as any).id, escola_id: form.escola_id
      });
      if (dirErr) { toast.error(dirErr.message); return; }
      toast.success('Diretor cadastrado.');
    }
    setOpen(false);
    load();
  };

  const columns: Column<DiretorRow>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: (r) => maskCPF(r.cpf) },
    { key: 'email', header: 'E-mail' },
    { key: 'escola_nome', header: 'Escola' },
  ];

  return (
    <div>
      <PageHeader title="Diretores" description="Cadastro de diretores escolares" actionLabel="Novo Diretor" onAction={openNew} />
      <DataTable data={data} columns={columns} onRowClick={openEdit} searchPlaceholder="Buscar diretor…" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Editar Diretor' : 'Novo Diretor'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: cpfMask(e.target.value) })} placeholder="000.000.000-00" />
              </div>
            )}
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Escola *</Label>
              <Select value={form.escola_id} onValueChange={v => setForm({ ...form, escola_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full" disabled={!form.nome.trim() || !form.escola_id}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
