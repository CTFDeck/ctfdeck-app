export class TerminalHistory {
  private history: string[] = [];
  private index = -1;

  add(command: string): void {
    if (!command.trim()) {
      return;
    }

    this.history.push(command);
    this.index = this.history.length;
  }

  navigate(direction: 'up' | 'down', currentInput: string): string {
    if (this.history.length === 0) {
      return currentInput;
    }

    if (direction === 'up') {
      if (this.index > 0) {
        this.index--;
        return this.history[this.index];
      }
    } else {
      if (this.index < this.history.length - 1) {
        this.index++;
        return this.history[this.index];
      }

      this.index = this.history.length;
      return '';
    }

    return currentInput;
  }

  setHistory(commands: string[]): void {
    this.history = [...commands];
    this.index = this.history.length;
  }
}
