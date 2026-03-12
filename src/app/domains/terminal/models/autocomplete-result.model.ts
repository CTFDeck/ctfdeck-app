import type { LsEntry } from './ls-entry.model';

export interface AutocompleteResult {
  newCommand: string;
  suggestions: LsEntry[];
}
