import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Package,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { downloadCsv, orders, states, type Order } from "@/lib/hypogram-data";
import { AppShell, OrderDetail, PageHeading, PanelHeading, RiskPill } from "./shared";
export function OrdersPage() {
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("all");
  const [status, setStatus] = useState("all");
  const [start, setStart] = useState("2018-08-01");
  const [end, setEnd] = useState("2018-08-31");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Order | null>(null);
  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (uf === "all" || o.uf === uf) &&
          (status === "all" || o.status === status) &&
          o.date >= start &&
          o.date <= end &&
          `${o.id} ${o.city}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [uf, status, start, end, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const reset = () => {
    setSearch("");
    setUf("all");
    setStatus("all");
    setStart("2018-08-01");
    setEnd("2018-08-31");
    setPage(1);
  };
  return (
    <AppShell>
      <PageHeading
        title="Pedidos"
        subtitle="Explore o histórico de envios e identifique entregas que precisam de atenção."
      >
        <Button
          variant="outline"
          onClick={() => {
            downloadCsv(filtered, "hypogram-pedidos");
            toast.success(`${filtered.length} pedidos exportados`);
          }}
        >
          <Download />
          Exportar pedidos
        </Button>
      </PageHeading>
      <section className="panel mb-5">
        <PanelHeading title="Filtros de pedidos">
          <Button variant="ghost" size="sm" onClick={reset}>
            <X />
            Limpar filtros
          </Button>
        </PanelHeading>
        <div className="filters px-[22px] pb-5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
            <input
              aria-label="Buscar pedidos"
              placeholder="Buscar pedido, pedido ou cidade"
              className="search-control pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <input
            type="date"
            aria-label="Data inicial"
            className="select-control"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            type="date"
            aria-label="Data final"
            className="select-control"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <select
            aria-label="Estado"
            className="select-control"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
          >
            <option value="all">Todos os estados</option>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Status"
            className="select-control"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos os status</option>
            {["Entregue", "Atrasado", "Em trânsito"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </section>
      <section className="panel">
        <PanelHeading
          title="Histórico de pedidos"
          subtitle={`${filtered.length} pedidos encontrados na amostra demonstrativa`}
        >
          <span className="risk-pill low">
            <Package size={12} />
            Base Olist
          </span>
        </PanelHeading>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Origem → Destino</th>
                <th>Data do pedido</th>
                <th>Status</th>
                <th>Risco de atraso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 10, current * 10).map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold">{o.id}</td>
                  <td>
                    <div>
                      {o.city}, {o.uf}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">De {o.origin}</div>
                  </td>
                  <td>{o.date.split("-").reverse().join("/")}</td>
                  <td>
                    <span
                      className={`risk-pill ${o.status === "Entregue" ? "low" : o.status === "Atrasado" ? "high" : "medium"}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{o.risk}%</span>
                      <RiskPill risk={o.risk} />
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Detalhes ${o.id}`}
                      onClick={() => setDetail(o)}
                    >
                      <ArrowRight />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search className="mx-auto mb-3" />
            <p>Nenhum pedido encontrado.</p>
            <Button variant="link" onClick={reset}>
              Limpar filtros
            </Button>
          </div>
        )}
        <div className="table-foot">
          <span>
            Mostrando {filtered.length ? (current - 1) * 10 + 1 : 0}–
            {Math.min(current * 10, filtered.length)} de {filtered.length} pedidos
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span>
              {current} de {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
      <OrderDetail order={detail} onClose={() => setDetail(null)} />
    </AppShell>
  );
}
