"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Info } from "lucide-react";
import {
  ALLOWED_APPOINTMENT_DAYS,
  getDayOfWeekFromDateString,
  isAllowedAppointmentDay,
} from "@/types/appointment";

interface AppointmentCalendarPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  minDate?: string;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_CONFIG = [
  { label: "Dom", day: 0, isAllowed: false },
  { label: "Seg", day: 1, isAllowed: true },
  { label: "Ter", day: 2, isAllowed: false },
  { label: "Qua", day: 3, isAllowed: false },
  { label: "Qui", day: 4, isAllowed: true },
  { label: "Sex", day: 5, isAllowed: false },
  { label: "Sáb", day: 6, isAllowed: true },
];

export function AppointmentCalendarPicker({
  selectedDate,
  onSelectDate,
  minDate,
}: AppointmentCalendarPickerProps) {
  // Parse data selecionada inicial
  const initial = selectedDate ? new Date(selectedDate + "T12:00:00") : new Date();
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initial.getMonth());

  // Primeiro dia do mês e total de dias
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Dias do mês anterior para preencher a primeira semana
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Formata hoje
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const handleSelectDay = (day: number) => {
    const formatted = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    onSelectDate(formatted);
  };

  const isCurrentSelectionAllowed = selectedDate ? isAllowedAppointmentDay(selectedDate) : true;

  return (
    <div className="bg-slate-50/80 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 select-none space-y-2.5">
      {/* Cabeçalho do Mês */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dias da semana com destaque visual para os dias de expediente */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold mb-1">
        {WEEKDAY_CONFIG.map((w) => (
          <div
            key={w.day}
            className={`py-1 rounded-md transition-colors ${
              w.isAllowed
                ? "text-teal-700 dark:text-teal-300 font-bold bg-teal-500/10"
                : "text-slate-400 dark:text-slate-500"
            }`}
            title={w.isAllowed ? "Dia com expediente clínico ativo" : "Sem atendimento"}
          >
            {w.label}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {/* Espaços do mês anterior */}
        {Array.from({ length: firstDayOfMonth }).map((_, idx) => {
          const prevDay = daysInPrevMonth - firstDayOfMonth + idx + 1;
          return (
            <div
              key={`prev-${idx}`}
              className="h-8 flex items-center justify-center text-slate-300 dark:text-slate-700 text-[11px]"
            >
              {prevDay}
            </div>
          );
        })}

        {/* Dias do mês atual */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;

          const dayDate = new Date(currentYear, currentMonth, day, 12, 0, 0);
          const dayOfWeek = dayDate.getDay();
          const isAllowedDay = ALLOWED_APPOINTMENT_DAYS.includes(dayOfWeek as 1 | 4 | 6);

          const isSelected = selectedDate === dayStr;
          const isToday = todayStr === dayStr;
          const isPast = minDate ? dayStr < minDate : false;
          const isDisabled = isPast || !isAllowedDay;

          return (
            <button
              key={`day-${day}`}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSelectDay(day)}
              title={
                !isAllowedDay
                  ? "Atendimentos ocorrem apenas às segundas, quintas e sábados."
                  : isPast
                  ? "Data retroativa não permitida."
                  : isSelected
                  ? "Data selecionada"
                  : "Clique para selecionar este dia"
              }
              className={`h-8 rounded-xl flex items-center justify-center text-xs transition-all relative ${
                isSelected
                  ? "bg-teal-600 text-white font-bold shadow-xs scale-105 z-10 cursor-pointer"
                  : isDisabled
                  ? "text-slate-300 dark:text-slate-700 cursor-not-allowed bg-slate-100/40 dark:bg-slate-900/30"
                  : isToday
                  ? "border border-teal-500 text-teal-700 dark:text-teal-400 font-bold bg-teal-50/50 dark:bg-teal-950/40 cursor-pointer hover:bg-teal-100/60"
                  : "text-slate-700 dark:text-slate-200 font-medium hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-700 cursor-pointer"
              }`}
            >
              {day}
              {isToday && !isSelected && (
                <span className="w-1 h-1 bg-teal-600 rounded-full absolute bottom-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Alerta se o usuário selecionou manualmente uma data não permitida */}
      {!isCurrentSelectionAllowed && (
        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>A Dra. Juliana atende apenas às segundas, quintas (09h-16h) e sábados (13h-18h).</span>
        </div>
      )}

      {/* Legenda de expediente */}
      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        <Info className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
        <span>Expediente: Seg e Qui (09h às 16h) • Sáb (13h às 18h)</span>
      </div>
    </div>
  );
}
