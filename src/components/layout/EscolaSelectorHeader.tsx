import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/lib/mock-db';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Escola { id: string; nome: string; }

export function EscolaSelectorHeader() {
  const { perfil, escolaAtiva, setEscolaAtiva } = useAuthStore();
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const needsSelector = perfil && (perfil.papel === 'DIRETOR' || perfil.papel === 'PROFESSOR');

  useEffect(() => {
    if (!needsSelector || !perfil) return;

    const load = async () => {
      if (perfil.papel === 'DIRETOR') {
        const { data } = await db.diretores.listByUsuario(perfil.id);
        if (data) {
          const mapped = data.map((d: any) => ({ id: d.escolas?.id || d.escola_id, nome: d.escolas?.nome || '' }));
          setEscolas(mapped);
          if (!escolaAtiva && mapped.length > 0) setEscolaAtiva(mapped[0].id);
        }
      } else if (perfil.papel === 'PROFESSOR') {
        const { data } = await db.professorEscolas.listByProfessor(perfil.id);
        if (data) {
          const mapped = data.map((d: any) => ({ id: d.escolas?.id || d.escola_id, nome: d.escolas?.nome || '' }));
          setEscolas(mapped);
          if (!escolaAtiva && mapped.length > 0) setEscolaAtiva(mapped[0].id);
        }
      }
    };
    load();
  }, [perfil, needsSelector]);

  if (!needsSelector || escolas.length <= 1) return null;

  return (
    <Select value={escolaAtiva || ''} onValueChange={setEscolaAtiva}>
      <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue placeholder="Selecione a escola" /></SelectTrigger>
      <SelectContent>{escolas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
    </Select>
  );
}
