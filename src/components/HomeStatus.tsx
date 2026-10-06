import { useSession } from "../lib/session";
import { Loading, Notice } from "./ui";
export function HomeStatus() {
  const { homeError, refreshHome } = useSession();
  if (!homeError) return <Loading />;
  return (
    <div className="container page">
      <h1>Vamos tentar de novo.</h1>
      <Notice>{homeError}</Notice>
      <button className="button primary" onClick={() => void refreshHome()}>
        Tentar novamente
      </button>
    </div>
  );
}
