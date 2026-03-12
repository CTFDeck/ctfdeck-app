export interface TerminalEvent {
  type: 'command' | 'output' | 'error';
  content: string;
}
