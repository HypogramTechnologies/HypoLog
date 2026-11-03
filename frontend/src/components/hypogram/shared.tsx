import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Bell,
  Box,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Download,
  FileChartColumn,
  FlaskConical,
  LayoutDashboard,
  MapPinned,
  Menu,
  Package,
  Search,
  Settings2,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";
import { downloadCsv, orders, riskLabel, riskLevel, type Order } from "@/lib/hypogram-data";
import hypologLogo from "../../assets/hypolog_logo2.png";

const nav = [
  { to: "/" as const, label: "Visão geral", icon: LayoutDashboard },
  { to: "/mapa" as const, label: "Mapa de risco", icon: MapPinned },
  { to: "/simulador" as const, label: "Simulador de risco", icon: FlaskConical },
  { to: "/relatorios" as const, label: "Relatórios", icon: FileChartColumn },
];
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [help, setHelp] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const title = nav.find((n) => n.to === path)?.label ?? "Modelo & API";
  return (
    <div className="app-shell">
      <div className={`sidebar-shade ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/" className="brand">
          <img src={hypologLogo} alt="Hypolog" className="brand-logo" />
        </Link>

        <div className="nav-heading">MENU</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={`nav-item ${path === n.to ? "active" : ""}`}
            >
              <n.icon size={17} />
              {n.label}
              {n.to === "/simulador" && (
                <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[8px]">ML</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="nav-heading mt-7">TREINAMENTO</div>
        <Link
          to="/modelo"
          className={`nav-item ${path === "/modelo" ? "active" : ""}`}
          onClick={() => setOpen(false)}
        >
          <Code2 size={17} />
          Modelo & API
        </Link>
        <div className="sidebar-bottom">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setHelp(true)}
          ></Button>
          <div className="dataset-card">
            <div className="flex items-center gap-2 font-semibold">
              <span className="live-dot" />
              Brazilian E-Commerce Public
            </div>
            <p>
              99.441 pedidos históricos
              <br />
              Set 2016 — Dez 2018
            </p>
            <div className="mt-2 flex items-center gap-1 text-primary">
              <Activity size={11} />
              <a
                href="https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce?select=olist_orders_dataset.csv"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Dataset de referência
              </a>
            </div>
          </div>
          {/* <div className="user-block">
            <span className="avatar">AT</span>
            <div>
              <div className="text-xs font-semibold">Andressa Toledo</div>
              <div className="mt-1 text-[10px] text-muted-foreground">Gestora de logística</div>
            </div>
            <ChevronDown size={14} className="ml-auto text-muted-foreground" />
          </div> */}
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </Button>
            <span>Hypolog</span>
            <ChevronRight size={12} />
            <span className="text-foreground">{title}</span>
          </div>
          <div className="topbar-actions">
            <span className="top-status text-[10px] text-muted-foreground" />
            {/* <span className="live-dot" />
              Dados demonstrativos */}
            {/* </span>  */}
            <span className="h-5 border-l border-border" />
            {/* <Button
              variant="ghost"
              size="icon"
              aria-label="Notificações"
              onClick={() => setNotice(true)}
            >
              <Bell size={17} />
            </Button> */}
            {/* <span className="avatar">AT</span> */}
          </div>
        </header>
        <main className="workspace">
          {children}
          <footer className="app-footer">
            <span>© 2026 Hypogram</span>
          </footer>
        </main>
      </div>
      <Dialog open={notice} onOpenChange={setNotice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alertas logísticos</DialogTitle>
            <DialogDescription>Regiões que precisam de atenção</DialogDescription>
          </DialogHeader>
          {[
            "Manaus, AM: risco elevado em 92% dos envios analisados.",
            "Salvador, BA: aumento no tempo médio de trânsito.",
            "Rio de Janeiro, RJ: 148 pedidos com entrega em atenção.",
          ].map((t) => (
            <div key={t} className="insight">
              {t}
            </div>
          ))}
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Central de ajuda</DialogTitle>
            <DialogDescription>Hypogram · Projeto de gestão logística</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-7 text-muted-foreground">
            Este ambiente utiliza dados demonstrativos. A base de referência é o Brazilian
            E-commerce Public Dataset by Olist, de 2016 a 2018. Os resultados do simulador são
            estimativas ilustrativas, não previsões de um modelo treinado.
          </p>
          <Link to="/modelo" onClick={() => setHelp(false)} className="text-primary">
            Consultar modelo e documentação →
          </Link>
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" />
    </div>
  );
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function ExportButton({ label = "Exportar relatório" }: { label?: string }) {
  return (
    <></>
    // <Button
    //   variant="outline"
    //   className="text-[11px]"
    //   onClick={() => {
    //     downloadCsv(orders, "hypogram-relatorio");
    //     toast.success("Relatório CSV exportado");
    //   }}
    // >
    //   <Download size={14} />
    //   {label}
    // </Button>
  );
}
export function RiskPill({ risk }: { risk: number }) {
  return (
    <span className={`risk-pill ${riskLevel(risk)}`}>
      <span
        className={`legend-dot dot-${risk >= 70 ? "danger" : risk >= 40 ? "warning" : "success"}`}
      />
      {riskLabel(risk)}
    </span>
  );
}
export function Kpi({
  label,
  value,
  trend,
  note,
  icon: Icon,
  tone = "success",
}: {
  label: string;
  value: string;
  trend: string;
  note: string;
  icon: typeof Package;
  tone?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-head">
        <span>{label}</span>
        <span className="kpi-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-note">
        <span className={tone === "danger" ? "text-danger" : "text-success"}>
          <ArrowUpRight size={11} className="inline" /> {trend}
        </span>
        <span>{note}</span>
      </div>
    </div>
  );
}
export function PanelHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function OrderDetail({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedido {order?.id}</DialogTitle>
          <DialogDescription>Detalhes do envio e acompanhamento logístico</DialogDescription>
        </DialogHeader>
        {order && (
          <>
            <RiskPill risk={order.risk} />
            {[
              ["Origem", order.origin],
              ["Destino", `${order.city}, ${order.uf}`],
              ["Data do pedido", order.date.split("-").reverse().join("/")],
              ["Prazo prometido", order.expected.split("-").reverse().join("/")],
              ["Status", order.status],
              ["Peso", `${order.weight.toFixed(1)} kg`],
              [
                "Valor",
                order.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              ],
              ["Probabilidade de atraso", `${order.risk}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <Button
              onClick={() => {
                downloadCsv([order], order.id);
                toast.success("Dados do pedido exportados");
              }}
            >
              <Download />
              Exportar pedido
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
