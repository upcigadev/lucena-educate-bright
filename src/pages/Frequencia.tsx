import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

export default function Frequencia() {
  return (
    <div>
      <PageHeader title="Frequência" description="Controle de presença por turma" />
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Acesse a frequência através do painel de cada escola.</p>
          <p className="text-xs mt-1">Navegue por Escolas → Turma para ver a chamada.</p>
        </CardContent>
      </Card>
    </div>
  );
}
