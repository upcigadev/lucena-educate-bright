import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeriesTurmasTab } from '@/components/escolas/SeriesTurmasTab';

interface Escola {
  id: string;
  nome: string;
  inep: string | null;
  endereco: string | null;
  telefone: string | null;
}

export default function Escolas() {
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Escola | null>(null);
  const [form, setForm] = useState({ nome: '', inep: '', endereco: '', telefone: '' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('escolas').select('*').order('nome');
    setEscolas((data as unknown as Escola[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', inep: '', endereco: '', telefone: '' });
    setSheetOpen(true);
  };

  const openEdit = (escola: Escola) => {
    setEditing(escola);
    setForm({
      nome: escola.nome,
      inep: escola.inep || '',
      endereco: escola.endereco || '',
      telefone: escola.telefone || '',
    });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    if (editing) {
      const { error } = await supabase.from('escolas').update({
        nome: form.nome, inep: form.inep || null,
        endereco: form.endereco || null, telefone: form.telefone || null
      }).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Escola atualizada.');
    } else {
      const { error } = await supabase.from('escolas').insert({
        nome: form.nome, inep: form.inep || null,
        endereco: form.endereco || null, telefone: form.telefone || null
      });
      if (error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          toast.error('Já existe uma escola com este INEP.');
        } else toast.error(error.message);
        return;
      }
      toast.success('Escola criada.');
    }
    setSheetOpen(false);
    load();
  };

  const columns: Column<Escola>[] = [
    { key: 'nome', header: 'Nome' },
    { key: 'inep', header: 'INEP' },
    { key: 'endereco', header: 'Endereço' },
    { key: 'telefone', header: 'Telefone' },
  ];

  return (
    <div>
      <PageHeader title="Escolas" description="Gerencie as unidades escolares" actionLabel="Nova Escola" onAction={openNew} />
      <DataTable data={escolas} columns={columns} searchPlaceholder="Buscar escola…" onRowClick={openEdit} />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar Escola' : 'Nova Escola'}</SheetTitle>
          </SheetHeader>

          {editing ? (
            <Tabs defaultValue="dados" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="flex-1">Dados Gerais</TabsTrigger>
                <TabsTrigger value="series" className="flex-1">Séries/Turmas</TabsTrigger>
              </TabsList>
              <TabsContent value="dados">
                <EscolaForm form={form} setForm={setForm} onSave={save} />
              </TabsContent>
              <TabsContent value="series">
                <SeriesTurmasTab escolaId={editing.id} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="mt-4">
              <EscolaForm form={form} setForm={setForm} onSave={save} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EscolaForm({ form, setForm, onSave }: {
  form: { nome: string; inep: string; endereco: string; telefone: string };
  setForm: (f: any) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>INEP</Label>
        <Input value={form.inep} onChange={(e) => setForm({ ...form, inep: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Endereço</Label>
        <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
      </div>
      <Button onClick={onSave} className="w-full" disabled={!form.nome.trim()}>Salvar</Button>
    </div>
  );
}
