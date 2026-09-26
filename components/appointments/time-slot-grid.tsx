"use client";

import React from "react";
import { Clock, Check, Ban } from "lucide-react";
import type { TimeSlot } from "@/types/appointment";

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  isLoading?: boolean;
}

export function TimeSlotGrid({
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading = false,
}: TimeSlotGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/60 dark:border-slate-700/60"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1 font-medium">
          <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Intervalos Estritos de 1 hora (08:00 às 17:00)</span>
        </span>
        <span className="text-[11px]">
          {slots.filter((s) => !s.isOccupied).length} horários disponíveis
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((s) => {
          const isSelected = selectedSlot === s.slot;

          if (s.isOccupied) {
            return (
              <div
                key={s.slot}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed text-xs"
                title={`Horário ocupado ${s.occupiedPatientName ? `(${s.occupiedPatientName})` : ""}`}
              >
                <div className="flex items-center gap-1.5 font-mono">
                  <Ban className="w-3.5 h-3.5 text-slate-400" />
                  <span>{s.label}</span>
                </div>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                  Ocupado
                </span>
              </div>
            );
          }

          return (
            <button
              key={s.slot}
              type="button"
              onClick={() => onSelectSlot(s.slot)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? "bg-teal-600 border-teal-600 text-white shadow-xs scale-102"
                  : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-teal-600 dark:text-teal-400"}`} />
                <span>{s.label}</span>
              </div>
              {isSelected ? (
                <div className="w-4 h-4 rounded-full bg-white text-teal-600 flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              ) : (
                <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                  Livre
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
