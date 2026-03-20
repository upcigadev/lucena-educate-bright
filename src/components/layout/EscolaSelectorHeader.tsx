import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Escola {
  id: string;
  nome: string;
}

export function EscolaSelectorHeader() {
  const { perfil, escolaAtiva, setEscolaAtiva } = useAuthStore();
  const [escolas, setEscolas] = useState<Escola[]>([]);

  const needsSelector = perfil && (perfil.papel === 'DIRETOR' || perfil.papel === 'PROFESSOR');

  useEffect(() => {
    if (!needsSelector || !perfil) return;

    const fetchEscolas = async () => {
      if (perfil.papel === 'DIRETOR') {
        const { data } = await supabase
          .from('diretores')
          .select('escola_id, escolas(id, nome)')
          .eq('usuario_id', perfil.id);
        if (data) {
          const mapped = data.map((d: any) => ({ id: d.escolas.id, nome: d.escolas.nome }));
          setEscolas(mapped);
          if (!escolaAtiva && mapped.length > 0) setEscolaAtiva(mapped[0].id);
        }
      } else if (perfil.papel === 'PROFESSOR') {
        const { data } = await supabase
          .from('professor_escolas')
          .select('escola_id, escolas(id, nome)')
          .eq('professor_id', perfil.id);
        if (data) {
          const mapped = data.map((d: any) => ({ id: d.escolas.id, nome: d.escolas.nome }));
          setEscolas(mapped);
          if (!escolaAtiva && mapped.length > 0) setEscolaAtiva(mapped[0].id);
        }
      }
    };
    fetchEscolas();
  }, [perfil, needsSelector]);

  if (!needsSelector || escolas.length <= 1) return null;

  return (
    <Select value={escolaAtiva || ''} onValueChange={setEscolaAtiva}>
      <SelectTrigger className="w-[220px] h-9 text-sm">
        <SelectValue placeholder="Selecione a escola" />
      </SelectTrigger>
      <SelectContent>
        {escolas.map((e) => (
          <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
