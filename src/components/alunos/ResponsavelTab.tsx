import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Link2, UserPlus } from 'lucide-react';
import { cpfMask } from '@/lib/cpf';

// Mock data for existing responsáveis
const MOCK_RESPONSAVEIS = [
  { id: '1', nome: 'Maria da Silva', cpf: '123.456.789-00' },
  { id: '2', nome: 'João Santos', cpf: '987.654.321-00' },
  { id: '3', nome: 'Ana Oliveira', cpf: '456.789.123-00' },
  { id: '4', nome: 'Carlos Pereira', cpf: '321.654.987-00' },
  { id: '5', nome: 'Fernanda Lima', cpf: '654.321.987-00' },
];

interface ResponsavelTabProps {
  form: {
    resp_nome: string;
    resp_cpf: string;
    resp_telefone: string;
    resp_parentesco: string;
  };
  onFormChange: (updates: Partial<ResponsavelTabProps['form']>) => void;
}

export function ResponsavelTab({ form, onFormChange }: ResponsavelTabProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedResp, setSelectedResp] = useState<typeof MOCK_RESPONSAVEIS[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResp = MOCK_RESPONSAVEIS.filter(
    r => r.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
         r.cpf.includes(searchQuery)
  );

  return (
    <div className="space-y-5 mt-3">
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
                <span>{selectedResp.nome} — <span className="text-muted-foreground">{selectedResp.cpf}</span></span>
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
                <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                <CommandGroup>
                  {filteredResp.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${r.nome} ${r.cpf}`}
                      onSelect={() => {
                        setSelectedResp(r);
                        setSearchOpen(false);
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

        {selectedResp && (
          <Button className="w-full gap-2" size="sm">
            <Link2 className="h-4 w-4" />
            Vincular {selectedResp.nome.split(' ')[0]}
          </Button>
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
      </div>
    </div>
  );
}
