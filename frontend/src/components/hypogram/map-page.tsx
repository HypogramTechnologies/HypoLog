import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cities, cityRisk, number, type City } from "@/lib/hypogram-data";
import { AppShell, ExportButton, PageHeading, PanelHeading, RiskPill } from "./shared";
import { BrazilMap, MapLegend } from "./brazil-map";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { holidays } from "@/lib/hypogram-data";

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fromIso = (s: string) => new Date(`${s}T12:00:00`);

const br = (s: string) => s.split("-").reverse().join("/");

const today = () => toIso(new Date());
const holidayDates = holidays.map((holiday) => fromIso(holiday.date));

const holidayModifiers = {
  holiday: holidayDates,
};

const holidayModifiersClassNames = {
  holiday: "calendar-holiday",
};

type CitySource = "demo" | "csv";
const MIN_DATA_DATE = "2016-09-15";
const MAX_DATA_DATE = "2018-08-29";

export function MapPage() {
  const minDataDate = fromIso(MIN_DATA_DATE);
  const maxDataDate = fromIso(MAX_DATA_DATE);
  const [startDate, setStartDate] = useState(MIN_DATA_DATE);
  const [endDate, setEndDate] = useState(MAX_DATA_DATE);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [cityName, setCityName] = useState("Manaus");
  const [risk, setRisk] = useState("all");
  const [citySearch, setCitySearch] = useState("");
  const [citySource] = useState<CitySource>("demo");
  const [cityOpen, setCityOpen] = useState(false);
  // Fonte isolada para facilitar a substituição futura pela leitura do CSV.
  const cityOptions: City[] = useMemo(() => {
    if (citySource === "csv") {
      // TODO: substituir por cidades carregadas do CSV.
      // A estrutura esperada é City[], compatível com hypogram-data.
      return cities;
    }

    return cities;
  }, [citySource]);

  const sortedCities = useMemo(
    () => [...cityOptions].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [cityOptions],
  );

  const filteredCities = useMemo(
    () =>
      sortedCities.filter((city) =>
        `${city.name} ${city.uf}`
          .toLocaleLowerCase("pt-BR")
          .includes(citySearch.toLocaleLowerCase("pt-BR")),
      ),
    [sortedCities, citySearch],
  );

  const base = cityOptions.find((c) => c.name === cityName) ?? cityOptions[0];

  const validPeriod = startDate <= endDate;
  const hasCities = cityOptions.length > 0;

  const score = base && validPeriod ? cityRisk(base.risk, endDate) : 0;

  const ranked = useMemo(() => {
    if (!validPeriod) return [];

    return cityOptions
      .map((city) => ({
        ...city,
        risk: cityRisk(city.risk, endDate),
      }))
      .filter((city) => {
        if (risk === "high") return city.risk >= 70;
        if (risk === "medium") return city.risk >= 40 && city.risk < 70;
        if (risk === "low") return city.risk < 40;
        return true;
      })
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 6);
  }, [cityOptions, endDate, risk, validPeriod]);

  const selectCity = (city: City) => {
    setCityName(city.name);
    setCitySearch("");
  };

  const changeStartDate = (date?: Date) => {
    if (!date) return;

    const value = toIso(date);
    if (value < MIN_DATA_DATE || value > endDate) return;

    setStartDate(value);
    setStartOpen(false);
  };

  const changeEndDate = (date?: Date) => {
    if (!date) return;

    const value = toIso(date);
    if (value < startDate || value > MAX_DATA_DATE) return;

    setEndDate(value);
    setEndOpen(false);
  };

  const selectedHoliday = holidays.find((holiday) => holiday.date === startDate);
  const selectedHolidayEnd = holidays.find((holiday) => holiday.date === endDate);

  return (
    <AppShell>
      <PageHeading title="Mapa de risco" subtitle="Analise o risco de atraso por cidade e período.">
        <ExportButton />
      </PageHeading>

      <div className="filter-bar">
        <div className="filters filters-map">
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label="Data inicial">
                <CalendarDays size={15} />
                De: {br(startDate)}
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                locale={ptBR}
                mode="single"
                selected={fromIso(startDate)}
                defaultMonth={fromIso(startDate)}
                disabled={[{ before: minDataDate }, { after: fromIso(endDate) }]}
                onSelect={changeStartDate}
                fixedWeeks
                modifiers={{
                  ...holidayModifiers,
                  selectedHoliday: holidayDates,
                }}
                modifiersClassNames={{
                  ...holidayModifiersClassNames,
                  selectedHoliday: "calendar-holiday",
                }}
                className="map-calendar p-3 pointer-events-auto"
              />

              {selectedHoliday && (
                <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/70 px-2.5 py-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-red-600" />

                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-red-500">Data comemorativa</p>

                    <p className="truncate text-xs font-semibold text-red-800">
                      {selectedHoliday.name}
                    </p>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label="Data final">
                <CalendarDays size={15} />
                Até: {br(endDate)}
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                locale={ptBR}
                mode="single"
                selected={fromIso(endDate)}
                defaultMonth={fromIso(endDate)}
                disabled={[{ before: fromIso(startDate) }, { after: maxDataDate }]}
                onSelect={changeEndDate}
                fixedWeeks
                modifiers={holidayModifiers}
                modifiersClassNames={holidayModifiersClassNames}
                className="map-calendar p-3 pointer-events-auto"
              />

              {selectedHolidayEnd && (
                <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/70 px-2.5 py-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-red-600" />

                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-red-500">Data comemorativa</p>

                    <p className="truncate text-xs font-semibold text-red-800">
                      {selectedHolidayEnd.name}
                    </p>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="flex flex-col gap-1">
            <Popover open={cityOpen} onOpenChange={setCityOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={cityOpen}
                  className="city-combo"
                >
                  <MapPin size={15} />
                  <span className="truncate">
                    {base ? `${base.name} (${base.uf})` : "Selecionar cidade"}
                  </span>
                  <ChevronsUpDown size={14} className="ml-auto shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar cidade ou UF..."
                    value={citySearch}
                    onValueChange={setCitySearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                    <CommandGroup>
                      {filteredCities.map((city) => (
                        <CommandItem
                          key={`${city.name}-${city.uf}`}
                          value={`${city.name} ${city.uf}`}
                          onSelect={() => {
                            selectCity(city);
                            setCityOpen(false);
                          }}
                        >
                          <Check
                            size={15}
                            className={`mr-2 ${
                              cityName === city.name ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {city.name} ({city.uf})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <select
            className="select-control"
            aria-label="Nível de risco"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
          >
            <option value="all">Todos os riscos</option>
            <option value="high">Alto risco</option>
            <option value="medium">Risco moderado</option>
            <option value="low">Baixo risco</option>
          </select>
        </div>
      </div>

      {!validPeriod && (
        <div role="alert" className="insight mb-5">
          A data inicial deve ser anterior ou igual à data final.
        </div>
      )}

      {validPeriod && (
        <p className="mb-4 text-xs text-muted-foreground">
          Período selecionado: {br(startDate)} a {br(endDate)}.
        </p>
      )}

      <div className="two-col">
        <section className="panel">
          <PanelHeading
            title="Mapa de risco por cidade"
            subtitle={
              validPeriod
                ? `${br(startDate)} a ${br(endDate)}`
                : "Corrija o período para visualizar os riscos"
            }
          >
            <span className="risk-pill low">{cityOptions.length} cidades</span>
          </PanelHeading>

          {hasCities && validPeriod ? (
            <BrazilMap
              large
              selected={base?.name ?? ""}
              onSelect={selectCity}
              showRoutes={false}
              date={endDate}
              filter={risk}
            />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhuma cidade disponível ou período inválido.
            </div>
          )}

          <MapLegend />
        </section>

        <div className="flex flex-col gap-5">
          <section className="panel">
            <PanelHeading
              title={base ? `${base.name} · ${base.uf}` : "Cidade"}
              subtitle="Indicadores da cidade selecionada"
            >
              <MapPin size={18} className="text-primary" />
            </PanelHeading>

            {base && validPeriod && (
              <div className="px-[22px] pb-[22px]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div
                      className={`text-4xl font-semibold ${
                        score >= 70 ? "text-danger" : score >= 40 ? "text-warning" : "text-success"
                      }`}
                    >
                      {score}%
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Risco estimado até {br(endDate)}
                    </p>
                  </div>
                  <RiskPill risk={score} />
                </div>

                <div className="stat-row">
                  <span className="text-muted-foreground">Risco base</span>
                  <b>{base.risk}%</b>
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Pedidos analisados</span>
                  <b>{number(base.orders)}</b>
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Tempo médio de entrega</span>
                  <b>{String(base.days).replace(".", ",")} dias</b>
                </div>

                <div className="mt-5 insight">
                  {score >= 70
                    ? "Alto risco. Considere ampliar o prazo prometido."
                    : score >= 40
                      ? "Risco moderado. Acompanhe os pedidos desta região."
                      : "Baixo risco estimado para esta cidade."}
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <PanelHeading title="Cidades mais críticas" subtitle={`Ranking em ${br(endDate)}`} />
            <div className="route-list">
              {ranked.map((city) => (
                <button
                  type="button"
                  className="route-row w-full text-left"
                  key={`${city.name}-${city.uf}`}
                  onClick={() => setCityName(city.name)}
                >
                  <div>
                    <div className="text-xs font-medium">
                      {city.name}, {city.uf}
                      <ArrowRight size={11} className="inline mx-1" />
                    </div>
                    <small>
                      {number(city.orders)} pedidos · {String(city.days).replace(".", ",")} dias de
                      entrega
                    </small>
                  </div>
                  <span
                    className={`font-semibold text-sm ${
                      city.risk >= 70
                        ? "text-danger"
                        : city.risk >= 40
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {city.risk}%
                  </span>
                </button>
              ))}

              {ranked.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  Nenhuma cidade corresponde ao filtro de risco.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
