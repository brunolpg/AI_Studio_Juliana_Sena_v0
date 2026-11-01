"use client";

import React from "react";
import { Clock, Check, Ban, CalendarX, Sparkles } from "lucide-react";
import type { TimeSlot } from "@/types/appointment";
import {
  getDayScheduleDescription,
  isAllowedAppointmentDay,
  getDurationInMinutes,
  formatDurationLabel,
} from "@/types/appointment";

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  isLoading?: boolean;
  dateStr?: string;
  duracao?: number;
}

export function TimeSlotGrid({
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading = false,
  dateStr,
  duracao = 0.5,
}: TimeSlotGridProps) {
  const scheduleInfo = dateStr ? getDayScheduleDescription(dateStr) : null;
  const isAllowedDay = dateStr ? isAllowedAppointmentDay(dateStr) : slots.length > 0;

  const durationMinutes = getDurationInMinutes(duracao);
  const durationLabel = formatDurationLabel(durationMinutes);
  const requiredSlotsCount = Math.max(1, Math.ceil(durationMinutes / 30));

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2.5 py-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/60 dark:border-slate-700/60"
            />
          ))}
        </div>
      </div>
    );
  }

  // Dia sem atendimento ou sem horários configurados
  if (!isAllowedDay || slots.length === 0) {
    return (
      <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-2">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center">
          <CalendarX className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Sem expediente neste dia da semana
          </h4>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
            A Dra. Juliana atende apenas às <strong>segundas</strong> e <strong>quintas</strong> (09h às 16h) e aos <strong>sábados</strong> (13h às 18h). Selecione um dia válido no calendário ao lado.
          </p>
        </div>
      </div>
    );
  }

  const freeCount = slots.filter((s) => !s.isOccupied).length;

  return (
    <div className="space-y-2.5">
      {/* Cabeçalho da grade de horários */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>
            {scheduleInfo
              ? `${scheduleInfo.dayName} (${scheduleInfo.hoursDescription.split("(")[0].trim()})`
              : "Intervalos de 30 minutos"}
          </span>
        </span>
        <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
          {freeCount} {freeCount === 1 ? "vaga livre" : "vagas livres"}
        </span>
      </div>

      {/* Grade com rolagem suave no mobile e telas landscape */}
      <div className="max-h-60 sm:max-h-72 landscape:max-h-48 overflow-y-auto overscroll-contain pr-1 scroll-smooth no-scrollbar sm:scroll-auto">
        {/* Chips com o horário de início em intervalos de 30m */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {slots.map((s, i) => {
            let exceedsShift = false;
            let hasOverlap = false;
            let hasGap = false;

            if (!s.isOccupied) {
              if (i + requiredSlotsCount > slots.length) {
                exceedsShift = true;
              } else {
                for (let offset = 0; offset < requiredSlotsCount; offset++) {
                  const checkIndex = i + offset;
                  if (slots[checkIndex].isOccupied) {
                    hasOverlap = true;
                    break;
                  }
                  if (offset > 0 && slots[checkIndex].slot !== slots[checkIndex - 1].endSlot) {
                    hasGap = true;
                    break;
                  }
                }
              }
            }

            // Verifica se este slot específico faz parte da seleção contígua
            const isSelected = selectedSlot !== null && (() => {
              const selIdx = slots.findIndex((slotObj) => slotObj.slot === selectedSlot);
              if (selIdx === -1) return false;
              return i >= selIdx && i < selIdx + requiredSlotsCount;
            })();

            // 1. Ocupado no Supabase ou Google Calendar
            if (s.isOccupied) {
              return (
                <div
                  key={s.slot}
                  className="flex items-center justify-between px-3 py-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none text-xs transition-colors shadow-2xs"
                  title={`Horário ocupado ${s.occupiedPatientName ? `(${s.occupiedPatientName})` : ""}`}
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    <Ban className="w-3 h-3 text-slate-400" />
                    <span className="font-bold line-through">{s.slot}</span>
                  </div>
                  <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    Ocupado
                  </span>
                </div>
              );
            }

            // 2. Bloqueio Preventivo: excede o expediente
            if (exceedsShift) {
              return (
                <div
                  key={s.slot}
                  className="flex items-center justify-between px-3 py-2.5 rounded-2xl border border-dashed border-rose-200/80 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 text-rose-600/80 dark:text-rose-400/80 cursor-not-allowed select-none text-xs shadow-2xs"
                  title={`Duração de ${durationLabel} ultrapassa o expediente`}
                >
                  <div className="flex items-center gap-1.5 font-mono opacity-60">
                    <Ban className="w-3.5 h-3.5" />
                    <span className="font-bold">{s.slot}</span>
                  </div>
                  <span className="text-[9px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-200/50 dark:border-rose-800/30">
                    Excede exp.
                  </span>
                </div>
              );
            }

            // 3. Bloqueio: cruza intervalo de almoço / intervalo de turno
            if (hasGap) {
              return (
                <div
                  key={s.slot}
                  className="flex items-center justify-between px-3 py-2.5 rounded-2xl border border-dashed border-amber-200/80 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 text-amber-700/80 dark:text-amber-400/80 cursor-not-allowed select-none text-xs shadow-2xs"
                  title={`Duração de ${durationLabel} cruza o intervalo de almoço.`}
                >
                  <div className="flex items-center gap-1.5 font-mono opacity-60">
                    <Ban className="w-3.5 h-3.5" />
                    <span className="font-bold">{s.slot}</span>
                  </div>
                  <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/30">
                    Intervalo
                  </span>
                </div>
              );
            }

            // 4. Bloqueio: horários subsequentes ocupados
            if (hasOverlap) {
              return (
                <div
                  key={s.slot}
                  className="flex items-center justify-between px-3 py-2.5 rounded-2xl border border-dashed border-amber-200/80 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 text-amber-700/80 dark:text-amber-400/80 cursor-not-allowed select-none text-xs shadow-2xs"
                  title={`Requer ${durationLabel} livres contínuos, mas os horários seguintes estão ocupados.`}
                >
                  <div className="flex items-center gap-1.5 font-mono opacity-60">
                    <Ban className="w-3.5 h-3.5" />
                    <span className="font-bold">{s.slot}</span>
                  </div>
                  <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/30">
                    Indisponível
                  </span>
                </div>
              );
            }

            // 5. Slot Disponível / Selecionado
            return (
              <button
                key={s.slot}
                type="button"
                onClick={() => onSelectSlot(s.slot)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer select-none md-state-layer ${
                  isSelected
                    ? "bg-teal-700 dark:bg-teal-500 border-teal-700 dark:border-teal-500 text-white dark:text-slate-950 shadow-xs ring-2 ring-teal-500/20"
                    : "bg-white dark:bg-slate-850 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-teal-500 hover:bg-teal-50/40 hover:text-teal-700 dark:hover:bg-teal-950/30 shadow-2xs"
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      isSelected ? "text-white dark:text-slate-950" : "text-teal-600 dark:text-teal-400"
                    }`}
                  />
                  <span className="font-bold text-xs">{s.slot}</span>
                </div>

                {isSelected ? (
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    {selectedSlot === s.slot ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Início</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-teal-100 animate-pulse" />
                        <span>Incluso</span>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/60">
                    {durationLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

