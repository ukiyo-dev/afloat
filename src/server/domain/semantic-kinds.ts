import type { FactKind, PlanKind } from "./types";

export type FulfilledKind = Exclude<FactKind, "externalShift" | "internalShift">;

export const fulfilledKindByPlanKind: Record<PlanKind, FulfilledKind> = {
  ideal: "idealFulfilled",
  leisure: "leisureFulfilled",
  rest: "restFulfilled"
};

export const planKindByFulfilledKind: Record<FulfilledKind, PlanKind> = {
  idealFulfilled: "ideal",
  leisureFulfilled: "leisure",
  restFulfilled: "rest"
};

export function isFulfilledKind(kind: string): kind is FulfilledKind {
  return kind === "idealFulfilled" || kind === "leisureFulfilled" || kind === "restFulfilled";
}

export function isPlanKind(kind: string): kind is PlanKind {
  return kind === "ideal" || kind === "leisure" || kind === "rest";
}

export function isPlanActivityKind(kind: string): boolean {
  return isPlanKind(kind) || isFulfilledKind(kind);
}
