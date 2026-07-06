export function semanticColorClass(kind: string): string {
  switch (kind) {
    case 'idealFulfilled':
    case 'ideal':
      return 'bg-semantic-work text-[rgb(var(--color-semantic-strong-foreground))]';
    case 'leisureFulfilled':
    case 'leisure':
      return 'bg-semantic-leisure text-paper';
    case 'restFulfilled':
    case 'rest':
      return 'bg-semantic-rest text-[rgb(var(--color-semantic-strong-foreground))]';
    case 'externalShift':
      return 'bg-semantic-ext text-ink-fixed';
    case 'internalShift':
      return 'bg-semantic-int text-ink-fixed';
    default:
      return 'bg-ink-light text-paper';
  }
}

export function semanticTagColorClass(kind: string): string {
  switch (kind) {
    case 'idealFulfilled':
    case 'ideal':
      return 'bg-semantic-work text-[rgb(var(--color-semantic-strong-foreground))] border-ink';
    case 'leisureFulfilled':
    case 'leisure':
      return 'bg-semantic-leisure text-[rgb(var(--color-semantic-strong-foreground))] border-ink';
    case 'restFulfilled':
    case 'rest':
      return 'bg-semantic-rest text-[rgb(var(--color-semantic-strong-foreground))] border-ink';
    case 'externalShift':
      return 'bg-semantic-ext text-[rgb(var(--color-semantic-strong-foreground))] border-ink';
    case 'internalShift':
      return 'bg-semantic-int text-[rgb(var(--color-semantic-strong-foreground))] border-ink';
    default:
      return 'bg-ink-light text-paper border-ink';
  }
}
