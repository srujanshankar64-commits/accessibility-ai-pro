import { useEffect, useState } from "react";

interface Props { score: number; size?: number; label?: string }

export function ScoreGauge({ score, size = 240, label = "Compliance" }: Props) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(Math.round(eased * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color = score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
  const radius = (size - 28) / 2;
  const circumference = 2 * Math.PI * radius * 0.75; // 270deg arc
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="var(--border)" strokeWidth={12} fill="none"
            strokeDasharray={`${circumference} ${2 * Math.PI * radius}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color} strokeWidth={12} fill="none"
            strokeDasharray={`${circumference} ${2 * Math.PI * radius}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke 0.4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-medium" style={{ color }}>{animated}</span>
          <span className="text-xs text-muted-foreground mt-1">/ 100</span>
        </div>
      </div>
      <p className="label-eyebrow mt-4">{label} score</p>
    </div>
  );
}
