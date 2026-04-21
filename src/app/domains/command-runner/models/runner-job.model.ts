import { SafeHtml } from '@angular/platform-browser';
 
export type JobStatus = 'running' | 'completed' | 'stopped' | 'error';
 
export interface RunnerJob {
  id: string;
  command: string;
  label: string;
  status: JobStatus;
  outputLines: SafeHtml[];
  exitCode?: number;
  startedAt: Date;
  endedAt?: Date;
}
 