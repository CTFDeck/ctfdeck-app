import { TargetType } from './target-type.enum';

export interface SessionTarget {
  id: string;
  address: string;
  port: number | null;
  name: string;
  description: string;
  type: TargetType;
}
