export function semanticColorClass(kind: string): string {
  switch (kind) {
    case 'idealFulfilled':
    case 'ideal':
      return 'bg-semantic-work text-white';
    case 'leisureFulfilled':
    case 'leisure':
      return 'bg-semantic-leisure text-white';
    case 'restFulfilled':
    case 'rest':
      return 'bg-semantic-rest text-ink'; // Sage Green needs dark text for contrast
    case 'externalShift':
      return 'bg-semantic-ext text-ink'; // Banana Yellow needs dark text
    case 'internalShift':
      return 'bg-semantic-int text-white'; // Tomato Red works with white text
    default:
      return 'bg-ink-light text-white';
  }
}
