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

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <svg 
        viewBox={`0 0 800 ${height}`} 
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        
        {/* Background Fill */}
        <path 
          d={`M 0,${height} L ${points} L 800,${height} Z`} 
          fill={`url(#grad-${metric})`} 
        />
        
        {/* Line */}
        <path 
          d={`M ${points}`} 
          fill="none" 
          stroke={color} 
          strokeWidth="3" 
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0px 4px 6px ${color}40)`
          }}
        />
      </svg>
      
      {/* Quick axes labels (optional, simplified) */}
      <div style={{ position: "absolute", bottom: "-24px", left: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {data[0]?.date}
      </div>
      <div style={{ position: "absolute", bottom: "-24px", right: 0, fontSize: 12, color: "var(--text-muted)" }}>
        {data[data.length - 1]?.date}
      </div>
    </div>
  );
}
