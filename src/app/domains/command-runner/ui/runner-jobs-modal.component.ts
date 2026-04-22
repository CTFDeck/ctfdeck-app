import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideClock,
  lucideSquare,
  lucideTrash2,
  lucideX,
  lucideLoader,
  lucideTerminal,
  lucideRotateCw,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@ctfdeck/helm/button';
import { HlmIconImports } from '@ctfdeck/helm/icon';
import { RunnerJobStore } from '../../scripts/state/runner-job.store';
import type { RunnerJob } from '../models/runner-job.model';
import { TranslatePipe } from '../../../shell/menubar/translate.pipe';
 
@Component({
  selector: 'app-runner-jobs-modal',
  standalone: true,
  imports: [CommonModule, ...HlmButtonImports, ...HlmIconImports, TranslatePipe],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideClock,
      lucideSquare,
      lucideTrash2,
      lucideX,
      lucideLoader,
      lucideTerminal,
      lucideRotateCw,
    }),
  ],
  templateUrl: './runner-jobs-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunnerJobsModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
 
  @ViewChildren('jobOutput') private jobOutputRefs!: QueryList<ElementRef>;
 
  private readonly jobStore = inject(RunnerJobStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subscriptions = new Subscription();
 
  jobs: RunnerJob[] = [];
  selectedJobId: string | null = null;
 
  ngOnInit(): void {
    this.subscriptions.add(
      this.jobStore.jobs$.subscribe((jobs) => {
        const wasEmpty = this.jobs.length === 0;
        this.jobs = jobs;
 
        if (wasEmpty && jobs.length > 0) {
          this.selectedJobId = jobs[jobs.length - 1].id;
        }
 
        if (this.selectedJobId && !jobs.find((j) => j.id === this.selectedJobId)) {
          this.selectedJobId = jobs.length > 0 ? jobs[jobs.length - 1].id : null;
        }
 
        this.cdr.markForCheck();
        this.scrollSelectedToBottom();
      }),
    );
  }
 
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.jobs.length > 0 && !this.selectedJobId) {
      this.selectedJobId = this.jobs[this.jobs.length - 1].id;
    }
  }
 
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
 
  get selectedJob(): RunnerJob | undefined {
    return this.jobs.find((j) => j.id === this.selectedJobId);
  }
 
  selectJob(jobId: string): void {
    this.selectedJobId = jobId;
    this.scrollSelectedToBottom();
  }
 
  stopJob(jobId: string): void {
    this.jobStore.stop(jobId);
  }

  restartJob(jobId: string): void {
    const newId = this.jobStore.restart(jobId);
    if (newId) {
      this.selectedJobId = newId;
      this.scrollSelectedToBottom();
    }
  }
 
  removeJob(jobId: string): void {
    this.jobStore.remove(jobId);
  }
 
  clearCompleted(): void {
    this.jobStore.clearCompleted();
  }
 
  close(): void {
    this.visibleChange.emit(false);
  }
 
  statusIcon(status: RunnerJob['status']): string {
    switch (status) {
      case 'running':
        return 'lucideLoader';
      case 'completed':
        return 'lucideCircleCheck';
      case 'stopped':
        return 'lucideClock';
      case 'error':
        return 'lucideCircleX';
    }
  }
 
  statusClass(status: RunnerJob['status']): string {
    switch (status) {
      case 'running':
        return 'text-blue-400 animate-spin';
      case 'completed':
        return 'text-green-400';
      case 'stopped':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
    }
  }
 
  statusBadgeClass(status: RunnerJob['status']): string {
    switch (status) {
      case 'running':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'stopped':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
    }
  }
 
  duration(job: RunnerJob): string {
    const end = job.endedAt ?? new Date();
    const ms = end.getTime() - job.startedAt.getTime();
    const s = Math.floor(ms / 1000);
 
    if (s < 60) {
      return `${s}s`;
    }
 
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }
 
  trackByJobId(_: number, job: RunnerJob): string {
    return job.id;
  }
 
  private scrollSelectedToBottom(): void {
    setTimeout(() => {
      const ref = this.jobOutputRefs?.find((_, i) => {
        const job = this.jobs[i];
        return job?.id === this.selectedJobId;
      });
 
      if (ref) {
        ref.nativeElement.scrollTop = ref.nativeElement.scrollHeight;
      }
    }, 0);
  }
}