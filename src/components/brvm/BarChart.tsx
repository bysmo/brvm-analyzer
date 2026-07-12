'use client';

interface Props {
  data: { label: string; value: number; max: number; color?: string }[];
}

export function BarChart({ data }: Props) {
  const maxVal = Math.max(...data.map(d => d.max), ...data.map(d => d.value), 1);
  
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = (d.value / maxVal) * 100;
        const color = d.color || '#00D678';
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-brvm-fg-muted">{d.label}</span>
              <span className="font-mono text-brvm-fg">{d.value.toLocaleString('fr-FR')}</span>
            </div>
            <div className="h-2 bg-brvm-bg-soft rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
