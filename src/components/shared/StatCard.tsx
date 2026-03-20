import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
}

const colorMap = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatCard({ title, value, icon: Icon, color = 'primary' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-card-foreground mt-1 tabular-nums">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
