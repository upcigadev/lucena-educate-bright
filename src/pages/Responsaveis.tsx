import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cpfMask, maskCPF, validateCPF } from '@/lib/cpf';
import { Badge } from '@/components/ui/badge';
import { criarUsuario } from '@/lib/criar-usuario';

interface RespRow {
  id: string;
  usuario_id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  alunos: string[];
}

export default function Responsaveis() {
  const [data, setData] = useState<RespRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RespRow | null>(null);
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '' });

  const load = async () => {
    const { data: resps } = await supabase
      .from('responsaveis')
      .select('id, usuario_id, telefone, usuarios(nome, cpf), aluno_responsaveis(alunos(nome_completo))');
    if (resps) {
      setData(resps.map((r: any) => ({
        id: r.id,
        usuario_id: r.usuario_id,
        nome: r.usuarios?.nome || '',
        cpf: r.usuarios?.cpf || '',
        telefone: r.telefone,
        alunos: (r.aluno_responsaveis || []).map((ar: any) => ar.alunos?.nome_completo || ''),
      })));
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', cpf: '', telefone: '' });
    setOpen(true);
  };

  const openEdit = (row: RespRow) => {
    setEditing(row);
    setForm({ nome: row.nome, cpf: row.cpf, telefone: row.telefone || '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    if (editing) {
      await supabase.from('usuarios').update({ nome: form.nome }).eq('id', editing.usuario_id);
      await supabase.from('responsaveis').update({ telefone: form.telefone || null }).eq('id', editing.id);
      toast.success('Responsável atualizado.');
    } else {
      const cpfClean = form.cpf.replace(/\D/g, '');
      if (!validateCPF(cpfClean)) { toast.error('CPF inválido.'); return; }
      try {
        const result = await criarUsuario({
          nome: form.nome,
          cpf: cpfClean,
          papel: 'RESPONSAVEL',
          telefone: form.telefone || undefined,
        });
        toast.success(`Responsável cadastrado. Login: ${result.email_login} | Senha: ${result.senha_temporaria}`);
      } catch (err: any) {
        toast.error(err.message);
        return;
      }
    }
    setOpen(false);
    load();
  };

  const columns: Column<RespRow>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: r => maskCPF(r.cpf) },
    { key: 'telefone', header: 'Telefone' },
    { key: 'alunos', header: 'Alunos', render: r => (
      <div className="flex flex-wrap gap-1">
        {r.alunos.length > 0
          ? r.alunos.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)
          : <span className="text-xs text-muted-foreground">Nenhum</span>
        }
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Responsáveis" actionLabel="Novo Responsável" onAction={openNew} />
      <DataTable data={data} columns={columns} onRowClick={openEdit} searchPlaceholder="Buscar responsável…" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Editar Responsável' : 'Novo Responsável'}</SheetTitle></SheetHeader>
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
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <Button onClick={save} className="w-full" disabled={!form.nome.trim()}>Salvar</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
