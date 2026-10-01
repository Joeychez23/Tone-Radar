import { useCallback, useState } from "react";
import Header from "./components/Header";
import AuthDialog from "./components/AuthDialog";
import ComposeView from "./views/ComposeView";
import DraftsView from "./views/DraftsView";
import InsightsView from "./views/InsightsView";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./hooks/useToast";
import { useHashRoute } from "./hooks/useHashRoute";
import { useTheme } from "./hooks/useTheme";

function Shell() {
  const [route, navigate] = useHashRoute();
  const { isDark, toggle } = useTheme();
  const [auth, setAuth] = useState({ open: false, reason: "" });
  const [draftToOpen, setDraftToOpen] = useState(null);

  const requireAccount = useCallback((reason) => setAuth({ open: true, reason }), []);
  const openDraft = useCallback(
    (d) => {
      setDraftToOpen(d);
      navigate("compose");
    },
    [navigate]
  );
  const draftOpened = useCallback(() => setDraftToOpen(null), []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header route={route} onNavigate={navigate} onSignIn={() => requireAccount("")} isDark={isDark} onToggleTheme={toggle} />
      <main id="main">
        {/* Compose stays mounted so switching tabs never loses the message. */}
        <div hidden={route !== "compose"}>
          <ComposeView active={route === "compose"} draftToOpen={draftToOpen} onDraftOpened={draftOpened} onRequireAccount={requireAccount} />
        </div>
        {route === "drafts" && <DraftsView onOpen={openDraft} onRequireAccount={requireAccount} />}
        {route === "insights" && <InsightsView active onRequireAccount={requireAccount} />}
      </main>
      <footer className="app-footer muted small">
        Judgments by TypeSafe Jev. Suggestions are checked for meaning, but you know your reader best.
      </footer>
      <AuthDialog open={auth.open} reason={auth.reason} onClose={() => setAuth({ open: false, reason: "" })} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  );
}
