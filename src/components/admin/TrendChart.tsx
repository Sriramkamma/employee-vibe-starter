import { useMemo } from "react";
import type { TrendDataPoint } from "../../features/admin/adminTypes";

type TrendChartProps = {
  data: TrendDataPoint[];
  metric: keyof Omit<TrendDataPoint, "date">;
  height?: number;
  color?: string;
};

export function TrendChart({ data, metric, height = 240, color = "var(--primary)" }: TrendChartProps) {
  const points = useMemo(() => {
    if (!data.length) return "";
    
    // Reverse data to show oldest to newest (left to right) if needed. 
    // Assuming data is passed oldest to newest already for the chart.
    const width = 800; // SVG viewBox width
    const minVal = 0;
    const maxVal = 100;
    
    const dx = width / (data.length - 1 || 1);
    const dy = height / (maxVal - minVal);

    return data.map((point, i) => {
      const x = i * dx;
      // SVG Y is top-down, so invert it
      const y = height - (Number(point[metric]) - minVal) * dy;
      return `${x},${y}`;
    }).join(" L ");
  }, [data, metric, height]);

  if (!data || data.length === 0) {
    return (
      <div className="admin-empty-state" style={{ height }}>
        <p>Not enough historical data.</p>
      </div>
    );
  }

  const chartPoints = data.map((point, index) => ({
    x: index * (800 / (data.length - 1 || 1)),
    y: height - Number(point[metric]) * (height / 100),
    date: point.date,
    value: Number(point[metric]),
  }));

  return (
    <div className="trend-chart" style={{ width: "100%", height, position: "relative" }}>
      <svg 
        className="trend-chart-svg"
        viewBox={`0 0 800 ${height}`} 
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.95} />
          </linearGradient>
          <linearGradient id={`area-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B7CF6" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.015} />
          </linearGradient>
          <filter id={`glow-${metric}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        
        {/* Background Fill */}
        <path 
          d={`M 0,${height} L ${points} L 800,${height} Z`} 
          fill={`url(#area-${metric})`} 
        />
        
        {/* Line */}
        <path 
          d={`M ${points}`} 
          fill="none" 
          stroke={`url(#grad-${metric})`} 
          strokeWidth="3.5" 
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `url(#glow-${metric})`
          }}
        />
        {chartPoints.map((point) => <circle className="trend-point" key={point.date} cx={point.x} cy={point.y} r="4.5" fill="#fff" stroke="#6555db" strokeWidth="2.5"><title>{`${point.date}: ${point.value} / 100`}</title></circle>)}
      </svg>
      
      {/* Quick axes labels (optional, simplified) */}
      <div className="trend-axis-label" style={{ position: "absolute", bottom: "-24px", left: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {formatChartDate(data[0]?.date ?? "")}
      </div>
      <div className="trend-axis-label" style={{ position: "absolute", bottom: "-24px", right: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {formatChartDate(data[data.length - 1]?.date ?? "")}
      </div>
    </div>
  );
}

function formatChartDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
