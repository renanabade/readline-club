import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";
import type { Identity, HomeData } from "../../shared/contracts";
const Context = createContext<{
  user: Identity | null;
  loading: boolean;
  error: string;
  home: HomeData | null;
  homeError: string;
  refreshHome: () => Promise<void>;
  refresh: () => Promise<void>;
}>({
  user: null,
  loading: true,
  error: "",
  home: null,
  homeError: "",
  refreshHome: async () => {},
  refresh: async () => {},
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Identity | null>(null),
    [loading, setLoading] = useState(true),
    [home, setHome] = useState<HomeData | null>(null),
    [homeError, setHomeError] = useState(""),
    [error, setError] = useState("");
  const homeRequest = useRef<AbortController | null>(null);
  const refreshHome = useCallback(async () => {
    homeRequest.current?.abort();
    const controller = new AbortController();
    homeRequest.current = controller;
    setHomeError("");
    // Retry only this public read. Never replay registrations or other writes.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await api<HomeData>("/public/home", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12_000),
          ]),
        });
        if (!controller.signal.aborted) setHome(data);
        return;
      } catch (e) {
        if (controller.signal.aborted) return;
        if (attempt === 0 && (!(e instanceof ApiError) || e.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 750));
          if (controller.signal.aborted) return;
          continue;
        }
        setHomeError(
          "Não foi possível carregar o clube agora. Tente novamente em instantes.",
        );
        return;
      }
    }
  }, []);
  async function refresh() {
    try {
      setUser(await api<Identity | null>("/me"));
      setError("");
    } catch (e) {
      setUser(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    void refreshHome();
    const contentListener = () => void refreshHome();
    const listener = () => void refresh();
    window.addEventListener("session-refresh", listener);
    window.addEventListener("content-refresh", contentListener);
    window.addEventListener("focus", listener);
    return () => {
      window.removeEventListener("session-refresh", listener);
      homeRequest.current?.abort();
      window.removeEventListener("content-refresh", contentListener);
      window.removeEventListener("focus", listener);
    };
  }, [refreshHome]);
  return (
    <Context.Provider
      value={{ user, loading, error, home, homeError, refreshHome, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
