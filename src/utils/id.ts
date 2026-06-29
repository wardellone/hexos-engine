let counter = 0;

export function generateId(defId: string, owner: string): string {
  counter++;
  return `${defId}_${owner}_${counter.toString().padStart(4, '0')}`;
}

export function generateGameId(): string {
  counter++;
  return `GAME_${Date.now()}_${counter}`;
}

export function generateStackId(): string {
  counter++;
  return `STACK_${counter}`;
}

export function resetCounter(): void {
  counter = 0;
}
