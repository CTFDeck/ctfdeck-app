import { Injectable } from '@angular/core';

export interface Target {
  id: string;
  name: string;
  host: string;
  port?: number;
  description?: string;
  createdAt: string;
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
}