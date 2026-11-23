import axios from "axios";
import type {
  ApiCity,
  CriticalRoutes,
  DeliveryOverview,
  SimulationRequest,
  SimulationResult,
} from "@/types/api";

const http = axios.create({
  baseURL: import.meta.env["VITE_API_URL"] ?? "http://localhost:8000",
});

// Com `exactOptionalPropertyTypes`, não dá para passar `signal: undefined` ao axios:
// só incluímos a propriedade quando ela existe.
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

export const getCities = (signal?: AbortSignal) =>
  http
    .get<ApiCity[]>("/api/v1/cities", { ...withSignal(signal) })
    .then((r) => r.data);

export const getOverview = (
  params: { start_date?: string; end_date?: string; city_id?: number; min_orders?: number },
  signal?: AbortSignal,
) =>
  http
    .get<DeliveryOverview>("/api/v1/deliveries/overview", { params, ...withSignal(signal) })
    .then((r) => r.data);

export const getCriticalRoutes = (
  params: {
    city_id: number;
    start_date?: string;
    end_date?: string;
    limit?: number;
    min_orders?: number;
  },
  signal?: AbortSignal,
) =>
  http
    .get<CriticalRoutes>("/api/v1/routes/critical", { params, ...withSignal(signal) })
    .then((r) => r.data);

export const simulateShipment = (body: SimulationRequest, signal?: AbortSignal) =>
  http
    .post<SimulationResult>("/api/v1/simulations", body, { ...withSignal(signal) })
    .then((r) => r.data);

export const isCancel = axios.isCancel;

export function getErrorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg as string;
    if (!err.response) return "Não foi possível conectar ao servidor.";
  }
  return err instanceof Error ? err.message : "Erro inesperado.";
}