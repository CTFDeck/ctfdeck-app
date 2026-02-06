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
  private readonly COMMANDS_KEY = 'ctfdeck_target_commands';

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
    if (!targetId || !tool) return false;
    const stored = localStorage.getItem(this.COMMANDS_KEY);
    let commandsByTarget: Record<string, Record<string, string>> = {};
    if (stored) {
      try {
        commandsByTarget = JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing target commands:', error);
      }
    }
    commandsByTarget[targetId] = commandsByTarget[targetId] || {};
    commandsByTarget[targetId][tool] = command;
    localStorage.setItem(this.COMMANDS_KEY, JSON.stringify(commandsByTarget));
    return true;
  }

  getSavedCommand(targetId: string, tool: string): string | null {
    if (!targetId || !tool) return null;
    const stored = localStorage.getItem(this.COMMANDS_KEY);
    if (!stored) return null;
    try {
      const commandsByTarget: Record<string, Record<string, string>> = JSON.parse(stored);
      return commandsByTarget[targetId]?.[tool] ?? null;
    } catch (error) {
      console.error('Error parsing target commands:', error);
      return null;
    }
  }
}
