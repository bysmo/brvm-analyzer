'use client';

interface DataPoint {
  year: number;
  ca?: number;
  rn?: number;
  div?: number;
  bnpa?: number;
  per?: number;
}

interface Props {
  data: DataPoint[];
  series: ('ca' | 'rn' | 'div' | 'bnpa' | 'per')[];
  height?: number;
}

const COLORS: Record<string, string> = {
  ca: '#4DA3FF',
  rn: '#00D678',
  div: '#FFA500',
  bnpa: '#B47CFF',
  per: '#FF4757',
};

const LABELS: Record<string, string> = {
  ca: "Chiffre d'affaires",
  rn: 'Résultat net',
  div: 'Dividende',
  bnpa: 'BNPA',
  per: 'PER',
};

export function MiniLineChart({ data, series, height = 200 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-brvm-fg-muted text-sm" style={{ height }}>
        Données indisponibles
      </div>
    );
  }

  const allValues = data.flatMap(d => series.map(s => d[s])).filter((v): v is number => v != null && v > 0);
  if (allValues.length === 0) {
    return (
      <div className="flex items-center justify-center text-brvm-fg-muted text-sm" style={{ height }}>
        Aucune donnée numérique
      </div>
    );
  }
  const max = Math.max(...allValues);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  
  const width = 100;
  const padX = 8;
  const padY = 10;

  const points = (key: keyof DataPoint) => {
    return data
      .map((d, i) => {
        const v = d[key];
        if (v == null || v <= 0) return null;
        const x = padX + (i / Math.max(1, data.length - 1)) * (width - 2 * padX);
        const y = height - padY - ((v - min) / range) * (height - 2 * padY);
        return { x, y, v, year: d.year };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={padY + t * (height - 2 * padY)}
            y2={padY + t * (height - 2 * padY)}
            stroke="#1F2942"
            strokeWidth="0.2"
          />
        ))}
        
        {/* Lines */}
        {series.map(s => {
          const pts = points(s);
          if (pts.length < 2) return null;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          const color = COLORS[s];
          return (
            <g key={s}>
              <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="0.8" fill={color} />
              ))}
            </g>
          );
        })}
        
        {/* X axis labels */}
        {data.map((d, i) => {
          const x = padX + (i / Math.max(1, data.length - 1)) * (width - 2 * padX);
          return (
            <text
              key={i}
              x={x}
              y={height - 2}
              textAnchor="middle"
              fill="#5C6789"
              fontSize="3"
              fontFamily="monospace"
            >
              {d.year}
            </text>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {series.map(s => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-3 h-0.5" style={{ backgroundColor: COLORS[s] }} />
            <span className="text-xs text-brvm-fg-muted">{LABELS[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
