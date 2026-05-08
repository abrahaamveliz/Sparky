import type { Substitution } from "@/lib/decision-engine";
import { useLocale } from "@/lib/i18n";

export function SubstitutionRow({
  substitution,
  chosenName,
}: {
  substitution: Substitution;
  chosenName: string;
}) {
  const { t } = useLocale();

  let body: string;
  if (substitution.kind === "diet-exclusion") {
    body = t("substitution.diet", {
      original: substitution.droppedExample,
      chosen: chosenName,
    });
  } else {
    body = t("substitution.brand", { chosen: chosenName });
  }

  return (
    <div className="substitution-row">
      <span className="substitution-icon">↻</span>
      <span className="substitution-body">{body}</span>
    </div>
  );
}
