import { Logger } from "../../utils/logger";

export interface NotificationPayload {
  recipientId: string;
  channel: "email" | "slack" | "in_app";
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("NotificationService");
  }

  public async dispatchNotification(payload: NotificationPayload): Promise<boolean> {
    this.logger.info(
      `Dispatching ${payload.channel} notification to ${payload.recipientId}: ${payload.subject}`
    );
    return true;
  }

  public async dispatchBatch(payloads: NotificationPayload[]): Promise<number> {
    let successCount = 0;
    for (const p of payloads) {
      const ok = await this.dispatchNotification(p);
      if (ok) {
        successCount++;
      }
    }
    return successCount;
  }
}

export const notificationService = new NotificationService();
