export const states = ["SP", "RJ", "MG", "BA", "PR", "RS", "PE", "CE", "PA", "AM", "SC", "GO"];
export type Order = {
  id: string;
  city: string;
  uf: string;
  origin: string;
  date: string;
  expected: string;
  delivered: string;
  status: string;
  risk: number;
  weight: number;
  value: number;
};
const destinations = [
  ["São Paulo", "SP"],
  ["Rio de Janeiro", "RJ"],
  ["Belo Horizonte", "MG"],
  ["Salvador", "BA"],
  ["Curitiba", "PR"],
  ["Manaus", "AM"],
  ["Recife", "PE"],
  ["Fortaleza", "CE"],
  ["Porto Alegre", "RS"],
  ["Belém", "PA"],
  ["Florianópolis", "SC"],
  ["Goiânia", "GO"],
];
export const orders: Order[] = Array.from({ length: 72 }, (_, i) => {
  const destination = destinations[i % 12] ?? ["São Paulo", "SP"];
  const city = destination[0] ?? "São Paulo";
  const uf = destination[1] ?? "SP";
  const risk = [12, 78, 23, 86, 18, 92, 64, 71, 29, 83, 16, 35][i % 12] ?? 12;
  return {
    id: `OL-${String(84921 + i).padStart(6, "0")}`,
    city,
    uf,
    origin: i % 3 === 0 ? "Campinas, SP" : "São Paulo, SP",
    date: `2018-08-${String(1 + (i % 28)).padStart(2, "0")}`,
    expected: `2018-09-${String(1 + (i % 20)).padStart(2, "0")}`,
    delivered: i % 4 === 0 ? "—" : `2018-09-${String(2 + (i % 20)).padStart(2, "0")}`,
    status: i % 4 === 0 ? "Em trânsito" : risk > 70 ? "Atrasado" : "Entregue",
    risk,
    weight: 0.8 + (i % 8) * 0.5,
    value: 129.9 + (i % 9) * 42,
  };
});
const project = (lon: number, lat: number) => ({
  x: Math.round((12.1 + (lon + 73.99) * 12.73) * 10) / 10,
  y: Math.round((9.2 + (5.27 - lat) * 11.95) * 10) / 10,
});
const cityBase: [string, string, number, number, number, number, number][] = [
  ["São Paulo", "SP", -46.63, -23.55, 14, 28450, 7.2],
  ["Campinas", "SP", -47.06, -22.91, 12, 6120, 6.8],
  ["Ribeirão Preto", "SP", -47.81, -21.18, 18, 2380, 8.4],
  ["Rio de Janeiro", "RJ", -43.2, -22.91, 62, 12840, 12.6],
  ["Niterói", "RJ", -43.1, -22.88, 55, 2210, 11.9],
  ["Belo Horizonte", "MG", -43.94, -19.92, 26, 7380, 10.1],
  ["Uberlândia", "MG", -48.28, -18.92, 31, 1690, 11.4],
  ["Vitória", "ES", -40.31, -20.32, 38, 1920, 12.8],
  ["Curitiba", "PR", -49.27, -25.43, 19, 5240, 9.6],
  ["Londrina", "PR", -51.16, -23.31, 24, 1340, 10.8],
  ["Florianópolis", "SC", -48.55, -27.6, 28, 2460, 11.2],
  ["Joinville", "SC", -48.85, -26.3, 22, 1520, 10.4],
  ["Porto Alegre", "RS", -51.23, -30.03, 34, 4860, 13.1],
  ["Caxias do Sul", "RS", -51.18, -29.17, 37, 1180, 13.8],
  ["Brasília", "DF", -47.88, -15.79, 33, 4120, 12.4],
  ["Goiânia", "GO", -49.25, -16.68, 36, 2680, 12.9],
  ["Campo Grande", "MS", -54.62, -20.47, 44, 1240, 14.6],
  ["Cuiabá", "MT", -56.1, -15.6, 52, 1380, 16.2],
  ["Salvador", "BA", -38.5, -12.97, 84, 3640, 16.8],
  ["Feira de Santana", "BA", -38.97, -12.27, 72, 920, 17.4],
  ["Aracaju", "SE", -37.07, -10.91, 63, 780, 17.9],
  ["Maceió", "AL", -35.73, -9.67, 66, 890, 18.2],
  ["Recife", "PE", -34.88, -8.05, 71, 2940, 17.1],
  ["João Pessoa", "PB", -34.86, -7.12, 64, 1060, 17.6],
  ["Natal", "RN", -35.21, -5.79, 67, 1120, 18.4],
  ["Fortaleza", "CE", -38.54, -3.72, 73, 2580, 18.9],
  ["Teresina", "PI", -42.8, -5.09, 69, 710, 19.6],
  ["São Luís", "MA", -44.3, -2.53, 76, 840, 20.3],
  ["Belém", "PA", -48.5, -1.46, 83, 1860, 19.1],
  ["Palmas", "TO", -48.33, -10.18, 58, 460, 17.2],
  ["Manaus", "AM", -60.02, -3.12, 92, 1250, 22.4],
  ["Porto Velho", "RO", -63.9, -8.76, 79, 520, 21.6],
  ["Rio Branco", "AC", -67.81, -9.97, 88, 310, 24.1],
  ["Boa Vista", "RR", -60.67, 2.82, 86, 280, 23.5],
  ["Macapá", "AP", -51.07, 0.03, 85, 340, 22.8],
];
export type City = {
  name: string;
  uf: string;
  risk: number;
  orders: number;
  days: number;
  x: number;
  y: number;
};
export const cities: City[] = cityBase.map(([name, uf, lon, lat, risk, orders, days]) => ({
  name,
  uf,
  risk,
  orders,
  days,
  ...project(lon, lat),
}));
/** Feriados e datas sazonais pré-configurados (período da base Olist). */
export const holidays = [
  // 2016
  { date: "2016-09-07", name: "Independência do Brasil", impact: 12 },
  { date: "2016-10-12", name: "Nossa Senhora Aparecida", impact: 12 },
  { date: "2016-11-02", name: "Finados", impact: 10 },
  { date: "2016-11-15", name: "Proclamação da República", impact: 14 },
  { date: "2016-11-25", name: "Black Friday", impact: 22 },
  { date: "2016-12-25", name: "Natal", impact: 24 },

  // 2017
  { date: "2017-01-01", name: "Confraternização Universal", impact: 18 },
  { date: "2017-02-28", name: "Carnaval", impact: 20 },
  { date: "2017-04-14", name: "Sexta-feira Santa", impact: 12 },
  { date: "2017-04-16", name: "Páscoa", impact: 14 },
  { date: "2017-04-21", name: "Tiradentes", impact: 10 },
  { date: "2017-05-01", name: "Dia do Trabalho", impact: 10 },
  { date: "2017-05-14", name: "Dia das Mães", impact: 16 },
  { date: "2017-06-15", name: "Corpus Christi", impact: 10 },
  { date: "2017-08-13", name: "Dia dos Pais", impact: 12 },
  { date: "2017-09-07", name: "Independência do Brasil", impact: 12 },
  { date: "2017-10-12", name: "Nossa Senhora Aparecida", impact: 12 },
  { date: "2017-11-02", name: "Finados", impact: 10 },
  { date: "2017-11-15", name: "Proclamação da República", impact: 14 },
  { date: "2017-11-24", name: "Black Friday", impact: 22 },
  { date: "2017-12-25", name: "Natal", impact: 24 },

  // 2018
  { date: "2018-01-01", name: "Confraternização Universal", impact: 18 },
  { date: "2018-02-13", name: "Carnaval", impact: 20 },
  { date: "2018-03-30", name: "Sexta-feira Santa", impact: 12 },
  { date: "2018-04-01", name: "Páscoa", impact: 14 },
  { date: "2018-04-21", name: "Tiradentes", impact: 10 },
  { date: "2018-05-01", name: "Dia do Trabalho", impact: 10 },
  { date: "2018-05-13", name: "Dia das Mães", impact: 16 },
  { date: "2018-05-31", name: "Corpus Christi", impact: 10 },
  { date: "2018-08-12", name: "Dia dos Pais", impact: 12 },
  { date: "2018-09-07", name: "Independência do Brasil", impact: 12 },
  { date: "2018-10-12", name: "Nossa Senhora Aparecida", impact: 12 },
];
const day = (iso: string) => new Date(iso + "T12:00:00").getTime() / 86400000;
/** Estimativa demonstrativa: feriados até 5 dias de distância e fins de semana elevam o risco base da cidade. */
export function dateRiskAdjust(iso: string) {
  let best: { name: string; impact: number; distance: number } | null = null;
  for (const h of holidays) {
    const d = Math.abs(day(iso) - day(h.date));
    if (d <= 5) {
      const impact = Math.round(h.impact * (1 - d / 6));
      if (!best || impact > best.impact) best = { name: h.name, impact, distance: d };
    }
  }
  const wd = new Date(iso + "T12:00:00").getDay();
  const weekend = wd === 0 || wd === 6 ? 5 : 0;
  return { holiday: best, bonus: (best?.impact ?? 0) + weekend, weekend: weekend > 0 };
}
export function cityRisk(base: number, iso: string) {
  return Math.min(98, base + dateRiskAdjust(iso).bonus);
}
export const trends = [
  { month: "Mar", onTime: 88.2, delay: 11.8 },
  { month: "Abr", onTime: 89.6, delay: 10.4 },
  { month: "Mai", onTime: 90.4, delay: 9.6 },
  { month: "Jun", onTime: 89.8, delay: 10.2 },
  { month: "Jul", onTime: 92.1, delay: 7.9 },
  { month: "Ago", onTime: 92.4, delay: 7.6 },
];
export const criticalRoutes = [
  { from: "São Paulo, SP", to: "Manaus, AM", risk: 92, days: 22.4, volume: 1248 },
  { from: "São Paulo, SP", to: "Salvador, BA", risk: 86, days: 16.8, volume: 3642 },
  { from: "Campinas, SP", to: "Belém, PA", risk: 83, days: 19.1, volume: 1863 },
  { from: "São Paulo, SP", to: "Rio de Janeiro, RJ", risk: 78, days: 12.6, volume: 5892 },
];
export function riskLevel(risk: number) {
  return risk >= 70 ? "high" : risk >= 40 ? "medium" : "low";
}
export function riskLabel(risk: number) {
  return risk >= 70 ? "Alto risco" : risk >= 40 ? "Risco moderado" : "Baixo risco";
}
export function downloadCsv(rows: Record<string, unknown>[], name: string) {
  const first = rows[0];
  if (!first) return;
  const keys = Object.keys(first);
  const csv =
    "\uFEFF" +
    [
      keys.join(";"),
      ...rows.map((row) =>
        keys.map((k) => '"' + String(row[k] ?? "").replaceAll('"', '""') + '"').join(";"),
      ),
    ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
export const number = (n: number) => n.toLocaleString("pt-BR");
export function pageHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} · Hypogram` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · Hypogram` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
