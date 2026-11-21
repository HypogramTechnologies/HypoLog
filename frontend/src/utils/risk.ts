// Faixas de risco sobre a taxa de atraso (0-100).
// Ajuste conforme seus dados: a taxa real costuma ser bem menor que 70%.
export const RISK_HIGH = 70;
export const RISK_MEDIUM = 40;

export const riskLevel = (rate: number): "high" | "medium" | "low" =>
  rate >= RISK_HIGH ? "high" : rate >= RISK_MEDIUM ? "medium" : "low";

export const riskTone = (rate: number) =>
  rate >= RISK_HIGH ? "text-danger" : rate >= RISK_MEDIUM ? "text-warning" : "text-success";

export const formatDays = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1).replace(".", ",")} dias`;
