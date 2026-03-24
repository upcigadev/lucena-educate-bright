import { useEffect, useState } from 'react';
import { db } from '@/lib/mock-db';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { maskCPF, cpfMask, validateCPF } from '@/lib/cpf';
import { criarUsuario } from '@/lib/criar-usuario';

interface DiretorRow {
  id: string;
  usuario_id: string;
  escola_id: string;
  nome: string;
  cpf: string;
  escola_nome: string;
}

export default function Diretores() {
  const [data, setData] = useState<DiretorRow[]>([]);
  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiretorRow | null>(null);
  const [form, setForm] = useState({ nome: '', cpf: '', escola_id: '' });

  const load = async () => {
    const { data: dirs } = await db.diretores.list();
    setData((dirs as DiretorRow[]) || []);
    const { data: esc } = await db.escolas.list();
    setEscolas(((esc || []) as any[]).map(e => ({ id: e.id, nome: e.nome })));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ nome: '', cpf: '', escola_id: '' }); setOpen(true); };
  const openEdit = (row: DiretorRow) => { setEditing(row); setForm({ nome: row.nome, cpf: row.cpf, escola_id: row.escola_id }); setOpen(true); };

  const save = async () => {
    if (!form.nome.trim() || !form.cpf || !form.escola_id) { toast.error('Preencha todos os campos obrigatórios.'); return; }
    const cpfClean = form.cpf.replace(/\D/g, '');
    if (!validateCPF(cpfClean)) { toast.error('CPF inválido.'); return; }

    if (editing) {
      await db.usuarios.update(editing.usuario_id, { nome: form.nome });
      await db.diretores.update(editing.id, { escola_id: form.escola_id });
      toast.success('Diretor atualizado.');
    } else {
      try {
        const result = await criarUsuario({ nome: form.nome, cpf: cpfClean, papel: 'DIRETOR', escola_id: form.escola_id });
        toast.success(`Diretor cadastrado. Login: ${result.email_login} | Senha: ${result.senha_temporaria}`);
      } catch (err: any) { toast.error(err.message); return; }
    }
    setOpen(false);
    load();
  };

  const columns: Column<DiretorRow>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: (r) => maskCPF(r.cpf) },
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
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            {!editing && (<div className="space-y-2"><Label>CPF *</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: cpfMask(e.target.value) })} placeholder="000.000.000-00" /></div>)}
            <div className="space-y-2">
              <Label>Escola *</Label>
              <Select value={form.escola_id} onValueChange={v => setForm({ ...form, escola_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={save} className="w-full" disabled={!form.nome.trim() || !form.escola_id}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
