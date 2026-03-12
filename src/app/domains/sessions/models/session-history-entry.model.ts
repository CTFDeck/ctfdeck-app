export interface SessionHistoryEntry {
  id: string;
  timestamp: Date;
  workingDirectory: string;
  command: string;
  output: string;
  exitCode: number;
}
