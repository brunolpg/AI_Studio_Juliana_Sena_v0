"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { getClientsAction } from "@/actions/client-actions";
import { getAppointmentsAction } from "@/actions/appointment-actions";
import type { ActionResponse } from "@/types/client";

export interface DashboardStats {
  totalPacientes: number;
  pacientesAtivos: number;
  consultasHoje: number;
  proximosAtendimentos: number;
}

/**
 * Retorna as estatísticas consolidadas para os cards do Dashboard de Atendimento
 * Consulta diretamente o Supabase com agregações otimizadas (head: true)
 * e possui fallback automático em memória/actions para alta disponibilidade.
 * Contagens de pacientes são estritamente restritas ao perfil 'profissional'.
 */
export async function getDashboardStatsAction(): Promise<ActionResponse<DashboardStats>> {
  try {
    const user = await getSession();
    if (!user || (user.role !== "profissional" && user.role !== "administrador")) {
      return {
        success: false,
        message: "Acesso não autorizado.",
        data: {
          totalPacientes: 0,
          pacientesAtivos: 0,
          consultasHoje: 0,
          proximosAtendimentos: 0,
        },
      };
    }

    const isProfissional = user.role === "profissional";
    const supabase = await createClient();

    if (supabase) {
      const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());

      const [
        totalPacientesRes,
        pacientesAtivosRes,
        consultasHojeRes,
        proximosAtendimentosRes,
      ] = await Promise.all([
        isProfissional
          ? supabase
              .from("pacientes")
              .select("*", { count: "exact", head: true })
              .is("deleted_at", null)
          : Promise.resolve({ count: 0, error: null }),
        isProfissional
          ? supabase
              .from("pacientes")
              .select("*", { count: "exact", head: true })
              .is("deleted_at", null)
              .eq("status", "Ativo")
          : Promise.resolve({ count: 0, error: null }),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("data", todayStr)
          .neq("status", "Cancelado"),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .gte("data", todayStr)
          .not("status", "in", '("Cancelado","Concluído")'),
      ]);

      const hasError =
        Boolean(totalPacientesRes.error) ||
        Boolean(pacientesAtivosRes.error) ||
        Boolean(consultasHojeRes.error) ||
        Boolean(proximosAtendimentosRes.error);

      if (!hasError) {
        return {
          success: true,
          data: {
            totalPacientes: isProfissional ? (totalPacientesRes.count ?? 0) : 0,
            pacientesAtivos: isProfissional ? (pacientesAtivosRes.count ?? 0) : 0,
            consultasHoje: consultasHojeRes.count ?? 0,
            proximosAtendimentos: proximosAtendimentosRes.count ?? 0,
          },
        };
      }

      console.warn("Aviso ao buscar contadores no Supabase, acionando fallback:", {
        pacientesErr: totalPacientesRes.error?.message,
        aptsErr: consultasHojeRes.error?.message,
      });
    }

    // Fallback através das actions consolidadas
    const [allClientsRes, activeClientsRes, todayAptsRes, upcomingAptsRes] = await Promise.all([
      isProfissional ? getClientsAction({ status: "todos", pageSize: 1 }) : Promise.resolve(null),
      isProfissional ? getClientsAction({ status: "Ativo", pageSize: 1 }) : Promise.resolve(null),
      getAppointmentsAction({ tab: "hoje", pageSize: 1 }),
      getAppointmentsAction({ tab: "proximos", pageSize: 1 }),
    ]);

    return {
      success: true,
      data: {
        totalPacientes: isProfissional ? (allClientsRes?.data?.total ?? 0) : 0,
        pacientesAtivos: isProfissional ? (activeClientsRes?.data?.total ?? 0) : 0,
        consultasHoje: todayAptsRes.data?.total ?? 0,
        proximosAtendimentos: upcomingAptsRes.data?.total ?? 0,
      },
    };
  } catch (err) {
    console.error("Erro interno em getDashboardStatsAction:", err);
    return {
      success: false,
      message: "Falha ao obter dados estatísticos do dashboard.",
      data: {
        totalPacientes: 0,
        pacientesAtivos: 0,
        consultasHoje: 0,
        proximosAtendimentos: 0,
      },
    };
  }
}
