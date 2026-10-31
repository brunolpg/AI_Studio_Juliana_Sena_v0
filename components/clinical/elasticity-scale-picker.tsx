"use client";

import React, { useId } from "react";
import { Frown, Smile } from "lucide-react";

export interface ElasticityScalePickerProps {
  value?: number | string | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  showDescriptor?: boolean;
}

const DESCRIPTORS: Record<number, string> = {
  1: "1/5 - Baixa / Flacidez",
  2: "2/5 - Reduzida",
  3: "3/5 - Moderada",
  4: "4/5 - Boa",
  5: "5/5 - Excelente / Firme",
};

export function ElasticityScalePicker({
  value,
  onChange,
  disabled = false,
  className = "",
  label = "Elasticidade",
  showDescriptor = true,
}: ElasticityScalePickerProps) {
  const componentId = useId();

  // Normalização do valor: suporta números de 1 a 5 e conversão retrocompatível de legados em porcentagem (ex: 60% -> 3)
  const normalizedValue = React.useMemo(() => {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "string" ? parseFloat(value) : Number(value);
    if (isNaN(num)) return null;
    if (num > 5) {
      // Valor legado em porcentagem (> 5): converte para escala de 1 a 5
      return Math.min(5, Math.max(1, Math.round(num / 20)));
    }
    const rounded = Math.round(num);
    return rounded >= 1 && rounded <= 5 ? rounded : null;
  }, [value]);

  const levels = [1, 2, 3, 4, 5];

  const getButtonStyles = (lvl: number, isSelected: boolean) => {
    if (!isSelected) {
      return "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/70 hover:text-zinc-900 dark:hover:text-white";
    }

    switch (lvl) {
      case 1:
        return "bg-red-500 text-white border-red-500 shadow-xs ring-2 ring-red-500/20 font-bold";
      case 2:
        return "bg-orange-500 text-white border-orange-500 shadow-xs ring-2 ring-orange-500/20 font-bold";
      case 3:
        return "bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-500/20 font-bold";
      case 4:
        return "bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-600/20 font-bold";
      case 5:
        return "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20 font-bold";
      default:
        return "bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold";
    }
  };

  return (
    <div className={`w-full flex flex-col justify-end ${className}`}>
      {/* Rótulo e indicador de nível selecionado */}
      {label && (
        <div className="flex items-center justify-between mb-1 min-h-[16px]">
          <label
            htmlFor={componentId}
            className="block text-xs font-semibold text-slate-600 dark:text-slate-300 truncate"
          >
            {label}
          </label>
          {showDescriptor && normalizedValue !== null && (
            <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.2 rounded border border-teal-200/50 dark:border-teal-800/50 select-none">
              {DESCRIPTORS[normalizedValue] || `${normalizedValue}/5`}
            </span>
          )}
        </div>
      )}

      {/* Régua horizontal contígua com ícones Frown e Smile nas extremidades */}
      <div
        id={componentId}
        role="group"
        aria-label="Escala de Elasticidade de 1 a 5"
        className="w-full flex items-center gap-1.5 sm:gap-2 px-2 py-1 bg-white dark:bg-zinc-800/90 border border-slate-200 dark:border-slate-700 rounded-lg min-h-[34px]"
      >
        {/* Lado esquerdo: Ícone de insatisfação (Nível Mínimo 1) */}
        <div
          title="Nível Mínimo (1) - Flacidez / Elasticidade Baixa"
          className="flex items-center justify-center shrink-0 cursor-default"
        >
          <Frown
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-red-500 shrink-0 transition-transform hover:scale-110"
            aria-hidden="true"
          />
        </div>

        {/* Centro: Régua horizontal de 5 botões (1 a 5) */}
        <div className="flex-1 flex items-center justify-between gap-1 sm:gap-1.5">
          {levels.map((lvl) => {
            const isSelected = normalizedValue === lvl;
            return (
              <button
                key={lvl}
                type="button"
                disabled={disabled}
                onClick={() => onChange(lvl)}
                aria-pressed={isSelected}
                aria-label={`Elasticidade nível ${lvl} de 5`}
                className={`flex-1 h-7 sm:h-7.5 min-w-[24px] sm:min-w-[28px] rounded-md text-xs sm:text-xs flex items-center justify-center border transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${getButtonStyles(
                  lvl,
                  isSelected
                )}`}
              >
                {lvl}
              </button>
            );
          })}
        </div>

        {/* Lado direito: Ícone de satisfação (Nível Ideal 5) */}
        <div
          title="Nível Ideal (5) - Elasticidade Firme / Excelente"
          className="flex items-center justify-center shrink-0 cursor-default"
        >
          <Smile
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-500 shrink-0 transition-transform hover:scale-110"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
