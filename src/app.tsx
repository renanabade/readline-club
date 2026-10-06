import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  BookOpen,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { SessionProvider, useSession } from "./lib/session";
import { api } from "./lib/api";
import { Loading, Notice } from "./components/ui";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import {
  Library,
  BookPage,
  MeetingPage,
  Agenda,
  Community,
  Status,
  Account,
} from "./pages/Members";
import Admin from "./pages/Admin";
import Privacy from "./pages/Privacy";
import type { ReactNode } from "react";
import { instance } from "./instance";
function Protected({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.mustChangePassword) return <Account required />;
  if (user.role !== "admin" && user.status !== "approved") return <Status />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
function Layout() {
  const { user, home, error, loading, refresh } = useSession();
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("club-theme") === "dark",
  );
  const location = useLocation();
  useEffect(() => {
    document.title = home?.settings.club_name || "readline club";
  }, [home?.settings.club_name]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("club-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    await refresh();
  }
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {instance.promo &&
        ["/", "/comunidade"].includes(
          location.pathname.replace(/\/$/, "") || "/",
        ) && (
          <aside
            className="promo-topbar"
            aria-label={"Conheça o " + instance.promo.name}
          >
            <a
              href={instance.promo.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="promo-copy-desktop">
                {instance.promo.tagline} com o{" "}
                <strong>{instance.promo.name}</strong>.
              </span>
              <span className="promo-copy-mobile">
                {instance.promo.tagline}.
              </span>
              <span className="promo-topbar-cta">
                <span className="promo-copy-desktop">Conheça</span>
                <span className="promo-copy-mobile">
                  Conheça o <strong>{instance.promo.name}</strong>
                </span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </span>
            </a>
          </aside>
        )}
      <header className="header">
        <div className="header-inner">
          <Link
            to="/"
            className="brand"
            aria-label={home?.settings.club_name || "readline club"}
          >
            <span className="brand-icon">
              <BookOpen size={23} strokeWidth={1.5} />
            </span>
            <span>
              {home?.settings.club_name || "readline club"}
              <small>clube do livro de computação</small>
            </span>
          </Link>
          <nav
            className={"nav " + (menu ? "is-open" : "")}
            aria-label="Navegação principal"
          >
            {[
              ["/", "Início"],
              ["/biblioteca", "Biblioteca"],
              ["/agenda", "Encontros"],
              ["/comunidade", "O clube"],
            ].map(([to, label]) => (
              <NavLink end={to === "/"} key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-btn theme-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {user ? (
              <>
                <Link className="account-link" to="/conta">
                  Minha conta
                </Link>
                <button
                  className="icon-btn"
                  onClick={() => void logout()}
                  aria-label="Sair"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="button small-button" to="/entrar">
                Entrar <ArrowUpRight size={15} />
              </Link>
            )}
            <button
              className="icon-btn menu-toggle"
              aria-expanded={menu}
              aria-label={menu ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="conteudo">
        {error && (
          <div className="container">
            <Notice>{error}</Notice>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/inscricao"
            element={<Auth key="signup" mode="signup" />}
          />
          <Route path="/entrar" element={<Auth key="login" mode="login" />} />
          <Route
            path="/redefinir-senha"
            element={<Auth key="reset" mode="reset" />}
          />
          <Route path="/biblioteca" element={<Library />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route
            path="/livros/:id"
            element={
              <Protected>
                <BookPage />
              </Protected>
            }
          />
          <Route
            path="/encontros/:id"
            element={
              <Protected>
                <MeetingPage />
              </Protected>
            }
          />
          <Route
            path="/agenda"
            element={
              <Protected>
                <Agenda />
              </Protected>
            }
          />
          <Route path="/comunidade" element={<Community />} />
          <Route
            path="/conta"
            element={
              loading ? (
                <Loading />
              ) : user ? (
                <Account required={user.mustChangePassword} />
              ) : (
                <Navigate to="/entrar" />
              )
            }
          />
          <Route
            path="/admin"
            element={
              <Protected admin>
                <Admin />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <div className="container page">
                <h1>Página não encontrada.</h1>
                <Link to="/" className="button">
                  Voltar ao início
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="footer container">
        <div>
          <BookOpen size={20} />
          <span>{home?.settings.club_name || "readline club"}</span>
        </div>
        {instance.author && (
          <p className="footer-author">
            <span>
              Criado por <strong>{instance.author.name}</strong>.
            </span>
            <a
              href={instance.author.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Conheça meus outros projetos{" "}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </p>
        )}
        <nav className="footer-links" aria-label="Rodapé">
          <Link to="/comunidade">
            Sobre o clube <ArrowUpRight size={14} />
          </Link>
          <Link to="/privacidade">Privacidade</Link>
        </nav>
      </footer>
    </>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <Layout />
    </SessionProvider>
  );
}
