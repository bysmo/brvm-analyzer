'use client';

interface Props {
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

export function DonutChart({ data, centerLabel, centerValue, size = 180 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-brvm-fg-muted text-sm" style={{ width: size, height: size }}>
        Données indisponibles
      </div>
    );
  }
  
  const radius = size / 2 - 10;
  const innerRadius = radius * 0.6;
  const cx = size / 2;
  const cy = size / 2;
  
  // Calcul des angles en mode purement fonctionnel (sans mutation de variables externes)
  const angleAccumulator = data.reduce<{ start: number; end: number }[]>((acc, d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const start = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1].end;
    const end = start + angle;
    return [...acc, { start, end }];
  }, []);
  
  const slices = data.map((d, i) => {
    const { start: startAngle, end: endAngle } = angleAccumulator[i];
    
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    
    const x3 = cx + innerRadius * Math.cos(endAngle);
    const y3 = cy + innerRadius * Math.sin(endAngle);
    const x4 = cx + innerRadius * Math.cos(startAngle);
    const y4 = cy + innerRadius * Math.sin(startAngle);
    
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    
    const path = `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;
    
    return { path, color: d.color, name: d.name, value: d.value, pct: (d.value / total) * 100, key: i };
  });
  
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="flex-shrink-0">
        {slices.map(s => (
          <path
            key={s.key}
            d={s.path}
            fill={s.color}
            stroke="#0A0E1A"
            strokeWidth="1"
            className="hover:opacity-80 transition-opacity"
          />
        ))}
        {centerValue && (
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill="#E8EEF7"
            fontSize={size * 0.13}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            fill="#8B95B0"
            fontSize={size * 0.06}
            fontWeight="500"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      
      <div className="flex-1 space-y-1.5 min-w-0">
        {slices.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-brvm-fg-muted flex-1 truncate" title={s.name}>{s.name}</span>
            <span className="font-mono text-brvm-fg">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
