import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface JustificativaRow {
  id: string;
  frequencia_id: string;
  responsavel_id: string;
  tipo: string;
  descricao: string | null;
  arquivo_url: string | null;
  status: string;
  observacao_diretor: string | null;
  created_at: string;
  aluno_nome?: string;
  aluno_matricula?: string;
  data_falta?: string;
  responsavel_nome?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
  Pendente: { label: 'Pendente', variant: 'secondary', icon: Clock },
  Aprovada: { label: 'Aprovada', variant: 'default', icon: CheckCircle },
  Reprovada: { label: 'Reprovada', variant: 'destructive', icon: XCircle },
};

export default function Justificativas() {
  const { perfil } = useAuthStore();
  const isResponsavel = perfil?.papel === 'RESPONSAVEL';
  const isDiretorOrSecretaria = perfil?.papel === 'DIRETOR' || perfil?.papel === 'SECRETARIA';

  // TODO: Replace with SQLite queries
  const [justificativas] = useState<JustificativaRow[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<JustificativaRow | null>(null);
  const [tipo, setTipo] = useState('Atestado Médico');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacao, setObservacao] = useState('');

  const openNew = () => { setTipo('Atestado Médico'); setDescricao(''); setArquivo(null); setSheetOpen(true); };

  const submitJustificativa = () => {
    // TODO: Implement with SQLite
    toast.info('TODO: Submeter justificativa via SQLite');
    setSheetOpen(false);
  };

  const handleApproval = (justificativa: JustificativaRow, approved: boolean) => {
    // TODO: Implement with SQLite
    toast.info(`TODO: ${approved ? 'Aprovar' : 'Reprovar'} justificativa via SQLite`);
    setDetailSheet(null);
  };

  const columns: Column<JustificativaRow>[] = [
    { key: 'aluno_nome', header: 'Aluno' },
    { key: 'data_falta', header: 'Data da Falta', render: r => r.data_falta ? format(new Date(r.data_falta + 'T00:00:00'), 'dd/MM/yyyy') : '—' },
    { key: 'tipo', header: 'Tipo' },
    { key: 'status', header: 'Status', render: r => { const cfg = statusConfig[r.status] || statusConfig.Pendente; return <Badge variant={cfg.variant}>{cfg.label}</Badge>; }},
    { key: 'created_at', header: 'Enviada em', render: r => format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) },
  ];

  if (!isResponsavel) {
    columns.splice(1, 0, { key: 'responsavel_nome', header: 'Responsável' });
  }

  return (
    <div>
      <PageHeader
        title="Justificativas de Falta"
        description={isResponsavel ? 'Envie justificativas para as faltas dos seus alunos' : 'Gerencie justificativas de falta'}
        actionLabel={isResponsavel ? 'Justificar Falta' : undefined}
        onAction={isResponsavel ? openNew : undefined}
      />

      <DataTable data={justificativas} columns={columns} onRowClick={(row) => { setDetailSheet(row); setObservacao(row.observacao_diretor || ''); }} searchPlaceholder="Buscar justificativa…" />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Nova Justificativa</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">TODO: Conectar com SQLite para listar faltas pendentes.</p>
            <div className="space-y-2">
              <Label>Tipo de Justificativa *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Atestado Médico">Atestado Médico</SelectItem>
                  <SelectItem value="Viagem">Viagem</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o motivo da falta…" rows={3} /></div>
            <div className="space-y-2">
              <Label>Anexo (PDF ou imagem)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setArquivo(e.target.files?.[0] || null)} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  {arquivo ? <p className="text-sm font-medium text-foreground">{arquivo.name}</p> : <p className="text-sm text-muted-foreground">Clique para selecionar arquivo</p>}
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — máx. 10 MB</p>
                </label>
              </div>
            </div>
            <Button onClick={submitJustificativa} className="w-full">Enviar Justificativa</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!detailSheet} onOpenChange={() => setDetailSheet(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Detalhes da Justificativa</SheetTitle></SheetHeader>
          {detailSheet && (
            <div className="space-y-5 mt-4">
              <div className="space-y-3">
                <InfoRow label="Aluno" value={detailSheet.aluno_nome || '—'} />
                <InfoRow label="Tipo" value={detailSheet.tipo} />
                <InfoRow label="Descrição" value={detailSheet.descricao || 'Nenhuma descrição'} />
                <div><p className="text-xs text-muted-foreground mb-1">Status</p><Badge variant={statusConfig[detailSheet.status]?.variant || 'secondary'}>{detailSheet.status}</Badge></div>
              </div>
              {isDiretorOrSecretaria && detailSheet.status === 'Pendente' && (
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-2"><Label>Observação (opcional)</Label><Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Adicione uma observação…" rows={2} /></div>
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-1.5" onClick={() => handleApproval(detailSheet, true)}><CheckCircle className="h-4 w-4" />Aprovar</Button>
                    <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => handleApproval(detailSheet, false)}><XCircle className="h-4 w-4" />Reprovar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium text-foreground">{value}</p></div>;
}
