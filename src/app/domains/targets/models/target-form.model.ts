import { TargetType } from '../../../core/services/session.protocol';

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
