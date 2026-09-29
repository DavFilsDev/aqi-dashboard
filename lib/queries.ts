import { getPool, queryWithRetry } from "@/lib/db";
import { toIsoString } from "@/lib/format";
import { City, CityStat, DayTypePoint, FactRow, Filters, HourPoint, TimePoint } from "@/types/aqi";

interface WhereClause {
  sql: string;
  params: unknown[];
}

function buildWhere(filters: Filters, startAt = 1): WhereClause {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = startAt;

  if (filters.cities.length > 0) {
    const pairs = filters.cities
      .map((c) => c.split("|"))
      .filter((p) => p.length === 2);
    if (pairs.length > 0) {
      const orClauses = pairs.map(() => {
        const clause = `(dim_city.city = $${i} AND dim_city.country = $${i + 1})`;
        i += 2;
        return clause;
      });
      pairs.forEach(([city, country]) => params.push(city, country));
      clauses.push(`(${orClauses.join(" OR ")})`);
    }
  }
  if (filters.from) {
    clauses.push(`dim_time.date >= $${i}`);
    params.push(filters.from);
    i += 1;
  }
  if (filters.to) {
    clauses.push(`dim_time.date <= $${i}`);
    params.push(filters.to);
    i += 1;
  }
  clauses.push(`fact_aqi.aqi >= $${i}`);
  params.push(filters.aqiMin);
  i += 1;
  clauses.push(`fact_aqi.aqi <= $${i}`);
  params.push(filters.aqiMax);
  i += 1;

  if (filters.pm25Min !== null) {
    clauses.push(`fact_aqi.pm25 >= $${i}`);
    params.push(filters.pm25Min);
    i += 1;
  }
  if (filters.pm10Min !== null) {
    clauses.push(`fact_aqi.pm10 >= $${i}`);
    params.push(filters.pm10Min);
    i += 1;
  }
  if (filters.no2Min !== null) {
    clauses.push(`fact_aqi.no2 >= $${i}`);
    params.push(filters.no2Min);
    i += 1;
  }
  if (filters.o3Min !== null) {
    clauses.push(`fact_aqi.o3 >= $${i}`);
    params.push(filters.o3Min);
    i += 1;
  }
  if (filters.dayType === "weekday") clauses.push(`dim_time.is_weekend = false`);
  if (filters.dayType === "weekend") clauses.push(`dim_time.is_weekend = true`);

  clauses.push(`dim_time.hour >= $${i}`);
  params.push(filters.hourMin);
  i += 1;
  clauses.push(`dim_time.hour <= $${i}`);
  params.push(filters.hourMax);
  i += 1;

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

const FROM_JOIN = `
  FROM fact_aqi
  JOIN dim_city ON dim_city.city_id = fact_aqi.city_id
  JOIN dim_time ON dim_time.time_id = fact_aqi.time_id
`;

export async function getAllCities(): Promise<City[]> {
  const pool = getPool();
  const { rows } = await queryWithRetry<City>(pool, 
    `SELECT city_id, city, country, latitude, longitude FROM dim_city ORDER BY country, city`
  );
  return rows;
}

export async function getLastRefresh(): Promise<string | null> {
  const pool = getPool();
  const { rows } = await queryWithRetry<{ max: Date | string | null }>(pool,
    `SELECT MAX(timestamp_utc) as max FROM dim_time`
  );
  return toIsoString(rows[0]?.max);
}

export async function getOverviewKpis(filters: Filters) {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const { rows } = await queryWithRetry(pool, 
    `SELECT
       AVG(fact_aqi.aqi) as global_avg_aqi,
       COUNT(*) as total_points,
       MIN(dim_time.date) as min_date,
       MAX(dim_time.date) as max_date
     ${FROM_JOIN}
     ${sql}`,
    params
  );
  return rows[0];
}

export async function getDaysAboveThreshold(filters: Filters, threshold: number) {
  const pool = getPool();
  const { sql, params } = buildWhere(filters, 1);
  const idx = params.length + 1;
  const { rows } = await queryWithRetry(pool, 
    `SELECT COUNT(DISTINCT dim_time.date) as days
     ${FROM_JOIN}
     ${sql ? sql + " AND" : "WHERE"} fact_aqi.aqi >= $${idx}`,
    [...params, threshold]
  );
  return Number(rows[0]?.days ?? 0);
}

export async function getCityStats(filters: Filters): Promise<CityStat[]> {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const { rows } = await queryWithRetry<CityStat>(pool, 
    `SELECT dim_city.city, dim_city.country,
            AVG(fact_aqi.aqi) as avg_aqi,
            AVG(fact_aqi.pm25) as avg_pm25,
            COUNT(*) as n
     ${FROM_JOIN}
     ${sql}
     GROUP BY dim_city.city, dim_city.country
     ORDER BY avg_aqi DESC NULLS LAST`,
    params
  );
  return rows.map((r) => ({
    ...r,
    avg_aqi: Number(r.avg_aqi),
    avg_pm25: Number(r.avg_pm25),
    n: Number(r.n),
  }));
}

export async function getTimeSeries(filters: Filters, granularity: "day" | "hour" = "day"): Promise<TimePoint[]> {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const bucketExpr =
    granularity === "day" ? `dim_time.date` : `date_trunc('hour', dim_time.timestamp_utc)`;
  const { rows } = await queryWithRetry<TimePoint>(pool, 
    `SELECT ${bucketExpr} as bucket, AVG(fact_aqi.aqi) as avg_aqi
     ${FROM_JOIN}
     ${sql}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    params
  );
  return rows.map((r) => ({ bucket: String(r.bucket), avg_aqi: Number(r.avg_aqi) }));
}

export async function getHourlyAverages(filters: Filters): Promise<HourPoint[]> {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const { rows } = await queryWithRetry<HourPoint>(pool, 
    `SELECT dim_time.hour as hour, AVG(fact_aqi.aqi) as avg_aqi
     ${FROM_JOIN}
     ${sql}
     GROUP BY dim_time.hour
     ORDER BY dim_time.hour ASC`,
    params
  );
  return rows.map((r) => ({ hour: Number(r.hour), avg_aqi: Number(r.avg_aqi) }));
}

export async function getWeekdayVsWeekend(filters: Filters): Promise<DayTypePoint[]> {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const { rows } = await queryWithRetry(pool, 
    `SELECT dim_time.is_weekend as is_weekend, AVG(fact_aqi.aqi) as avg_aqi
     ${FROM_JOIN}
     ${sql}
     GROUP BY dim_time.is_weekend`,
    params
  );
  return rows.map((r: any) => ({
    day_type: r.is_weekend ? "Weekend" : "Weekday",
    avg_aqi: Number(r.avg_aqi),
  }));
}

export async function getCityDetail(cityId: number, filters: Filters) {
  const pool = getPool();
  const { sql, params } = buildWhere(filters, 2);
  const whereWithCity = sql ? `${sql} AND fact_aqi.city_id = $1` : `WHERE fact_aqi.city_id = $1`;

  const cityRes = await queryWithRetry<City>(pool, 
    `SELECT city_id, city, country, latitude, longitude FROM dim_city WHERE city_id = $1`,
    [cityId]
  );
  const city = cityRes.rows[0] ?? null;

  const series = await queryWithRetry(pool, 
    `SELECT dim_time.date as bucket, AVG(fact_aqi.aqi) as avg_aqi
     ${FROM_JOIN}
     ${whereWithCity}
     GROUP BY bucket ORDER BY bucket ASC`,
    [cityId, ...params]
  );

  const pollutants = await queryWithRetry(pool, 
    `SELECT AVG(fact_aqi.pm25) as pm25, AVG(fact_aqi.pm10) as pm10,
            AVG(fact_aqi.no2) as no2, AVG(fact_aqi.o3) as o3,
            AVG(fact_aqi.aqi) as avg_aqi, COUNT(*) as n
     ${FROM_JOIN}
     ${whereWithCity}`,
    [cityId, ...params]
  );

  return {
    city,
    series: series.rows.map((r) => ({ bucket: String(r.bucket), avg_aqi: Number(r.avg_aqi) })),
    stats: pollutants.rows[0],
  };
}

export async function getCorrelationMatrix(filters: Filters) {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const cols = ["aqi", "pm25", "pm10", "no2", "o3"];
  const { rows } = await queryWithRetry(pool, 
    `SELECT
       corr(fact_aqi.aqi, fact_aqi.aqi) as aqi_aqi,
       corr(fact_aqi.aqi, fact_aqi.pm25) as aqi_pm25,
       corr(fact_aqi.aqi, fact_aqi.pm10) as aqi_pm10,
       corr(fact_aqi.aqi, fact_aqi.no2) as aqi_no2,
       corr(fact_aqi.aqi, fact_aqi.o3) as aqi_o3,
       corr(fact_aqi.pm25, fact_aqi.pm25) as pm25_pm25,
       corr(fact_aqi.pm25, fact_aqi.pm10) as pm25_pm10,
       corr(fact_aqi.pm25, fact_aqi.no2) as pm25_no2,
       corr(fact_aqi.pm25, fact_aqi.o3) as pm25_o3,
       corr(fact_aqi.pm10, fact_aqi.pm10) as pm10_pm10,
       corr(fact_aqi.pm10, fact_aqi.no2) as pm10_no2,
       corr(fact_aqi.pm10, fact_aqi.o3) as pm10_o3,
       corr(fact_aqi.no2, fact_aqi.no2) as no2_no2,
       corr(fact_aqi.no2, fact_aqi.o3) as no2_o3,
       corr(fact_aqi.o3, fact_aqi.o3) as o3_o3
     ${FROM_JOIN}
     ${sql}`,
    params
  );
  const r = rows[0] as Record<string, string | null>;
  const get = (a: string, b: string) => {
    const key = `${a}_${b}` in r ? `${a}_${b}` : `${b}_${a}`;
    const v = r[key];
    return v === null || v === undefined ? null : Number(v);
  };
  const matrix: Record<string, Record<string, number | null>> = {};
  for (const a of cols) {
    matrix[a] = {};
    for (const b of cols) matrix[a][b] = get(a, b);
  }
  return matrix;
}

export async function getScatterData(filters: Filters, limit = 2000) {
  const pool = getPool();
  const { sql, params } = buildWhere(filters, 1);
  const idx = params.length + 1;
  const { rows } = await queryWithRetry(pool, 
    `SELECT fact_aqi.pm25 as pm25, fact_aqi.aqi as aqi
     ${FROM_JOIN}
     ${sql ? sql + " AND" : "WHERE"} fact_aqi.pm25 IS NOT NULL AND fact_aqi.aqi IS NOT NULL
     ORDER BY random()
     LIMIT $${idx}`,
    [...params, limit]
  );
  return rows.map((r: any) => ({ pm25: Number(r.pm25), aqi: Number(r.aqi) }));
}

export async function getMapStats(filters: Filters) {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const { rows } = await queryWithRetry(pool, 
    `SELECT dim_city.city, dim_city.country, dim_city.latitude, dim_city.longitude,
            AVG(fact_aqi.aqi) as avg_aqi, COUNT(*) as n
     ${FROM_JOIN}
     ${sql}
     GROUP BY dim_city.city, dim_city.country, dim_city.latitude, dim_city.longitude`,
    params
  );
  return rows.map((r: any) => ({
    city: r.city,
    country: r.country,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    avg_aqi: r.avg_aqi === null ? null : Number(r.avg_aqi),
    n: Number(r.n),
  }));
}

const SORTABLE_COLUMNS: Record<string, string> = {
  timestamp_utc: "dim_time.timestamp_utc",
  city: "dim_city.city",
  aqi: "fact_aqi.aqi",
  pm25: "fact_aqi.pm25",
  pm10: "fact_aqi.pm10",
  no2: "fact_aqi.no2",
  o3: "fact_aqi.o3",
};

export async function getExplorerRows(
  filters: Filters
): Promise<{ rows: FactRow[]; total: number }> {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const sortCol = SORTABLE_COLUMNS[filters.sortBy ?? "timestamp_utc"] ?? "dim_time.timestamp_utc";
  const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const countRes = await queryWithRetry(pool, `SELECT COUNT(*) as n ${FROM_JOIN} ${sql}`, params);
  const total = Number(countRes.rows[0]?.n ?? 0);

  const dataParams = [...params, pageSize, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const { rows } = await queryWithRetry(pool, 
    `SELECT fact_aqi.fact_id, dim_city.city, dim_city.country,
            dim_time.timestamp_utc, dim_time.date, dim_time.hour,
            dim_time.day_of_week, dim_time.is_weekend,
            fact_aqi.aqi, fact_aqi.pm25, fact_aqi.pm10, fact_aqi.no2, fact_aqi.o3
     ${FROM_JOIN}
     ${sql}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    dataParams
  );

  return {
    rows: rows.map((r: any) => ({
      ...r,
      timestamp_utc: String(r.timestamp_utc),
      date: String(r.date),
    })),
    total,
  };
}

export async function getExplorerRowsForExport(filters: Filters, cap = 20000): Promise<FactRow[]> {
  const pool = getPool();
  const { sql, params } = buildWhere(filters);
  const sortCol = SORTABLE_COLUMNS[filters.sortBy ?? "timestamp_utc"] ?? "dim_time.timestamp_utc";
  const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
  const idx = params.length + 1;
  const { rows } = await queryWithRetry(pool, 
    `SELECT dim_city.city, dim_city.country,
            dim_time.timestamp_utc, dim_time.date, dim_time.hour,
            dim_time.day_of_week, dim_time.is_weekend,
            fact_aqi.aqi, fact_aqi.pm25, fact_aqi.pm10, fact_aqi.no2, fact_aqi.o3
     ${FROM_JOIN}
     ${sql}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT $${idx}`,
    [...params, cap]
  );
  return rows.map((r: any) => ({
    ...r,
    timestamp_utc: String(r.timestamp_utc),
    date: String(r.date),
  }));
}
