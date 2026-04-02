import { useEffect, useState } from 'react';
import { db } from '@/lib/mock-db';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Link2, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { cpfMask, validateCPF } from '@/lib/cpf';
import { toast } from 'sonner';

interface Responsavel {
  vinculo_id: string;
  responsavel_id: string;
  parentesco: string;
  nome: string;
  cpf: string;
  telefone: string | null;
}

interface RespSearch {
  id: string;
  nome: string;
  cpf: string;
}

interface ResponsavelTabProps {
  alunoId?: string; // undefined when creating a new student
  form: {
    resp_nome: string;
    resp_cpf: string;
    resp_telefone: string;
    resp_parentesco: string;
  };
  onFormChange: (updates: Partial<ResponsavelTabProps['form']>) => void;
  /** Called when user picks (or clears) an existing responsavel from search.
   *  Parent stores this and inserts the link after the aluno is created. */
  onSelectExisting?: (resp: { id: string; nome: string } | null) => void;
}

export function ResponsavelTab({ alunoId, form, onFormChange, onSelectExisting }: ResponsavelTabProps) {
  const [vinculados, setVinculados] = useState<Responsavel[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RespSearch[]>([]);
  const [selectedResp, setSelectedResp] = useState<RespSearch | null>(null);
  const [linkParentesco, setLinkParentesco] = useState('Pai/Mãe');
  const [linkLoading, setLinkLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const loadVinculados = async () => {
    if (!alunoId) return;
    const { data } = await db.alunoResponsaveis.listByAluno(alunoId);
    setVinculados((data as Responsavel[]) || []);
  };

  useEffect(() => { loadVinculados(); }, [alunoId]);

  // Busca responsáveis no banco conforme o usuário digita
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await db.responsaveis.search(searchQuery.trim());
      setSearchResults(((data || []) as any[]).map(r => ({
        id: r.id,
        nome: r.nome,
        cpf: r.cpf,
      })));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleVincular = async () => {
    if (!alunoId || !selectedResp) return;
    setLinkLoading(true);
    try {
      await db.alunoResponsaveis.insert({
        aluno_id: alunoId,
        responsavel_id: selectedResp.id,
        parentesco: linkParentesco,
      });
      toast.success(`${selectedResp.nome} vinculado com sucesso.`);
      setSelectedResp(null);
      setSearchQuery('');
      loadVinculados();
    } catch (e: any) {
      toast.error('Erro ao vincular responsável.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleDesvincular = async (vinculoId: string, nome: string) => {
    if (!window.confirm(`Desvincular ${nome} deste aluno?`)) return;
    await db.alunoResponsaveis.delete(vinculoId);
    toast.success(`${nome} desvinculado.`);
    loadVinculados();
  };

  const handleCadastrarNovo = async () => {
    if (!form.resp_nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    const cpfClean = form.resp_cpf.replace(/\D/g, '');
    if (!validateCPF(cpfClean)) { toast.error('CPF inválido.'); return; }

    setCreateLoading(true);
    try {
      // Cria usuário
      const userResult = await db.usuarios.insert({
        nome: form.resp_nome.trim(),
        cpf: cpfClean,
        papel: 'RESPONSAVEL',
      });
      const usuarioId = userResult.data?.id;
      if (!usuarioId) throw new Error('Falha ao criar usuário.');

      // Cria responsavel
      const respResult = await db.responsaveis.insert({
        usuario_id: usuarioId,
        telefone: form.resp_telefone || null,
      });
      const responsavelId = respResult.data?.id;
      if (!responsavelId) throw new Error('Falha ao criar responsável.');

      // Se há aluno aberto, vincula imediatamente
      if (alunoId) {
        await db.alunoResponsaveis.insert({
          aluno_id: alunoId,
          responsavel_id: responsavelId,
          parentesco: form.resp_parentesco,
        });
        loadVinculados();
      }

      toast.success(`Responsável ${form.resp_nome} cadastrado${alunoId ? ' e vinculado' : ''}.`);
      onFormChange({ resp_nome: '', resp_cpf: '', resp_telefone: '', resp_parentesco: 'Pai/Mãe' });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cadastrar responsável.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-5 mt-3">
      {/* === VINCULADOS ATUALMENTE === */}
      {alunoId && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsáveis Vinculados</p>
          {vinculados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum responsável vinculado.</p>
          ) : (
            <div className="space-y-2">
              {vinculados.map(v => (
                <div key={v.vinculo_id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{v.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{v.parentesco}</Badge>
                      {v.telefone && <span className="text-xs text-muted-foreground">{v.telefone}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDesvincular(v.vinculo_id, v.nome)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    title="Desvincular"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === VINCULAR EXISTENTE === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">Vincular Responsável Existente</h4>
        </div>
        <p className="text-xs text-muted-foreground">Pesquise pelo nome ou CPF de um responsável já cadastrado no sistema.</p>

        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2 h-10 font-normal">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedResp ? (
                <span>{selectedResp.nome} — <span className="text-muted-foreground text-xs">{selectedResp.cpf}</span></span>
              ) : (
                <span className="text-muted-foreground">Buscar responsável por nome ou CPF…</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Digite nome ou CPF…"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {searchQuery.length < 2
                    ? 'Digite ao menos 2 caracteres…'
                    : 'Nenhum responsável encontrado.'}
                </CommandEmpty>
                <CommandGroup>
                  {searchResults.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${r.nome} ${r.cpf}`}
                      onSelect={() => {
                        setSelectedResp(r);
                        setSearchOpen(false);
                        onSelectExisting?.(r);
                      }}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="font-medium">{r.nome}</span>
                      <span className="text-xs text-muted-foreground">{r.cpf}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedResp && alunoId && (
          <div className="flex gap-2">
            <Select value={linkParentesco} onValueChange={setLinkParentesco}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pai/Mãe">Pai/Mãe</SelectItem>
                <SelectItem value="Avô/Avó">Avô/Avó</SelectItem>
                <SelectItem value="Tio/Tia">Tio/Tia</SelectItem>
                <SelectItem value="Responsavel">Responsável Legal</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleVincular} disabled={linkLoading} className="gap-1.5">
              {linkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Vincular
            </Button>
          </div>
        )}
        {selectedResp && !alunoId && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span className="text-primary font-medium">✓ {selectedResp.nome} será vinculado ao salvar o aluno.</span>
            <button
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => { setSelectedResp(null); onSelectExisting?.(null); }}
            >
              Remover
            </button>
          </div>
        )}
      </div>

      {/* === DIVISOR === */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ou</span>
        <Separator className="flex-1" />
      </div>

      {/* === CADASTRAR NOVO === */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">Cadastrar Novo Responsável</h4>
        </div>

        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={form.resp_nome} onChange={e => onFormChange({ resp_nome: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>CPF *</Label>
          <Input
            value={form.resp_cpf}
            onChange={e => onFormChange({ resp_cpf: cpfMask(e.target.value) })}
            placeholder="000.000.000-00"
          />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={form.resp_telefone} onChange={e => onFormChange({ resp_telefone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Parentesco</Label>
          <Select value={form.resp_parentesco} onValueChange={v => onFormChange({ resp_parentesco: v })}>
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
        <Button
          onClick={handleCadastrarNovo}
          disabled={createLoading || !form.resp_nome.trim()}
          className="w-full gap-2"
          variant="secondary"
        >
          {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Cadastrar{alunoId ? ' e Vincular' : ''}
        </Button>
      </div>
    </div>
  );
}
