import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { School, MapPin, Phone, ArrowRight, Search, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ nome: '', inep: '', endereco: '', telefone: '' });
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const res = await window.electronAPI.getSchools();
    if (res.success) {
      setEscolas(res.data || []);
    } else {
      toast.error('Erro ao carregar escolas.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ nome: '', inep: '', endereco: '', telefone: '' });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    
    // In our IPC, createSchool only takes name right now.
    // Let's rely on that for the demo or update createSchool in IPC.
    // The instructions said "Ex: window.electronAPI.createSchool({ name })".
    const res = await window.electronAPI.createSchool({ name: form.nome });
    
    if (!res.success) {
      if (res.error?.includes('UNIQUE')) {
        toast.error('Já existe uma escola com este nome.');
      } else {
        toast.error(res.error);
      }
      return;
    }
    
    toast.success('Escola criada.');
    setSheetOpen(false);
    load();
  };

  const filtered = escolas.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    (e.inep && e.inep.includes(search))
  );

  const cardColors = [
    'border-l-primary', 'border-l-emerald-500', 'border-l-amber-500',
    'border-l-violet-500', 'border-l-rose-500', 'border-l-cyan-500',
  ];

  return (
    <div>
      <PageHeader title="Escolas" description="Unidades escolares do município" actionLabel="Nova Escola" onAction={openNew} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar escola por nome ou INEP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-40 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <School className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhuma escola encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((escola, idx) => (
            <Card
              key={escola.id}
              className={cn(
                'border-l-4 hover:shadow-md transition-all cursor-pointer group',
                cardColors[idx % cardColors.length]
              )}
              onClick={() => navigate(`/escolas/${escola.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <School className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-card-foreground leading-tight">{escola.nome}</h3>
                      {escola.inep && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Hash className="h-3 w-3" /> INEP: {escola.inep}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {escola.endereco && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0" /> {escola.endereco}
                    </p>
                  )}
                  {escola.telefone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" /> {escola.telefone}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-primary group-hover:bg-primary/5"
                >
                  Acessar Painel da Escola
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova Escola</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>INEP</Label>
              <Input value={form.inep} onChange={e => setForm({ ...form, inep: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
            </div>
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
