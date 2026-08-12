import { z } from "zod";
import {
  RETURN_STATUS,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from "@/lib/constants";

/**
 * Input schemas for the support desk — SRS §133-137, §111.
 *
 * The customer's side of the same models is validated in
 * `src/lib/validations/commerce.ts`; this is the agent's side, and the one
 * field that only exists here is `isInternalNote`. A note the requester must
 * never see is a security boundary expressed as a boolean, so it is parsed
 * explicitly rather than inferred from who is posting — an agent writing a
 * customer-visible reply and an agent writing a private note are the same person
 * on the same screen.
 */

const cuid = z.string().trim().min(1, "Missing identifier.");

export const ticketAssignSchema = z.object({
  ticketId: cuid,
  // "" means unassign — putting a ticket back in the shared queue is a real
  // action, not the absence of one.
  assigneeId: z.string().trim(),
});

export const ticketMoveSchema = z.object({
  ticketId: cuid,
  to: z.enum(Object.values(TICKET_STATUS) as [string, ...string[]], {
    message: "That is not a known ticket status.",
  }),
  resolutionNote: z
    .string()
    .trim()
    .max(600, "Keep the resolution under 600 characters.")
    .optional(),
});

export const ticketPrioritySchema = z.object({
  ticketId: cuid,
  priority: z.enum(Object.values(TICKET_PRIORITY) as [string, ...string[]], {
    message: "Choose a priority.",
  }),
});

export const agentReplySchema = z.object({
  ticketId: cuid,
  body: z
    .string()
    .trim()
    .min(2, "Write a reply.")
    .max(4000, "Keep the message under 4000 characters."),
  isInternalNote: z.coerce.boolean().optional(),
});

export const returnDecisionSchema = z.object({
  returnId: cuid,
  to: z.enum(Object.values(RETURN_STATUS) as [string, ...string[]], {
    message: "That is not a known return status.",
  }),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional(),
});
