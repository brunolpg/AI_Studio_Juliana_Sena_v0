import { z } from "zod";
import {
  isAllowedAppointmentDay,
  getAllowedStartTimesForDate,
} from "@/types/appointment";

/**
 * Schema Zod com validações rígidas para agendamentos:
 * - Validação estrita de formato de data e horário
 * - Refine 1: Atendimento restrito a Segundas, Quintas e Sábados
 * - Refine 2: Horário restrito à grade do dia (Seg/Qui: 09:00 às 15:00; Sáb: 13:00 às 17:00)
 */
export const appointmentSchema = z
  .object({
    client_id: z
      .string()
      .min(1, { message: "Selecione um paciente para o agendamento." }),

    client_nome: z
      .string()
      .min(1, { message: "Nome do paciente é obrigatório." }),

    client_email: z
      .string()
      .email({ message: "Formato de e-mail inválido." })
      .or(z.literal(""))
      .optional(),

    client_telefone: z.string().optional(),

    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data deve estar no formato AAAA-MM-DD." }),

    horario_inicio: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { message: "Horário deve estar no formato HH:MM." }),

    procedimento: z
      .string()
      .trim()
      .min(2, { message: "O procedimento deve conter no mínimo 2 caracteres." })
      .max(150, { message: "O procedimento não pode exceder 150 caracteres." }),

    observacoes: z.string().trim().max(500, { message: "Observações não podem exceder 500 caracteres." }).optional(),

    sync_google: z.boolean().default(false),
  })
  .refine(
    (val) => isAllowedAppointmentDay(val.data),
    {
      message: "Atendimentos disponíveis apenas às segundas-feiras, quintas-feiras e sábados.",
      path: ["data"],
    }
  )
  .refine(
    (val) => {
      const allowedTimes = getAllowedStartTimesForDate(val.data);
      return allowedTimes.includes(val.horario_inicio);
    },
    {
      message: "Horário fora da grade de atendimento permitida para este dia.",
      path: ["horario_inicio"],
    }
  );

export type AppointmentSchemaInput = z.infer<typeof appointmentSchema>;

export const appointmentUpdateSchema = z
  .object({
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data deve estar no formato AAAA-MM-DD." })
      .optional(),

    horario_inicio: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { message: "Horário deve estar no formato HH:MM." })
      .optional(),

    procedimento: z
      .string()
      .trim()
      .min(2, { message: "O procedimento deve conter no mínimo 2 caracteres." })
      .max(150, { message: "O procedimento não pode exceder 150 caracteres." })
      .optional(),

    observacoes: z.string().trim().max(500).optional().nullable(),

    status: z.enum(["Confirmado", "Pendente", "Concluído", "Cancelado"]).optional(),
  })
  .refine(
    (val) => {
      if (val.data) {
        return isAllowedAppointmentDay(val.data);
      }
      return true;
    },
    {
      message: "Atendimentos disponíveis apenas às segundas-feiras, quintas-feiras e sábados.",
      path: ["data"],
    }
  )
  .refine(
    (val) => {
      if (val.data && val.horario_inicio) {
        const allowedTimes = getAllowedStartTimesForDate(val.data);
        return allowedTimes.includes(val.horario_inicio);
      }
      return true;
    },
    {
      message: "Horário fora da grade de atendimento permitida para este dia.",
      path: ["horario_inicio"],
    }
  );
