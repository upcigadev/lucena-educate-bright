import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Upload, FileText, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';

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

interface FaltaOption {
  frequencia_id: string;
  aluno_nome: string;
  data: string;
  aluno_id: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
  Pendente: { label: 'Pendente', variant: 'secondary', icon: Clock },
  Aprovada: { label: 'Aprovada', variant: 'default', icon: CheckCircle },
  Reprovada: { label: 'Reprovada', variant: 'destructive', icon: XCircle },
};

export default function Justificativas() {
  const { perfil, user } = useAuthStore();
  const isResponsavel = perfil?.papel === 'RESPONSAVEL';
  const isDiretorOrSecretaria = perfil?.papel === 'DIRETOR' || perfil?.papel === 'SECRETARIA';

  const [justificativas, setJustificativas] = useState<JustificativaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<JustificativaRow | null>(null);

  // Form state for new justificativa (responsavel)
  const [faltas, setFaltas] = useState<FaltaOption[]>([]);
  const [selectedFalta, setSelectedFalta] = useState('');
  const [tipo, setTipo] = useState('Atestado Médico');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Approval form (diretor)
  const [observacao, setObservacao] = useState('');

  const loadJustificativas = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('justificativas')
      .select('*, frequencias(data, aluno_id, alunos(nome_completo, matricula)), responsaveis(usuarios(nome))')
      .order('created_at', { ascending: false });

    if (data) {
      setJustificativas(data.map((j: any) => ({
        id: j.id,
        frequencia_id: j.frequencia_id,
        responsavel_id: j.responsavel_id,
        tipo: j.tipo,
        descricao: j.descricao,
        arquivo_url: j.arquivo_url,
        status: j.status,
        observacao_diretor: j.observacao_diretor,
        created_at: j.created_at,
        aluno_nome: j.frequencias?.alunos?.nome_completo || '',
        aluno_matricula: j.frequencias?.alunos?.matricula || '',
        data_falta: j.frequencias?.data || '',
        responsavel_nome: j.responsaveis?.usuarios?.nome || '',
      })));
    }
    setLoading(false);
  };

  const loadFaltas = async () => {
    if (!isResponsavel || !user) return;

    // Get responsavel record
    const { data: resp } = await supabase
      .from('responsaveis')
      .select('id')
      .eq('usuario_id', perfil!.id)
      .single();

    if (!resp) return;

    // Get aluno IDs linked to this responsavel
    const { data: links } = await supabase
      .from('aluno_responsaveis')
      .select('aluno_id, alunos(nome_completo)')
      .eq('responsavel_id', (resp as any).id);

    // Also get from alunos.responsavel_id
    const { data: directAlunos } = await supabase
      .from('alunos')
      .select('id, nome_completo')
      .eq('responsavel_id', (resp as any).id)
      .eq('ativo', true);

    const alunoMap: Record<string, string> = {};
    (links || []).forEach((l: any) => {
      alunoMap[l.aluno_id] = l.alunos?.nome_completo || '';
    });
    (directAlunos || []).forEach((a: any) => {
      alunoMap[a.id] = a.nome_completo;
    });

    const alunoIds = Object.keys(alunoMap);
    if (alunoIds.length === 0) return;

    // Get faltas without justificativa
    const { data: faltasData } = await supabase
      .from('frequencias')
      .select('id, aluno_id, data, status')
      .in('aluno_id', alunoIds)
      .eq('status', 'falta')
      .order('data', { ascending: false });

    if (faltasData) {
      // Exclude ones that already have justificativas
      const { data: existingJust } = await supabase
        .from('justificativas')
        .select('frequencia_id')
        .eq('responsavel_id', (resp as any).id);

      const justifiedIds = new Set((existingJust || []).map((j: any) => j.frequencia_id));

      setFaltas(
        faltasData
          .filter((f: any) => !justifiedIds.has(f.id))
          .map((f: any) => ({
            frequencia_id: f.id,
            aluno_nome: alunoMap[f.aluno_id] || '',
            data: f.data,
            aluno_id: f.aluno_id,
          }))
      );
    }
  };

  useEffect(() => {
    loadJustificativas();
    loadFaltas();
  }, [perfil]);

  const openNew = () => {
    setSelectedFalta('');
    setTipo('Atestado Médico');
    setDescricao('');
    setArquivo(null);
    setSheetOpen(true);
  };

  const submitJustificativa = async () => {
    if (!selectedFalta) {
      toast.error('Selecione a falta a justificar.');
      return;
    }

    setUploading(true);

    try {
      let arquivoUrl: string | null = null;

      // Upload file if present
      if (arquivo && user) {
        const ext = arquivo.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('atestados')
          .upload(filePath, arquivo, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadErr) {
          toast.error(`Erro no upload: ${uploadErr.message}`);
          setUploading(false);
          return;
        }

        arquivoUrl = filePath;
      }

      // Get responsavel ID
      const { data: resp } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('usuario_id', perfil!.id)
        .single();

      if (!resp) {
        toast.error('Responsável não encontrado.');
        setUploading(false);
        return;
      }

      const { error } = await supabase.from('justificativas').insert({
        frequencia_id: selectedFalta,
        responsavel_id: (resp as any).id,
        tipo,
        descricao: descricao.trim() || null,
        arquivo_url: arquivoUrl,
      });

      if (error) {
        toast.error(error.message);
        setUploading(false);
        return;
      }

      toast.success('Justificativa enviada com sucesso!');
      setSheetOpen(false);
      loadJustificativas();
      loadFaltas();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleApproval = async (justificativa: JustificativaRow, approved: boolean) => {
    const newStatus = approved ? 'Aprovada' : 'Reprovada';

    const { error } = await supabase
      .from('justificativas')
      .update({
        status: newStatus,
        observacao_diretor: observacao.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', justificativa.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    // If approved, update frequencia status to 'justificado'
    if (approved) {
      await supabase
        .from('frequencias')
        .update({ status: 'justificado' })
        .eq('id', justificativa.frequencia_id);
    }

    toast.success(`Justificativa ${newStatus.toLowerCase()}.`);
    setDetailSheet(null);
    setObservacao('');
    loadJustificativas();
  };

  const getFileUrl = async (path: string) => {
    const { data } = await supabase.storage.from('atestados').createSignedUrl(path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast.error('Não foi possível abrir o arquivo.');
    }
  };

  const columns: Column<JustificativaRow>[] = [
    { key: 'aluno_nome', header: 'Aluno' },
    {
      key: 'data_falta', header: 'Data da Falta', render: r =>
        r.data_falta ? format(new Date(r.data_falta + 'T00:00:00'), 'dd/MM/yyyy') : '—'
    },
    { key: 'tipo', header: 'Tipo' },
    {
      key: 'status', header: 'Status', render: r => {
        const cfg = statusConfig[r.status] || statusConfig.Pendente;
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      }
    },
    {
      key: 'created_at', header: 'Enviada em', render: r =>
        format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    },
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

      <DataTable
        data={justificativas}
        columns={columns}
        onRowClick={(row) => { setDetailSheet(row); setObservacao(row.observacao_diretor || ''); }}
        searchPlaceholder="Buscar justificativa…"
      />

      {/* New justificativa sheet (responsavel) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova Justificativa</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Falta a justificar *</Label>
              {faltas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Não há faltas pendentes de justificativa.
                </p>
              ) : (
                <Select value={selectedFalta} onValueChange={setSelectedFalta}>
                  <SelectTrigger><SelectValue placeholder="Selecione a falta" /></SelectTrigger>
                  <SelectContent>
                    {faltas.map(f => (
                      <SelectItem key={f.frequencia_id} value={f.frequencia_id}>
                        {f.aluno_nome} — {format(new Date(f.data + 'T00:00:00'), 'dd/MM/yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

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

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva o motivo da falta…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Anexo (PDF ou imagem)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={e => setArquivo(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  {arquivo ? (
                    <p className="text-sm font-medium text-foreground">{arquivo.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Clique para selecionar arquivo</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — máx. 10 MB</p>
                </label>
              </div>
            </div>

            <Button
              onClick={submitJustificativa}
              className="w-full"
              disabled={!selectedFalta || uploading}
            >
              {uploading ? 'Enviando…' : 'Enviar Justificativa'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail / approval sheet */}
      <Sheet open={!!detailSheet} onOpenChange={() => setDetailSheet(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Justificativa</SheetTitle>
          </SheetHeader>
          {detailSheet && (
            <div className="space-y-5 mt-4">
              <div className="space-y-3">
                <InfoRow label="Aluno" value={detailSheet.aluno_nome || '—'} />
                <InfoRow label="Matrícula" value={detailSheet.aluno_matricula || '—'} />
                <InfoRow
                  label="Data da Falta"
                  value={detailSheet.data_falta ? format(new Date(detailSheet.data_falta + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                />
                <InfoRow label="Responsável" value={detailSheet.responsavel_nome || '—'} />
                <InfoRow label="Tipo" value={detailSheet.tipo} />
                <InfoRow label="Descrição" value={detailSheet.descricao || 'Nenhuma descrição'} />
                <InfoRow
                  label="Enviada em"
                  value={format(new Date(detailSheet.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                />

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant={statusConfig[detailSheet.status]?.variant || 'secondary'}>
                    {detailSheet.status}
                  </Badge>
                </div>

                {detailSheet.observacao_diretor && (
                  <InfoRow label="Observação do Diretor" value={detailSheet.observacao_diretor} />
                )}
              </div>

              {/* File viewer */}
              {detailSheet.arquivo_url && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => getFileUrl(detailSheet.arquivo_url!)}
                >
                  <FileText className="h-4 w-4" />
                  Ver Anexo
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              )}

              {/* Approval actions (diretor/secretaria only) */}
              {isDiretorOrSecretaria && detailSheet.status === 'Pendente' && (
                <div className="space-y-3 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Observação (opcional)</Label>
                    <Textarea
                      value={observacao}
                      onChange={e => setObservacao(e.target.value)}
                      placeholder="Adicione uma observação…"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => handleApproval(detailSheet, true)}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-1.5"
                      onClick={() => handleApproval(detailSheet, false)}
                    >
                      <XCircle className="h-4 w-4" />
                      Reprovar
                    </Button>
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
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
