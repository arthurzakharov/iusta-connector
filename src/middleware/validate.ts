import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import type { ValidationIssue } from "@/types/responses";

export class ValidationError extends Error {
  public constructor(public readonly issues: ValidationIssue[]) {
    super("request validation failed");
    this.name = "ValidationError";
  }
}

export function validate<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ValidationError(
        result.error.issues.map((issue) => ({
          path: [target, ...issue.path.map(String)].join("."),
          message: issue.message,
        })),
      );
    }
  });
}
