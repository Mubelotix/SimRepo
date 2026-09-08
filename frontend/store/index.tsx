import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ChartMode, ChartStyle, LegendPosition } from "@shared/types/chart";
import { REPO_DATA_API_URL } from "@shared/common/config";
import { useRouter } from "next/router";
import { buildChartHref, isChartRoute, parseChartUrl } from "../helpers/urls";

export interface TrustedByRepo {
    name: string;
    logoUrl: string;
    stars: number | null;
}

interface AppState {
    isFetching: boolean;
    repos: string[];
    chartMode: ChartMode;
    chartStyle: ChartStyle;
    useLogScale: boolean;
    legendPosition: LegendPosition;
    trustedBy: TrustedByRepo[];
    trustedByLoaded: boolean;
}

interface AppStateContextProps {
    isFetching: boolean;
    repos: string[];
    chartMode: ChartMode;
    chartStyle: ChartStyle;
    useLogScale: boolean;
    legendPosition: LegendPosition;
    trustedBy: TrustedByRepo[];
    trustedByLoaded: boolean;
    state: AppState;
    actions: {
        addRepo(repo: string): void;
        delRepo(repo: string): void;
        setRepos(repos: string[]): void;
        setIsFetching(isFetching: boolean): void;
        setChartMode(chartMode: ChartMode): void;
        setChartStyle(chartStyle: ChartStyle): void;
        setUseLogScale(useLogScale: boolean): void;
        setLegendPosition(legendPosition: LegendPosition): void;
    };
}

const AppStateContext = createContext<AppStateContextProps | undefined>(undefined);

export const AppStateProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [state, setState] = useState<AppState>({
        isFetching: false,
        repos: [],
        chartMode: "Date",
        chartStyle: "xkcd",
        useLogScale: false,
        legendPosition: "top-left",
        trustedBy: [],
        trustedByLoaded: false,
    });

    // Process the trusted-by repo list once at program start: the backend resolves
    // each repo to its icon (logoUrl) and current star count, served as a small,
    // non-rate-limited payload.
    useEffect(() => {
        let disposed = false;
        const loadTrustedBy = async () => {
            try {
                const res = await fetch(`${REPO_DATA_API_URL}/trusted-by`, { signal: AbortSignal.timeout(5000) });
                const data = await res.json();
                if (disposed) return;
                setState((prev) => ({ ...prev, trustedBy: data?.repos ?? [], trustedByLoaded: true }));
            } catch {
                if (disposed) return;
                setState((prev) => ({ ...prev, trustedByLoaded: true }));
            }
        };
        loadTrustedBy();
        return () => {
            disposed = true;
        };
    }, []);

    const router = useRouter();
    const routerEvents = router.events;
    const [urlInitialized, setUrlInitialized] = useState(false);

    useEffect(() => {
        const syncFromUrl = () => {
            const url = new URL(window.location.href);
            if (!isChartRoute(url)) {
                setUrlInitialized(false);
                setState((prev) => ({
                    ...prev,
                    isFetching: false,
                    repos: [],
                    chartMode: "Date",
                    chartStyle: "xkcd",
                    useLogScale: false,
                    legendPosition: "top-left",
                }));
                return;
            }
            const urlState = parseChartUrl(url);
            setState((prev) => ({
                ...prev,
                isFetching: false,
                ...urlState,
            }));
            setUrlInitialized(true);
        };

        syncFromUrl();
        window.addEventListener("popstate", syncFromUrl);
        routerEvents.on("routeChangeComplete", syncFromUrl);

        return () => {
            window.removeEventListener("popstate", syncFromUrl);
            routerEvents.off("routeChangeComplete", syncFromUrl);
        };
    }, [routerEvents]);

    const { repos, chartMode, chartStyle, useLogScale, legendPosition } = state;
    useEffect(() => {
        if (!urlInitialized) return;
        const href = buildChartHref({ repos, chartMode, chartStyle, useLogScale, legendPosition });
        const currentHref = `${window.location.pathname}${window.location.search}`;
        if (currentHref !== href) {
            window.history.replaceState(null, "", href);
        }
    }, [urlInitialized, repos, chartMode, chartStyle, useLogScale, legendPosition]);

    const actions = useMemo<AppStateContextProps["actions"]>(() => ({
        addRepo: (repo: string) => {
            setState((prev) => {
                if (prev.repos.includes(repo)) return prev;
                return { ...prev, repos: [...prev.repos, repo] };
            });
        },
        delRepo: (repo: string) => {
            setState((prev) => ({ ...prev, repos: prev.repos.filter((r) => r !== repo) }));
        },
        setRepos: (repos: string[]) => {
            setState((prev) => ({ ...prev, repos }));
        },
        setIsFetching: (isFetching: boolean) => {
            setState((prev) => ({ ...prev, isFetching }));
        },
        setChartMode: (chartMode: ChartMode) => {
            setState((prev) => ({ ...prev, chartMode }));
        },
        setChartStyle: (chartStyle: ChartStyle) => {
            setState((prev) => ({ ...prev, chartStyle }));
        },
        setUseLogScale: (useLogScale: boolean) => {
            setState((prev) => ({ ...prev, useLogScale }));
        },
        setLegendPosition: (legendPosition: LegendPosition) => {
            setState((prev) => ({ ...prev, legendPosition }));
        },
    }), []);

    const store = useMemo<AppStateContextProps>(() => ({
        isFetching: state.isFetching,
        repos: state.repos,
        chartMode: state.chartMode,
        chartStyle: state.chartStyle,
        useLogScale: state.useLogScale,
        legendPosition: state.legendPosition,
        trustedBy: state.trustedBy,
        trustedByLoaded: state.trustedByLoaded,
        state,
        actions,
    }), [state, actions]);

    return <AppStateContext.Provider value={store}>{children}</AppStateContext.Provider>;
};

export const useAppStore = () => {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error("useAppStore must be used within an AppStateProvider");
    }
    return context;
};
