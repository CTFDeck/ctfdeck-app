import { Injectable } from '@angular/core';

export interface Target {
  id: string;
  name: string;
  host: string;
  port?: number;
  description?: string;
  createdAt: string;
  commands?: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class TargetService {
  private readonly STORAGE_KEY = 'ctfdeck_targets';

  getTargets(): Target[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing targets:', error);
      return [];
    }
  }

  private saveTargets(targets: Target[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(targets));
  }

  addTarget(target: Omit<Target, 'id' | 'createdAt'>): Target {
    const newTarget: Target = {
      ...target,
      id: `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    const targets = this.getTargets();
    targets.push(newTarget);
    this.saveTargets(targets);
    
    return newTarget;
  }

  updateTarget(id: string, updates: Partial<Target>): boolean {
    const targets = this.getTargets();
    const index = targets.findIndex(t => t.id === id);
    
    if (index === -1) return false;
    
    targets[index] = { ...targets[index], ...updates };
    this.saveTargets(targets);
    
    return true;
  }

  deleteTarget(id: string): boolean {
    const targets = this.getTargets();
    const filtered = targets.filter(t => t.id !== id);
    
    if (filtered.length === targets.length) return false;
    
    this.saveTargets(filtered);
    return true;
  }

  deleteTargets(ids: string[]): number {
    const targets = this.getTargets();
    const filtered = targets.filter(t => !ids.includes(t.id));
    const deletedCount = targets.length - filtered.length;
    
    this.saveTargets(filtered);
    this.saveTargets(filtered);
    return deletedCount;
  }

  saveTargetCommand(targetId: string, tool: string, command: string): boolean {
    const targets = this.getTargets();
    const index = targets.findIndex(t => t.id === targetId);

    if (index === -1) return false;

    const target = targets[index];
    const commands = target.commands || {};
    commands[tool] = command;

    targets[index] = { ...target, commands };
    this.saveTargets(targets);

    return true;
  }
}