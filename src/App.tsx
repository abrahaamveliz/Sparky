import { useState } from "react";
import { ChatProvider } from "@/lib/use-chat";
import { CartProvider } from "@/lib/cart-store";
import { LocaleProvider, useLocale } from "@/lib/i18n";
import { PreferencesProvider, usePreferences } from "@/lib/preferences-store";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkipLink } from "@/components/SkipLink";
import { Topbar } from "@/components/Topbar";
import { SubNavbar } from "@/components/SubNavbar";
import { CartDrawer } from "@/components/CartDrawer";
import { PreferencesDrawer } from "@/components/PreferencesDrawer";
import { Thread } from "@/components/Thread";
import { Composer } from "@/components/Composer";

function ChatShell() {
  const { locale } = useLocale();
  const { preferences } = usePreferences();
  const [cartOpen, setCartOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  return (
    <ChatProvider locale={locale} preferences={preferences as Record<string, unknown>}>
      <CartProvider>
        <div className="app">
          <div className="demo-banner">
            Demo creada por{" "}
            <a href="mailto:velizabrahaam@gmail.com">velizabrahaam@gmail.com</a>
          </div>
          <SkipLink />
          <Topbar
            onOpenCart={() => setCartOpen(true)}
            onOpenPrefs={() => setPrefsOpen(true)}
          />
          <SubNavbar onOpenCart={() => setCartOpen(true)} />
          <main id="main" className="chat-shell" tabIndex={-1}>
            <Thread />
            <Composer />
          </main>
          <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
          <PreferencesDrawer
            open={prefsOpen}
            onClose={() => setPrefsOpen(false)}
          />
        </div>
      </CartProvider>
    </ChatProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary label="app">
      <LocaleProvider>
        <PreferencesProvider>
          <ChatShell />
        </PreferencesProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}