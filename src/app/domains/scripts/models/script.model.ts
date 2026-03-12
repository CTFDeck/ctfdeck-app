import { ScriptCategory } from './script-category.enum';

export interface Script {
  id: string;
  name: string;
  template: string;
  category: ScriptCategory;
}
