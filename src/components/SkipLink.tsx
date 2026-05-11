import { useLocale } from "@/lib/i18n";

export function SkipLink() {
  const { t } = useLocale();
  return (
    <a className="skip-link" href="#main">
      {t("a11y.skip_to_content")}
    </a>
  );
}
