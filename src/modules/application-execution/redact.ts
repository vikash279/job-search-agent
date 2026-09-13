import { sanitizeLogValue } from "../../lib/logger.js";
import { SENSITIVE_FIELD_KINDS, type ExecutionResult, type MappedField } from "./types.js";

export function publicMappedFields(fields: MappedField[]): ExecutionResult["mappedFields"] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    filled: field.filled,
    requiresHuman: field.requiresHuman,
    reason: field.reason,
  }));
}

export function redactExecutionResult(
  result: Omit<ExecutionResult, "attempt"> & { attempt?: number },
): ExecutionResult {
  const safe = sanitizeLogValue({
    ...result,
    mappedFields: result.mappedFields,
    checkpoints: result.checkpoints,
  }) as ExecutionResult;
  return {
    ...safe,
    attempt: result.attempt ?? 0,
    mappedFields: result.mappedFields.map((field) => ({
      ...field,
      // values are never persisted on the public result
    })),
  };
}

export function redactEventMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeLogValue(metadata) as Record<string, unknown>;
}

export function isSensitiveKind(kind: MappedField["kind"]): boolean {
  return SENSITIVE_FIELD_KINDS.has(kind);
}
