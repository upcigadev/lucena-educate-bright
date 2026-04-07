import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
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
import { Bell, Trash2 } from 'lucide-react';
import { SendNotificationModal } from '@/components/shared/SendNotificationModal';

interface ProfRow { id: string; usuario_id: string; nome: string; cpf: string; escolas: string[]; turmas: string[]; }

export default function Professores() {
  const [data, setData] = useState<ProfRow[]>([]);
  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfRow | null>(null);
  const [form, setForm] = useState({ nome: '', cpf: '' });
  const [selectedEscolas, setSelectedEscolas] = useState<string[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifDestinatario, setNotifDestinatario] = useState<{ id: string; nome: string } | null>(null);

  const { perfil } = useAuthStore();

  const load = async () => {
    const { perfil, escolaAtiva } = useAuthStore.getState();
    let profs;
    if (perfil?.papel === 'DIRETOR' && escolaAtiva) {
      const res = await db.professores.listByEscola(escolaAtiva);
      profs = res.data;
    } else {
      const res = await db.professores.list();
      profs = res.data;
    }
    setData((profs as ProfRow[]) || []);

    const { data: esc } = await db.escolas.list();
    let escs = ((esc || []) as any[]).map(e => ({ id: e.id, nome: e.nome }));
    if (perfil?.papel === 'DIRETOR' && escolaAtiva) {
      escs = escs.filter(e => e.id === escolaAtiva);
    }
    setEscolas(escs);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ nome: '', cpf: '' }); setSelectedEscolas([]); setOpen(true); };
  const openEdit = async (row: ProfRow) => {
    setEditing(row);
    setForm({ nome: row.nome, cpf: row.cpf });
    const { data: pes } = await db.professorEscolas.listByProfessor(row.id);
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
      await db.usuarios.update(editing.usuario_id, { nome: form.nome });
      await db.professorEscolas.deleteByProfessor(editing.id);
      for (const eid of selectedEscolas) {
        await db.professorEscolas.insert({ professor_id: editing.id, escola_id: eid });
      }
      toast.success('Professor atualizado.');
    }
    setOpen(false);
    load();
  };

  const deactivate = async (row: ProfRow) => {
    if (!window.confirm(`Inativar professor ${row.nome}?`)) return;
    await db.professores.deactivate(row.id);
    toast.success(`${row.nome} inativado.`);
    load();
  };

  const columns: Column<ProfRow>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: r => maskCPF(r.cpf) },
    { key: 'escolas', header: 'Escolas', render: r => (
      <div className="flex flex-wrap gap-1">{r.escolas.map((e, i) => <Badge key={i} variant="secondary" className="text-xs">{e}</Badge>)}</div>
    )},
    { key: 'turmas', header: 'Turmas', render: r => (
      <div className="flex flex-wrap gap-1">
        {(r.turmas || []).length > 0
          ? r.turmas.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)
          : <span className="text-xs text-muted-foreground">—</span>}
      </div>
    )},
    { key: 'notif_action', header: '', sortable: false, render: r => (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-primary"
        title="Enviar Notificação"
        onClick={(e) => {
          e.stopPropagation();
          setNotifDestinatario({ id: r.usuario_id, nome: r.nome });
          setNotifOpen(true);
        }}
      >
        <Bell className="h-3.5 w-3.5" />
      </Button>
    )},
    { key: 'delete_action', header: '', sortable: false, render: r => (
      <button onClick={(e) => { e.stopPropagation(); deactivate(r); }} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Inativar">
        <Trash2 className="h-4 w-4" />
      </button>
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

      {notifDestinatario && (
        <SendNotificationModal
          open={notifOpen}
          onClose={() => { setNotifOpen(false); setNotifDestinatario(null); }}
          destinatarioId={notifDestinatario.id}
          destinatarioNome={notifDestinatario.nome}
        />
      )}
    </div>
  );
}
