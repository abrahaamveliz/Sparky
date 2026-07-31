import { useRef, useState } from "react";
import { useChat } from "@/lib/use-chat";
import { useLocale } from "@/lib/i18n";
import { CategoryMegaMenu } from "./CategoryMegaMenu";

type Item =
  | { kind: "chat"; labelKey: string; promptKey: string }
  | { kind: "mega"; labelKey: string }
  | { kind: "cart"; labelKey: string };

const ITEMS: Item[] = [
  { kind: "chat", labelKey: "subnav.departamentos", promptKey: "subnav.departamentos.prompt" },
  { kind: "mega", labelKey: "subnav.categorias" },
  { kind: "chat", labelKey: "subnav.ofertas", promptKey: "subnav.ofertas.prompt" },
  { kind: "chat", labelKey: "subnav.recetas", promptKey: "subnav.recetas.prompt" },
  { kind: "chat", labelKey: "subnav.entrega", promptKey: "subnav.entrega.prompt" },
  { kind: "chat", labelKey: "subnav.farmacia", promptKey: "subnav.farmacia.prompt" },
  { kind: "chat", labelKey: "subnav.nuevos", promptKey: "subnav.nuevos.prompt" },
  { kind: "chat", labelKey: "subnav.limpieza", promptKey: "subnav.limpieza.prompt" },
  { kind: "chat", labelKey: "subnav.bebes", promptKey: "subnav.bebes.prompt" },
  { kind: "chat", labelKey: "subnav.comidas", promptKey: "subnav.comidas.prompt" },
  { kind: "cart", labelKey: "subnav.mis_items" },
  { kind: "chat", labelKey: "subnav.solo_gt", promptKey: "subnav.solo_gt.prompt" },
  { kind: "chat", labelKey: "subnav.tarjeta", promptKey: "subnav.tarjeta.prompt" },
];

export function SubNavbar({ onOpenCart }: { onOpenCart: () => void }) {
  const { t } = useLocale();
  const { send, isStreaming } = useChat();
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <nav className="subnav" aria-label={t("subnav.aria_label")}>
      <div className="subnav-wrap">
        <div className="subnav-row">
          {ITEMS.map((item, i) => {
            if (item.kind === "mega") {
              return (
                <div key={i} className="subnav-mega-wrap">
                  <button
                    ref={megaTriggerRef}
                    type="button"
                    className={`subnav-pill ${megaOpen ? "is-open" : ""}`}
                    onClick={() => setMegaOpen((o) => !o)}
                    aria-expanded={megaOpen}
                  >
                    {t(item.labelKey)}
                    <span className="subnav-chev" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  <CategoryMegaMenu
                    open={megaOpen}
                    onClose={() => setMegaOpen(false)}
                    anchorRef={megaTriggerRef}
                  />
                </div>
              );
            }
            if (item.kind === "cart") {
              return (
                <button
                  key={i}
                  type="button"
                  className="subnav-pill"
                  onClick={onOpenCart}
                >
                  {t(item.labelKey)}
                </button>
              );
            }
            // chat
            return (
              <button
                key={i}
                type="button"
                className="subnav-pill"
                disabled={isStreaming}
                aria-disabled={isStreaming}
                onClick={() => send(t(item.promptKey))}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}