import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "../../src/modules/application/states.js";

describe("application state machine", () => {
  it("only allows approval from pending approval", () => {
    expect(canTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("APPROVED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "SUBMITTED")).toBe(false);
    expect(canTransition("REQUIRES_USER_ACTION", "SUBMITTED")).toBe(true);
    expect(canTransition("READY_FOR_SUBMISSION", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "APPROVED")).toBe(false);
  });

  it("throws on illegal transitions", () => {
    expect(() => assertTransition("REJECTED", "APPROVED")).toThrow(/Cannot transition/);
  });
});
