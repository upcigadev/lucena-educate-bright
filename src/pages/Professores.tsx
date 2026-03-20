import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { maskCPF, cpfMask, validateCPF } from '@/lib/cpf';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { criarUsuario } from '@/lib/criar-usuario';

interface ProfRow {
  id: string;
  usuario_id: string;
  nome: string;
  cpf: string;
  email: string;
  escolas: string[];
}

export default function Professores() {
  const [data, setData] = useState<ProfRow[]>([]);
  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfRow | null>(null);
  const [form, setForm] = useState({ nome: '', cpf: '', email: '' });
  const [selectedEscolas, setSelectedEscolas] = useState<string[]>([]);

  const load = async () => {
    const { data: profs } = await supabase
      .from('professores')
      .select('id, usuario_id, usuarios(nome, cpf, email), professor_escolas(escola_id, escolas(nome))');
    if (profs) {
      setData(profs.map((p: any) => ({
        id: p.id,
        usuario_id: p.usuario_id,
        nome: p.usuarios?.nome || '',
        cpf: p.usuarios?.cpf || '',
        email: p.usuarios?.email || '',
        escolas: (p.professor_escolas || []).map((pe: any) => pe.escolas?.nome || ''),
      })));
    }
    const { data: e } = await supabase.from('escolas').select('id, nome').order('nome');
    setEscolas(e as any[] || []);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', cpf: '', email: '' });
    setSelectedEscolas([]);
    setOpen(true);
  };

  const openEdit = (row: ProfRow) => {
    setEditing(row);
    setForm({ nome: row.nome, cpf: row.cpf, email: row.email });
    // Load escola IDs
    supabase.from('professor_escolas').select('escola_id').eq('professor_id', row.id)
      .then(({ data }) => setSelectedEscolas(data?.map((d: any) => d.escola_id) || []));
    setOpen(true);
  };

  const toggleEscola = (id: string) => {
    setSelectedEscolas(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!form.nome.trim() || selectedEscolas.length === 0) {
      toast.error('Preencha nome e selecione ao menos uma escola.');
      return;
    }
    if (!editing) {
      const cpfClean = form.cpf.replace(/\D/g, '');
      if (!validateCPF(cpfClean)) { toast.error('CPF inválido.'); return; }

      const { data: usr, error } = await supabase.from('usuarios').insert({
        nome: form.nome, cpf: cpfClean, email: form.email || null, papel: 'PROFESSOR'
      }).select().single();
      if (error) {
        toast.error(error.message.includes('duplicate') ? 'CPF já cadastrado.' : error.message);
        return;
      }
      const { data: prof, error: pErr } = await supabase.from('professores').insert({
        usuario_id: (usr as any).id
      }).select().single();
      if (pErr) { toast.error(pErr.message); return; }
      await supabase.from('professor_escolas').insert(
        selectedEscolas.map(eid => ({ professor_id: (prof as any).id, escola_id: eid }))
      );
      toast.success('Professor cadastrado.');
    } else {
      await supabase.from('usuarios').update({ nome: form.nome, email: form.email || null }).eq('id', editing.usuario_id);
      await supabase.from('professor_escolas').delete().eq('professor_id', editing.id);
      if (selectedEscolas.length > 0) {
        await supabase.from('professor_escolas').insert(
          selectedEscolas.map(eid => ({ professor_id: editing.id, escola_id: eid }))
        );
      }
      toast.success('Professor atualizado.');
    }
    setOpen(false);
    load();
  };

  const columns: Column<ProfRow>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: r => maskCPF(r.cpf) },
    { key: 'email', header: 'E-mail' },
    { key: 'escolas', header: 'Escolas', render: r => (
      <div className="flex flex-wrap gap-1">
        {r.escolas.map((e, i) => <Badge key={i} variant="secondary" className="text-xs">{e}</Badge>)}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Professores" actionLabel="Novo Professor" onAction={openNew} />
      <DataTable data={data} columns={columns} onRowClick={openEdit} searchPlaceholder="Buscar professor…" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Editar Professor' : 'Novo Professor'}</SheetTitle></SheetHeader>
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
              <Label>Escolas *</Label>
              <div className="space-y-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
                {escolas.map(e => (
                  <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedEscolas.includes(e.id)} onCheckedChange={() => toggleEscola(e.id)} />
                    {e.nome}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={save} className="w-full" disabled={!form.nome.trim() || selectedEscolas.length === 0}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
