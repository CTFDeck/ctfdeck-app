import { MessageType } from '../../../infrastructure/transport/websocket/websocket-message-type.enum';
import { ToolInstallState } from './tool-install-state.enum';

export interface ToolInstallProgress {
  type: MessageType.ToolInstallProgress;
  messageId: string;
  toolId: string;
  state: ToolInstallState;
  message: string | null;
  progressPercent: number | null;
  installedPath: string | null;
  error: string | null;
}
