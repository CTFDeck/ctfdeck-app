import { TargetType } from '../../sessions/models/target-type.enum';

export interface AddTargetForm {
  name: string;
  address: string;
  port: number | undefined;
  description: string;
  type: TargetType;
  sessionIds: string[];
}

export interface EditTargetForm {
  id: string;
  name: string;
  address: string;
  port: number | undefined;
  description: string;
  type: TargetType;
  sessionId: string;
}
