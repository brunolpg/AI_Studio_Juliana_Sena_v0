"use client";

import React from "react";
import { Clock, Check, Ban, CalendarX, Sparkles } from "lucide-react";
import type { TimeSlot } from "@/types/appointment";
import {
  getDayScheduleDescription,
  isAllowedAppointmentDay,
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
  duracao = 1,
}: TimeSlotGridProps) {
  const scheduleInfo = dateStr ? getDayScheduleDescription(dateStr) : null;
  const isAllowedDay = dateStr ? isAllowedAppointmentDay(dateStr) : slots.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/60 dark:border-slate-700/60"
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
              : "Sessões de 1 em 1 hora"}
          </span>
        </span>
        <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
          {freeCount} {freeCount === 1 ? "vaga livre" : "vagas livres"}
        </span>
      </div>

      {/* Chips com o horário de início de cada sessão (intervalos de 1h) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((s, i) => {
          // Determina H_f (fim do expediente do dia, ex: 16:00 ou 18:00)
          const lastSlot = slots[slots.length - 1];
          const H_f = lastSlot ? Number(lastSlot.endSlot.split(":")[0]) : 16;
          
          const startHour = Number(s.slot.split(":")[0]);
          const exceedsShift = startHour + duracao > H_f;

          // Verifica se existem overlaps nos blocos de 1h consecutivos necessários
          let hasOverlap = false;
          if (!s.isOccupied && !exceedsShift) {
            for (let offset = 0; offset < duracao; offset++) {
              const checkIndex = i + offset;
              if (checkIndex >= slots.length) {
                hasOverlap = true;
                break;
              }
              if (slots[checkIndex].isOccupied) {
                hasOverlap = true;
                break;
              }
            }
          }

          // Verifica se este slot específico faz parte da seleção de múltiplos horários
          const isSelected = selectedSlot !== null && (() => {
            const selHour = Number(selectedSlot.split(":")[0]);
            return startHour >= selHour && startHour < selHour + duracao;
          })();

          // 1. Ocupado de forma nativa
          if (s.isOccupied) {
            return (
              <div
                key={s.slot}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none text-xs transition-colors"
                title={`Horário ocupado ${s.occupiedPatientName ? `(${s.occupiedPatientName})` : ""}`}
              >
                <div className="flex items-center gap-1.5 font-mono">
                  <Ban className="w-3 h-3 text-slate-400" />
                  <span className="font-bold line-through">{s.slot}</span>
                </div>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
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
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-dashed border-rose-200/80 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 text-rose-600/80 dark:text-rose-400/80 cursor-not-allowed select-none text-xs"
                title={`Duração de ${duracao}h ultrapassa o expediente (${H_f}:00)`}
              >
                <div className="flex items-center gap-1.5 font-mono opacity-60">
                  <Ban className="w-3.5 h-3.5" />
                  <span className="font-bold">{s.slot}</span>
                </div>
                <span className="text-[9px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-200/50 dark:border-rose-800/30">
                  Excede exp.
                </span>
              </div>
            );
          }

          // 3. Bloqueio: horários subsequentes ocupados
          if (hasOverlap) {
            return (
              <div
                key={s.slot}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-dashed border-amber-200/80 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 text-amber-700/80 dark:text-amber-400/80 cursor-not-allowed select-none text-xs"
                title={`Requer ${duracao} horas seguidas livres, mas os horários seguintes estão ocupados.`}
              >
                <div className="flex items-center gap-1.5 font-mono opacity-60">
                  <Ban className="w-3.5 h-3.5" />
                  <span className="font-bold">{s.slot}</span>
                </div>
                <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/30">
                  Indisponível
                </span>
              </div>
            );
          }

          // 4. Slot Disponível / Selecionado
          return (
            <button
              key={s.slot}
              type="button"
              onClick={() => onSelectSlot(s.slot)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-teal-600 border-teal-600 text-white shadow-xs ring-2 ring-teal-500/20 scale-102"
                  : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-teal-500 hover:bg-teal-50/40 hover:text-teal-700 dark:hover:bg-teal-950/30 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-1.5 font-mono">
                <Clock
                  className={`w-3.5 h-3.5 ${
                    isSelected ? "text-white" : "text-teal-600 dark:text-teal-400"
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
                <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                  {duracao}h
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

