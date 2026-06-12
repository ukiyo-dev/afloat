export function semanticColorClass(kind: string): string {
  switch (kind) {
    case 'idealFulfilled':
    case 'ideal':
      return 'bg-semantic-work text-ink-fixed';
    case 'leisureFulfilled':
    case 'leisure':
      return 'bg-semantic-leisure text-paper';
    case 'restFulfilled':
    case 'rest':
      return 'bg-semantic-rest text-ink-fixed';
    case 'externalShift':
      return 'bg-semantic-ext text-ink-fixed';
    case 'internalShift':
      return 'bg-semantic-int text-ink-fixed';
    default:
      return 'bg-ink-light text-paper';
  }
}
