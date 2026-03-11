import { Injectable } from '@angular/core';

type CommandsByTarget = Record<string, Record<string, string>>;

@Injectable({
  providedIn: 'root',
})
export class TargetCommandStoreService {
  private readonly COMMANDS_KEY = 'ctfdeck_target_commands';

  saveCommand(targetId: string, commandId: string, command: string): boolean {
    if (!targetId || !commandId) {
      return false;
    }

    const commandsByTarget = this.readCommands();
    commandsByTarget[targetId] = commandsByTarget[targetId] || {};
    commandsByTarget[targetId][commandId] = command;

    localStorage.setItem(this.COMMANDS_KEY, JSON.stringify(commandsByTarget));
    return true;
  }

  getSavedCommand(targetId: string, commandId: string): string | null {
    if (!targetId || !commandId) {
      return null;
    }

    const commandsByTarget = this.readCommands();
    return commandsByTarget[targetId]?.[commandId] ?? null;
  }

  deleteTargetCommands(targetId: string): void {
    if (!targetId) {
      return;
    }

    const commandsByTarget = this.readCommands();
    delete commandsByTarget[targetId];
    localStorage.setItem(this.COMMANDS_KEY, JSON.stringify(commandsByTarget));
  }

  private readCommands(): CommandsByTarget {
    const stored = localStorage.getItem(this.COMMANDS_KEY);

    if (!stored) {
      return {};
    }

    try {
      return JSON.parse(stored) as CommandsByTarget;
    } catch (error) {
      console.error('Error parsing target commands:', error);
      return {};
    }
  }
}
