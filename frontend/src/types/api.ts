// Tipos da API HypoLog (espelham o openapi.json)

export type ApiCity = {
  city_id: number;
  city_name: string;
  state_id: number;
  state_code: string;
  state_name: string;
};

export type DeliverySummary = {
  total_orders: number;
  delayed_orders: number;
  /** Percentual de pedidos atrasados (0-100) */
  delay_rate: number;
  /** Tempo médio entre compra e entrega, em dias */
  avg_delivery_days: number | null;
};

export type HeatmapPoint = {
  lat: number;
  lng: number;
  /** Intensidade (0-1) = taxa de atraso */
  weight: number;
  label: string;
  /** Preenchido apenas no nível "city" */
  city_id?: number | null;
  total_orders: number;
  /** Percentual (0-100) */
  delay_rate: number;
};

export type Heatmap = {
  level: "city" | "zip_prefix";
  points: HeatmapPoint[];
};

export type DeliveryOverview = {
  /** null = Brasil todo */
  city: ApiCity | null;
  summary: DeliverySummary;
  heatmap: Heatmap;
};

export type CriticalRoute = {
  rank: number;
  origin: ApiCity;
  total_orders: number;
  delayed_orders: number;
  delay_rate: number;
  avg_delivery_days: number;
  avg_delay_days: number | null;
};

export type CriticalRoutes = {
  destination: ApiCity;
  routes: CriticalRoute[];
};
