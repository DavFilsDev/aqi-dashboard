"use client";

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { useState } from "react";
import { aqiColor, aqiLabel } from "@/lib/aqi-scale";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MapCity {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  avg_aqi: number | null;
  n: number;
}

export default function AqiMap({ data }: { data: MapCity[] }) {
  const [hovered, setHovered] = useState<MapCity | null>(null);
  const radiusScale = scaleLinear().domain([1, 5]).range([5, 13]);

  return (
    <div className="relative">
      <ComposableMap
        projectionConfig={{ scale: 140 }}
        className="w-full h-[420px] bg-ink-50 rounded-lg border border-ink-200"
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#181b23"
                stroke="#2f333f"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#20232d" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        {data.map((c) => (
          <Marker
            key={`${c.city}-${c.country}`}
            coordinates={[c.longitude, c.latitude]}
            onMouseEnter={() => setHovered(c)}
            onMouseLeave={() => setHovered(null)}
          >
            <circle
              r={c.avg_aqi ? radiusScale(c.avg_aqi) : 5}
              fill={aqiColor(c.avg_aqi)}
              fillOpacity={0.9}
              stroke="#0a0b0f"
              strokeWidth={1}
            />
          </Marker>
        ))}
      </ComposableMap>

      {hovered && (
        <div className="absolute top-3 left-3 bg-ink-100 border border-ink-200 rounded-md px-3 py-2 shadow-md text-xs">
          <div className="font-medium">{hovered.city}, {hovered.country}</div>
          <div className="text-ink-500">
            AQI moyen : {hovered.avg_aqi?.toFixed(2) ?? "—"} ({aqiLabel(hovered.avg_aqi)})
          </div>
          <div className="text-ink-400">{hovered.n} mesures</div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 text-[11px] font-mono text-ink-500">
        <span>Légende AQI :</span>
        {[1, 2, 3, 4, 5].map((v) => (
          <span key={v} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: aqiColor(v) }}
            />
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
