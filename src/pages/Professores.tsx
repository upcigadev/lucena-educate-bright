import { useEffect, useState } from 'react';
import { db, mockEscolas } from '@/lib/mock-db';
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

interface ProfRow { id: string; usuario_id: string; nome: string; cpf: string; escolas: string[]; }

export default function Professores() {
  const [data, setData] = useState<ProfRow[]>([]);
  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfRow | null>(null);
  const [form, setForm] = useState({ nome: '', cpf: '' });
  const [selectedEscolas, setSelectedEscolas] = useState<string[]>([]);

  const load = () => {
    const { data: profs } = db.professores.list();
    setData((profs as ProfRow[]) || []);
    setEscolas(mockEscolas.map(e => ({ id: e.id, nome: e.nome })));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ nome: '', cpf: '' }); setSelectedEscolas([]); setOpen(true); };
  const openEdit = (row: ProfRow) => {
    setEditing(row);
    setForm({ nome: row.nome, cpf: row.cpf });
    const { data: pes } = db.professorEscolas.listByProfessor(row.id);
    setSelectedEscolas((pes || []).map((d: any) => d.escola_id));
    setOpen(true);
  };

  const toggleEscola = (id: string) => {
    setSelectedEscolas(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!form.nome.trim() || selectedEscolas.length === 0) { toast.error('Preencha nome e selecione ao menos uma escola.'); return; }
    if (!editing) {
      const cpfClean = form.cpf.replace(/\D/g, '');
      if (!validateCPF(cpfClean)) { toast.error('CPF inválido.'); return; }
      try {
        const result = await criarUsuario({ nome: form.nome, cpf: cpfClean, papel: 'PROFESSOR', escolas_ids: selectedEscolas });
        toast.success(`Professor cadastrado. Login: ${result.email_login} | Senha: ${result.senha_temporaria}`);
      } catch (err: any) { toast.error(err.message); return; }
    } else {
      db.usuarios.update(editing.usuario_id, { nome: form.nome });
      db.professorEscolas.deleteByProfessor(editing.id);
      selectedEscolas.forEach(eid => db.professorEscolas.insert({ professor_id: editing.id, escola_id: eid }));
      toast.success('Professor atualizado.');
    }
    setOpen(false);
    load();
  };

  const columns: Column<ProfRow>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: r => maskCPF(r.cpf) },
    { key: 'escolas', header: 'Escolas', render: r => (
      <div className="flex flex-wrap gap-1">{r.escolas.map((e, i) => <Badge key={i} variant="secondary" className="text-xs">{e}</Badge>)}</div>
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
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            {!editing && (<div className="space-y-2"><Label>CPF *</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: cpfMask(e.target.value) })} placeholder="000.000.000-00" /></div>)}
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
