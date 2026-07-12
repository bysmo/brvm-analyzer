'use client';

import { useEffect, useState } from 'react';

interface Props {
  score: number;
  label: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreGauge({ score, label, color, size = 'md', showLabel = true }: Props) {
  const [animated, setAnimated] = useState(0);
  
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  const sz = size === 'sm' ? 60 : size === 'lg' ? 120 : 90;
  const stroke = size === 'sm' ? 4 : size === 'lg' ? 8 : 6;
  const radius = (sz - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  const colorResolved = color || (score >= 70 ? '#00D678' : score >= 50 ? '#7CFC00' : score >= 30 ? '#FFA500' : '#FF4757');

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: sz, height: sz }}>
        <svg width={sz} height={sz} className="-rotate-90">
          <circle
            cx={sz / 2}
            cy={sz / 2}
            r={radius}
            fill="none"
            stroke="#1F2942"
            strokeWidth={stroke}
          />
          <circle
            cx={sz / 2}
            cy={sz / 2}
            r={radius}
            fill="none"
            stroke={colorResolved}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono font-bold"
            style={{ color: colorResolved, fontSize: size === 'sm' ? '0.9rem' : size === 'lg' ? '1.5rem' : '1.1rem' }}
          >
            {Math.round(animated)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-brvm-fg-muted uppercase tracking-wider">{label}</span>
      )}
    </div>
  );
}
