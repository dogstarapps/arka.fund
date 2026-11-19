"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  loadArkaInvestorCounts,
  loadArkaPerformanceHistory,
  loadExploreArkas,
  type ArkaInvestorCount,
} from "@/lib/catalog/api";
import { formatBaseUnitAmount, formatContractLabel, formatUsdBaseUnitAmount } from "@/lib/catalog/format";
import { resolveArkaDisplayName } from "@/lib/catalog/identity";
import { isCatalogAssetPriceUsable } from "@/lib/catalog/valuation";
import type { ArkaHistoryPoint, RankedArkaCatalogEntry } from "@/lib/catalog/types";
import { replaceBrowserQueryState } from "@/lib/workflows/publicSurfaceUrlState";

const PAGE_SIZE = 12;
const sorts = {
  profit: "Profit",
  nav: "TVL",
  participants: "Participants",
  volume: "Trading volume",
  ranked: "Catalog rank",
  fresh: "Recently updated",
  search: "Search relevance",
} as const;
type Sort = keyof typeof sorts;
type Chart = { path: string; change: number; first: string; last: string };
const percent = new Intl.NumberFormat("en", {
  style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const profitDate = new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  timeZone: "UTC", timeZoneName: "short",
});

function exactAmount(value: string | null | undefined): bigint | null {
  return value && /^-?\d+$/.test(value) ? BigInt(value) : null;
}

function amountDecimals(entry: RankedArkaCatalogEntry) {
  const decimals = entry.economics?.denominationAsset?.decimals;
  return Number.isInteger(decimals) && decimals! >= 0 && decimals! <= 38 ? decimals! : 7;
}

function usdAmount(entry: RankedArkaCatalogEntry, raw: bigint | null) {
  if (raw === null) return null;
  const economics = entry.economics;
  const price = economics?.denominationPrice;
  const scale = BigInt(10) ** BigInt(amountDecimals(entry));
  if (economics?.denominationAsset?.usdPegged) return raw * BigInt(10_000_000) / scale;
  if (!isCatalogAssetPriceUsable(price) || price.assetContract !== entry.denominationContract || price.decimals > 38) return null;
  return raw * BigInt(price.priceUsd) * BigInt(10_000_000) / (scale * BigInt(10) ** BigInt(price.decimals));
}

function denominationAmount(entry: RankedArkaCatalogEntry, amount: bigint | null) {
  if (amount === null) return "—";
  const symbol = entry.economics?.denominationAsset?.symbol;
  return symbol ? `${formatBaseUnitAmount(amount.toString(), amountDecimals(entry), 2)} ${symbol}` : "—";
}

function formatProfit(entry: RankedArkaCatalogEntry, profit: bigint | null, usd: bigint | null) {
  if (!entry.verifiedProfit) return usd === null ? denominationAmount(entry, profit) : formatUsdBaseUnitAmount(usd.toString());
  const source = entry.economics?.denominationAsset;
  if (!source?.symbol || profit === null) return "—";
  const abs = profit < BigInt(0) ? -profit : profit;
  const decimals = amountDecimals(entry);
  const precision = abs > BigInt(0) && abs * BigInt(100) < BigInt(10) ** BigInt(decimals) ? decimals : 2;
  const value = formatBaseUnitAmount(profit.toString(), decimals, precision);
  return `${entry.verifiedProfit.estimated ? "≈ " : ""}${value} ${source.symbol}`;
}

