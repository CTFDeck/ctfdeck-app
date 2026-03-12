import { ScriptCategory } from '../../scripts/models/script-category.enum';

export interface ScriptForm {
  name: string;
  category: ScriptCategory;
  template: string;
}
