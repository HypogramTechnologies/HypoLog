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

// ---------- Simulador de risco (POST /api/v1/simulations) ----------
export type SimulationRequest = {
  origin_zip: string;
  destination_zip: string;
  weight_kg: number;
  order_value: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  /** Prazo prometido, em dias corridos (inteiro) */
  estimated_days: number;
  n_items?: number;
  /** AAAA-MM-DD. Vazio = hoje */
  purchase_date?: string;
};

export type RiskLevel = "low" | "moderate" | "high";

export type SimulationLocation = {
  zip_code: string;
  city_name: string | null;
  state_code: string | null;
  zone: string | null;
  approximated: boolean;
};

export type SimulationFactor = {
  code: "distance" | "deadline" | "destination_history" | "destination_zone";
  impact: "raises" | "lowers" | "neutral";
  label: string;
};

export type SimulationResult = {
  /** Probabilidade estimada de atraso (0-100) */
  delay_probability: number;
  risk_level: RiskLevel;
  estimated_days: number;
  typical_days: number;
  distance_km: number;
  origin: SimulationLocation;
  destination: SimulationLocation;
  factors: SimulationFactor[];
  model: {
    kind: "historical_baseline" | "ml_model";
    name: string;
    sample_size: number;
    uses_package_features: boolean;
  };
};

