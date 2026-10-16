import React from "react";
import { getFormulasAction, getComponentesAndUnidadesAction } from "@/actions/formula-actions";
import { FormulaCatalogView } from "@/components/formulas/formula-catalog-view";

export const dynamic = "force-dynamic";

export default async function FormulasPage() {
  const [formulasRes, compUnRes] = await Promise.all([
    getFormulasAction(),
    getComponentesAndUnidadesAction(),
  ]);

  return (
    <FormulaCatalogView
      initialFormulas={formulasRes.success ? formulasRes.data : []}
      componentes={compUnRes.success ? compUnRes.componentes : []}
      unidades={compUnRes.success ? compUnRes.unidades : []}
    />
  );
}
