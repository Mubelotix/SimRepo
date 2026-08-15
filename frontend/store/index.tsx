import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ChartMode, LegendPosition } from "@shared/types/chart";
import { useRouter } from "next/router";
import axios from "axios";
import { REPO_DATA_API_URL } from "@shared/common/config";

export interface TrustedByRepo {
    name: string;
    logoUrl: string;
    stars: number | null;
}

interface AppState {
    isFetching: boolean;
    repos: string[];
    chartMode: ChartMode;
    useLogScale: boolean;
    legendPosition: LegendPosition;
    trustedBy: TrustedByRepo[];
    trustedByLoaded: boolean;
}

interface AppStateContextProps {
    isFetching: boolean;
    repos: string[];
    chartMode: ChartMode;
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
                const { data } = await axios.get(`${REPO_DATA_API_URL}/trusted-by`, { timeout: 5000 });
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
    useEffect(() => {
        const fetchData = () => {
            const hash = router.asPath.split("#")[1] || '';
            const params = hash.split("&").filter((i) => Boolean(i));
            const repos: string[] = [];
            let chartMode: ChartMode = "Date";
            let useLogScale = false;
            let legendPosition: LegendPosition = "top-left";

            const validLegendPositions: LegendPosition[] = ["top-left", "bottom-right"];

            for (const value of params) {
                if (value.startsWith("type=")) {
                    // Preferred format: type=timeline or type=date
                    const typeValue = value.split("=")[1].toLowerCase();
                    if (typeValue === "date") {
                        chartMode = "Date";
                    } else if (typeValue === "timeline") {
                        chartMode = "Timeline";
                    }
                } else if (value === "date" || value === "Date") {
                    // Backward compatibility: naked date parameter
                    chartMode = "Date";
                } else if (value === "timeline" || value === "Timeline") {
                    // Backward compatibility: naked timeline parameter
                    chartMode = "Timeline";
                } else if (value === "logscale" || value === "LogScale") {
                    useLogScale = true;
                } else if (value.startsWith("legend=")) {
                    const position = value.split("=")[1] as LegendPosition;
                    if (validLegendPositions.includes(position)) {
                        legendPosition = position;
                    }
                } else {
                    repos.push(value);
                }
            }

            setState((prev) => ({
                ...prev,
                isFetching: false,
                repos,
                chartMode,
                useLogScale,
                legendPosition,
            }));
        };

        // Fetch data and set initial state
        fetchData();

        // Listen for hash changes using Next.js router
        const handleHashChange = () => {
            fetchData();
        };
        router.events.on("hashChangeComplete", handleHashChange);

        // Cleanup the event listener
        return () => {
            router.events.off("hashChangeComplete", handleHashChange);
        };
    }, [router.asPath]);

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