function chartFor(entry: RankedArkaCatalogEntry, history: ArkaHistoryPoint[], metric: "sharePrice" | "nav"): Chart | null {
  if (!entry.shareToken || !entry.denominationContract) return null;
  const points = history.flatMap(point => {
    const price = exactAmount(point[metric]);
    const at = Date.parse(point.syncedAt);
    return price !== null && price >= BigInt(0) && Number.isFinite(at) &&
      point.shareToken === entry.shareToken &&
      (point.denominationContract === entry.denominationContract || (metric === "nav" && !point.denominationContract))
      ? [{ at, price }] : [];
  }).sort((a, b) => a.at - b.at);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || first.at === last.at || (metric === "sharePrice" && first.price <= BigInt(0))) return null;
  const low = points.reduce((min, point) => point.price < min ? point.price : min, first.price);
  const high = points.reduce((max, point) => point.price > max ? point.price : max, first.price);
  const path = points.map(({ at, price }, index) => {
    const x = 2 + 116 * (at - first.at) / (last.at - first.at);
    const y = high === low ? 18 : 32 - Number((price - low) * BigInt(2800) / (high - low)) / 100;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return {
    path,
    change: first.price > BigInt(0) ? Number((last.price - first.price) * BigInt(1_000_000) / first.price) / 1_000_000 : 0,
    first: date.format(first.at),
    last: date.format(last.at),
  };
}

function initialFilters(query: string) {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
  const metric = params.get("sort") || params.get("feature");
  const order = params.get("order");
  return {
    search: params.get("q") ?? query,
    sort: metric === "rank" ? "ranked" as const : metric && Object.hasOwn(sorts, metric) ? metric as Sort : "profit" as const,
    order: order === "asc" || order === "desc" ? order : null,
    curated: params.get("curated") === "1" || params.get("curated") === "true",
    window: ["current", "7d", "30d"].includes(params.get("window") ?? "") ? params.get("window")! : "all",
  };
}

export default function ArkaLeaderboard({ initialQuery = "" }: { initialQuery?: string }) {
  const [initial] = useState(() => initialFilters(initialQuery));
  const [search, setSearch] = useState(initial.search);
  const [curated, setCurated] = useState(initial.curated);
  const [sort, setSort] = useState<Sort>(initial.sort);
  const [ascending, setAscending] = useState(initial.order ? initial.order === "asc" : initial.sort === "ranked");
  const [window, setWindow] = useState(initial.window);
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: RankedArkaCatalogEntry[] | null; status: "loading" | "ready" | "error" }>({ data: null, status: "loading" });
  const [counts, setCounts] = useState<Record<string, ArkaInvestorCount | null>>({});
  const [history, setHistory] = useState<Record<string, ArkaHistoryPoint[]>>({});
  const term = useDeferredValue(search.trim());

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, status: "loading" }));
    void loadExploreArkas({ search: term, curated: curated || undefined }, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setState({ data, status: "ready" });
      }, () => {
        if (!controller.signal.aborted) setState(current => ({ ...current, status: "error" }));
      });
    return () => controller.abort();
  }, [term, curated, attempt]);

  useEffect(() => {
    replaceBrowserQueryState({
      q: term || null,
      curated: curated ? "1" : null,
      sort: sort === "profit" ? null : sort,
      feature: sort === "profit" ? null : sort,
      order: ascending === (sort === "ranked") ? null : ascending ? "asc" : "desc",
      window: window === "all" ? null : window,
    });
  }, [term, curated, sort, ascending, window]);

  const { rows, rankingUnit } = useMemo(() => {
    const data = state.data ?? [];
    const newest = Math.max(0, ...data.map(entry => Date.parse(entry.syncedAt)).filter(Number.isFinite));
    const lower = window === "7d" ? newest - 7 * 86400000 : newest - 30 * 86400000;
    const filtered = data.filter(entry => window === "all" ||
      (window === "current" ? Date.parse(entry.syncedAt) === newest : Date.parse(entry.syncedAt) >= lower))
      .map(entry => {
        const profit = exactAmount(entry.verifiedProfit?.amount ?? (entry.economics ? entry.economics.pnl?.amount : entry.profitBase));
        const volume = exactAmount(entry.economics ? entry.economics.volume?.amount : entry.volumeBase);
        const nav = exactAmount(entry.nav);
        const tvl = nav === null ? null : exactAmount(entry.economics?.navUsdEstimate);
        const verifiedTvl = tvl !== null && tvl >= BigInt(0) ? tvl : null;
        const participants = counts[entry.arkaId];
        return { entry, nav, profit, volume, tvl: verifiedTvl, profitUsd: usdAmount(entry, profit),
          volumeUsd: usdAmount(entry, volume), participants: participants?.complete ? participants.total : null };
      });

    const moneyMetric = sort === "nav" || sort === "profit" || sort === "volume" ? sort : null;
    const usdMetric = moneyMetric === "nav" ? "tvl" : moneyMetric === "profit" ? "profitUsd" : "volumeUsd";
    // Zero can be compared across denominations without a price conversion.
    const nonZero = moneyMetric ? filtered.filter(row => row[moneyMetric] !== null && row[moneyMetric] !== BigInt(0)) : [];
    const commonAsset = nonZero[0]?.entry.denominationContract;
    const denominated = moneyMetric ? filtered.filter(row => row[moneyMetric] !== null && row.entry.denominationContract) : [];
    const rankAsset = commonAsset ?? denominated[0]?.entry.denominationContract;
    const rankInAsset = rankAsset && nonZero.every(row => row.entry.denominationContract === rankAsset) &&
      denominated.some(row => row[usdMetric] === null);
    const rankingUnit = rankInAsset ? denominated.find(row => row.entry.denominationContract === rankAsset)?.entry.economics?.denominationAsset?.symbol ?? "fund denomination" : "USD";

    const value = (row: (typeof filtered)[number]): bigint | number | null => {
      if (moneyMetric) {
        const amount = row[moneyMetric];
        return rankInAsset || amount === BigInt(0) ? amount : row[usdMetric];
      }
      switch (sort) {
        case "participants": return row.participants;
        case "fresh": return Number.isFinite(Date.parse(row.entry.syncedAt)) ? Date.parse(row.entry.syncedAt) : null;
        case "search": {
          const match = [row.entry.arkaId, row.entry.manager, row.entry.identity?.displayName]
            .map(value => value?.toLowerCase().indexOf(term.toLowerCase()) ?? -1)
            .filter(index => index >= 0);
          return match.length ? Math.min(...match) : null;
        }
        default: return row.entry.rank;
      }
    };
    const rows = filtered.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== null && right !== null && left !== right) return (left < right ? -1 : 1) * (ascending ? 1 : -1);
      if (sort === "profit") {
        const funded = (nav: bigint | null) => Number(nav !== null && nav > BigInt(0));
        const fundedFirst = funded(b.nav) - funded(a.nav);
        if (fundedFirst) return fundedFirst;
      }
      return a.entry.rank - b.entry.rank || a.entry.arkaId.localeCompare(b.entry.arkaId);
    });
    return { rows, rankingUnit };
  }, [state.data, window, counts, sort, ascending, term]);

  const verifiedProfits = rows.flatMap(({ entry }) => entry.verifiedProfit ? [entry.verifiedProfit] : []);
  const latestProfitAt = verifiedProfits.reduce((latest, proof) => Math.max(latest, Date.parse(proof.asOf)), 0);
  const hasEstimatedProfit = verifiedProfits.some(proof => proof.estimated);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const missingCounts = JSON.stringify((sort === "participants" ? rows : visible)
    .map(({ entry }) => entry.arkaId).filter(id => !(id in counts)).sort());
  const missingHistory = JSON.stringify(visible.map(({ entry }) => entry.arkaId).filter(id => !(id in history)).sort());

  useEffect(() => {
    const ids: string[] = JSON.parse(missingCounts);
    const controller = new AbortController();
    async function load() {
      const results: Record<string, ArkaInvestorCount | null> = {};
      for (let index = 0; index < ids.length && !controller.signal.aborted; index += 6) {
        const batch = ids.slice(index, index + 6);
        const found = await loadArkaInvestorCounts(batch, controller.signal);
        for (const id of batch) results[id] = found[id] ?? null;
      }
      if (ids.length && !controller.signal.aborted) setCounts(current => ({ ...current, ...results }));
    }
    void load();
    return () => controller.abort();
  }, [missingCounts, attempt]);

  useEffect(() => {
    const ids: string[] = JSON.parse(missingHistory);
    const controller = new AbortController();
    async function load() {
      const results: Record<string, ArkaHistoryPoint[]> = {};
      for (let index = 0; index < ids.length && !controller.signal.aborted; index += 6) {
        await Promise.all(ids.slice(index, index + 6).map(async id => {
          const page = await loadArkaPerformanceHistory(id, controller.signal).catch(() => null);
          results[id] = page?.items ?? [];
        }));
      }
      if (ids.length && !controller.signal.aborted) setHistory(current => ({ ...current, ...results }));
    }
    void load();
    return () => controller.abort();
  }, [missingHistory, attempt]);

  return (
    <main className="arka-leaderboard" aria-labelledby="arka-leaderboard-title">
      <header className="arka-redesign-page-heading">
        <h1 id="arka-leaderboard-title">Arka Leaderboard</h1>
      </header>
      <div className="arka-explore-filters">
        <label className="arka-explore-search">Search Arkas
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Name, asset or manager" />
        </label>
        <label>Sort by
          <select value={sort} onChange={event => {
            const value = event.target.value as Sort;
            setSort(value); setAscending(value === "ranked" || value === "search"); setPage(0);
          }}>{Object.entries(sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>
        <label>Order
          <select value={ascending ? "asc" : "desc"} onChange={event => { setAscending(event.target.value === "asc"); setPage(0); }}>
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </label>
        <label>Updated
          <select value={window} onChange={event => { setWindow(event.target.value); setPage(0); }}>
            <option value="all">Any time</option><option value="current">Latest sync</option>
            <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
          </select>
        </label>
        <label className="arka-explore-curated">
          <input type="checkbox" checked={curated} onChange={event => { setCurated(event.target.checked); setPage(0); }} /> Curated only
        </label>
      </div>
      {state.status === "loading" && !state.data && <p role="status">Loading Arkas…</p>}
      {state.status === "error" && <div className="arka-explore-message" role="alert">
        <p>{state.data ? "Showing the last loaded results." : "We couldn’t load the Arka catalog."} Try again.</p>
        <button type="button" className="arka-redesign-button arka-redesign-button-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button>
      </div>}
      {state.status === "ready" && rows.length === 0 && <p>No Arkas match these filters.</p>}
      {rows.length > 0 && <>
        <p className="arka-leaderboard-note">
          {sort === "profit" && rows.every(row => row.profit === null) ? "Profit needs verified deposit and withdrawal history. " :
            sort === "nav" || sort === "profit" || sort === "volume" ? `Ranked in ${rankingUnit}. ` : ""}
          {latestProfitAt > 0 ? `Profit as of ${profitDate.format(latestProfitAt)}.` : "— means data is unavailable."}
          {hasEstimatedProfit && " ≈ uses historical exchange rates."}
        </p>
        {sort === "participants" && missingCounts !== "[]" && <p role="status">Checking participants…</p>}
        <table className="arka-leaderboard-table" role="table" aria-label="Arka leaderboard" aria-busy={state.status === "loading"}>
          <thead role="rowgroup"><tr role="row">
            <th scope="col">Arka</th>
            <th scope="col" className="arka-leaderboard-profit" title="Fund value plus settled withdrawals minus deposits">Profit</th>
            <th scope="col">TVL</th><th scope="col">Participants</th><th scope="col">History</th>
          </tr></thead>
          <tbody role="rowgroup">{visible.map(({ entry, profit, profitUsd, volume, volumeUsd, tvl, participants }) => {
            const observations = history[entry.arkaId] ?? [];
            const performance = chartFor(entry, observations, "sharePrice");
            const navHistory = performance ? null : chartFor(entry, observations, "nav");
            const trend = performance ?? navHistory;
            const arkaName = resolveArkaDisplayName(entry, true);
            return <tr role="row" key={entry.arkaId} data-testid="explore-arka-card">
              <th role="rowheader" scope="row" className="arka-leaderboard-identity">
                <Link href={`/vaults/${entry.arkaId}`} aria-label={`View Arka ${arkaName}`}>{arkaName}</Link>
                <small className="arka-leaderboard-manager" title={entry.manager}>Manager {formatContractLabel(entry.manager, 6, 4)}</small>
              </th>
              <td role="cell" className="arka-leaderboard-profit" data-label="Profit"><span
                data-testid={entry.verifiedProfit ? "arka-profit-verified" : undefined}
                title={entry.verifiedProfit ? `Mainnet ledger ${entry.verifiedProfit.ledger} · ${profitDate.format(Date.parse(entry.verifiedProfit.asOf))}` : undefined}
              >{formatProfit(entry, profit, profitUsd)}</span>
                {sort === "volume" && <small className="arka-leaderboard-manager">Volume {volumeUsd === null ? denominationAmount(entry, volume) : formatUsdBaseUnitAmount(volumeUsd.toString())}</small>}</td>
              <td role="cell" data-label="TVL">{tvl === null ? denominationAmount(entry, exactAmount(entry.nav)) : formatUsdBaseUnitAmount(tvl.toString())}</td>
              <td role="cell" data-label="Participants">{participants?.toLocaleString("en") ?? "—"}</td>
              <td role="cell" data-label="History">{trend ? <div className="arka-leaderboard-performance">
                {performance ? <strong data-trend={Math.sign(performance.change)}>{percent.format(performance.change)}</strong> : <small>Fund value (NAV)</small>}
                <svg viewBox="0 0 120 36" role="img" aria-label={`${performance ? "Share-price return" : "Fund value"} from ${trend.first} to ${trend.last}`}>
                  <path d={trend.path} />
                </svg>
                <small>{trend.first === trend.last ? trend.first : `${trend.first} – ${trend.last}`}</small>
              </div> : <span title="Fund history unavailable">—</span>}</td>
            </tr>;
          })}</tbody>
        </table>
        {pageCount > 1 && <nav className="arka-leaderboard-pagination" aria-label="Arka pages">
          <button type="button" className="arka-redesign-button arka-redesign-button-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
          <span>Page {safePage + 1} of {pageCount}</span>
          <button type="button" className="arka-redesign-button arka-redesign-button-secondary" disabled={safePage === pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
        </nav>}
      </>}
    </main>
  );
}
