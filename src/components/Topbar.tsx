import { useState } from "react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { Spark } from "./Spark";
import { CartButton } from "./CartButton";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { DeliveryPopover } from "./DeliveryPopover";
import { ConfirmDialog } from "./ConfirmDialog";
import { useLocale } from "@/lib/i18n";
import { LOGO_URL, PRODUCT_NAME } from "@/lib/product-name";
import { useChatHistory } from "@/lib/chat-history-store";

export function Topbar({
  onOpenCart,
  onOpenPrefs,
}: {
  onOpenCart: () => void;
  onOpenPrefs: () => void;
}) {
  const { t } = useLocale();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { hasMessages, newConversation, deleteChat } = useChatHistory();

  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label={PRODUCT_NAME}>
        {LOGO_URL ? (
          <img className="brand-logo" src={LOGO_URL} alt="" />
        ) : (
          <Spark size={28} />
        )}
        <span className="brand-name">{PRODUCT_NAME}</span>
      </a>

      <div className="delivery-pill-wrap">
        <button
          type="button"
          className="delivery-pill"
          onClick={() => setPopoverOpen((o) => !o)}
          aria-expanded={popoverOpen}
        >
          <span className="delivery-pill-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="delivery-pill-stack">
            <span className="delivery-pill-label">
              {t("topbar.delivery.label")}
            </span>
            <span className="delivery-pill-location">
              {t("topbar.delivery.location")}
            </span>
          </span>
          <span className="delivery-pill-chev" aria-hidden="true">
            ▾
          </span>
        </button>
        <DeliveryPopover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          onOpenCart={onOpenCart}
        />
      </div>

      <ComposerPrimitive.Root className="navbar-search">
        <ComposerPrimitive.Input
          className="navbar-search-input"
          placeholder={t("topbar.search.placeholder")}
          rows={1}
        />
        <ComposerPrimitive.Send
          className="navbar-search-submit"
          aria-label={t("topbar.search.submit")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>

      <div className="topbar-right">
        <button
          type="button"
          className="topbar-icon-btn"
          onClick={newConversation}
          title={t("chat.new")}
          aria-label={t("chat.new")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button
          type="button"
          className="topbar-icon-btn topbar-icon-btn--danger"
          onClick={() => setConfirmDeleteOpen(true)}
          title={t("chat.delete")}
          aria-label={t("chat.delete")}
          aria-haspopup="dialog"
          disabled={!hasMessages}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>

        <button
          type="button"
          className="topbar-link"
          onClick={onOpenCart}
          title={t("topbar.lists.sub")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="topbar-link-stack">
            <span className="topbar-link-top">{t("topbar.lists.label")}</span>
            <span className="topbar-link-bot">{t("topbar.lists.sub")}</span>
          </span>
        </button>

        <button
          type="button"
          className="topbar-link"
          onClick={onOpenPrefs}
          title={t("topbar.account.sub")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="topbar-link-stack">
            <span className="topbar-link-top">{t("topbar.account.label")}</span>
            <span className="topbar-link-bot">{t("topbar.account.sub")}</span>
          </span>
        </button>

        <LocaleSwitcher />
        <CartButton onClick={onOpenCart} />
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("confirm.delete_chat.title")}
        body={t("confirm.delete_chat.body")}
        confirmLabel={t("confirm.delete_chat.confirm")}
        variant="danger"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          deleteChat();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </header>
  );
}
