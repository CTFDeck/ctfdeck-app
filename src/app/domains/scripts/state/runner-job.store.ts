import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { WebSocketService } from '../../../infrastructure/transport/websocket/websocket.service';
import { SessionStore } from '../../sessions/state/session.store';
import { generateUUID } from '../../../infrastructure/transport/websocket/websocket-uuid.utils';
import {
  ansiToSafeHtml,
  appendErrorToLastOutput,
  createAnsiConverter,
  errorMessageOf,
  toSafeHtml,
} from '../../command-runner/utils/command-runner-render.utils';
import { createRenderScheduler } from '../../command-runner/utils/command-runner-render-scheduler.utils';
import type { RunnerJob } from '../../command-runner/models/runner-job.model';
 
@Injectable({ providedIn: 'root' })
export class RunnerJobStore {
  private readonly ws = inject(WebSocketService);
  private readonly zone = inject(NgZone);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly sessionStore = inject(SessionStore);
 
  private readonly jobsSubject = new BehaviorSubject<RunnerJob[]>([]);
  readonly jobs$ = this.jobsSubject.asObservable();
 
  readonly runningCount$ = this.jobs$.pipe(
    map((jobs) => jobs.filter((j) => j.status === 'running').length),
  );
 
  readonly hasRunning$ = this.runningCount$.pipe(map((count) => count > 0));
 
  private readonly ansiConverters = new Map<string, ReturnType<typeof createAnsiConverter>>();
 
  run(command: string, label: string): string {
    const jobId = generateUUID();
    const ansiConverter = createAnsiConverter();
    this.ansiConverters.set(jobId, ansiConverter);
 
    const job: RunnerJob = {
      id: jobId,
      command,
      label,
      status: 'running',
      outputLines: [toSafeHtml(this.sanitizer, `<span class="text-blue-400">$ ${command}</span>`)],
      startedAt: new Date(),
    };
 
    this.jobsSubject.next([...this.jobsSubject.value, job]);
 
    let outputLineIndex = -1;
    let outputBuffer = '';
 
    const renderScheduler = createRenderScheduler(() => {
      this.zone.run(() => {
        this.updateJobOutputLine(jobId, outputLineIndex, outputBuffer);
      });
    });
 
    this.sessionStore.broadcastTerminalEvent({ type: 'command', content: command });
 
    const { promise, messageId } = this.ws.executeCommandStreaming(
      command,
      (data: string) => {
        outputBuffer += data;

        if (outputLineIndex === -1) {
          outputLineIndex = this.getJobOutputLength(jobId);
          this.appendJobLine(jobId, toSafeHtml(this.sanitizer, ''));
        }

        this.sessionStore.broadcastTerminalEvent({ type: 'output', content: data });
        renderScheduler.schedule();
      },
      (data: string) => {
        this.sessionStore.broadcastTerminalEvent({ type: 'error', content: data });
        this.appendJobError(jobId, data);
      },
    );

    this.jobsSubject.next(
      this.jobsSubject.value.map((j) => (j.id === jobId ? { ...j, wsMessageId: messageId } : j)),
    );

    promise.then((result) => {
        if (outputLineIndex >= 0) {
          this.updateJobOutputLine(jobId, outputLineIndex, outputBuffer);
        }
 
        this.zone.run(() => {
          this.updateJobStatus(jobId, 'completed', result.exitCode);
          this.appendJobLine(
            jobId,
            toSafeHtml(
              this.sanitizer,
              `<span class="text-green-400">✓ Done. Exit code: ${result.exitCode}</span>`,
            ),
          );
          this.ansiConverters.delete(jobId);
          void this.sessionStore.refreshActiveSession();
        });
      })
      .catch((error: unknown) => {
        const msg = errorMessageOf(error);
 
        if (msg === 'Command timeout' || msg?.includes('kill')) {
          this.zone.run(() => {
            this.updateJobStatus(jobId, 'stopped');
            this.appendJobLine(
              jobId,
              toSafeHtml(this.sanitizer, `<span class="text-yellow-500">⏹ Stopped</span>`),
            );
          });
        } else {
          this.zone.run(() => {
            this.updateJobStatus(jobId, 'error');
            this.appendJobLine(
              jobId,
              toSafeHtml(
                this.sanitizer,
                `<span class="text-red-500">✗ Error: ${msg}</span>`,
              ),
            );
          });
        }
 
        this.ansiConverters.delete(jobId);
      });
 
    return jobId;
  }
 
  createManualJob(jobId: string, command: string, label: string, wsMessageId: string): void {
    const ansiConverter = createAnsiConverter();
    this.ansiConverters.set(jobId, ansiConverter);

    const job: RunnerJob = {
      id: jobId,
      command,
      label,
      status: 'running',
      outputLines: [],
      startedAt: new Date(),
      wsMessageId,
    };
    this.jobsSubject.next([...this.jobsSubject.value, job]);
  }

  stop(jobId: string): void {
    const job = this.getJob(jobId);

    if (!job || job.status !== 'running') {
      return;
    }

    if (job.wsMessageId) {
      this.ws.killCommand(job.wsMessageId);
    }

    this.updateJobStatus(jobId, 'stopped');
    this.appendJobLine(
      jobId,
      toSafeHtml(this.sanitizer, `<span class="text-yellow-500">⏹ Stopped by user</span>`),
    );
  }

  restart(jobId: string): string | undefined {
    const job = this.getJob(jobId);
    if (job) {
      return this.run(job.command, job.label);
    }
    return undefined;
  }
 
  remove(jobId: string): void {
    this.jobsSubject.next(this.jobsSubject.value.filter((j) => j.id !== jobId));
    this.ansiConverters.delete(jobId);
  }
 
  clearCompleted(): void {
    this.jobsSubject.next(this.jobsSubject.value.filter((j) => j.status === 'running'));
  }
 
  getJob(jobId: string): RunnerJob | undefined {
    return this.jobsSubject.value.find((j) => j.id === jobId);
  }
 
  updateJobStatus(jobId: string, status: RunnerJob['status'], exitCode?: number): void {
    this.jobsSubject.next(
      this.jobsSubject.value.map((j) =>
        j.id === jobId
          ? { ...j, status, exitCode: exitCode ?? j.exitCode, endedAt: new Date() }
          : j,
      ),
    );
  }
 
  getJobOutputLength(jobId: string): number {
    return this.getJob(jobId)?.outputLines.length ?? 0;
  }
 
  appendJobLine(jobId: string, line: ReturnType<typeof toSafeHtml>): void {
    this.jobsSubject.next(
      this.jobsSubject.value.map((j) =>
        j.id === jobId ? { ...j, outputLines: [...j.outputLines, line] } : j,
      ),
    );
  }
 
  updateJobOutputLine(jobId: string, lineIndex: number, buffer: string): void {
    const converter = this.ansiConverters.get(jobId);
 
    if (!converter) {
      return;
    }
 
    const rendered = ansiToSafeHtml(converter, this.sanitizer, buffer);
 
    this.jobsSubject.next(
      this.jobsSubject.value.map((j) => {
        if (j.id !== jobId) {
          return j;
        }
 
        const lines = [...j.outputLines];
 
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = rendered;
        }
 
        return { ...j, outputLines: lines };
      }),
    );
  }
 
  appendJobError(jobId: string, data: string): void {
    const job = this.getJob(jobId);
 
    if (!job) {
      return;
    }
 
    const updated = appendErrorToLastOutput(job.outputLines, this.sanitizer, data);
 
    this.jobsSubject.next(
      this.jobsSubject.value.map((j) => (j.id === jobId ? { ...j, outputLines: updated } : j)),
    );
  }
}
 