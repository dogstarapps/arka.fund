import { createHmac, randomUUID } from "node:crypto";
import type {
  AlertTransition,
  MonitoringNotificationEvent,
  MonitoringStatus,
} from "./types.js";

export interface MonitoringNotifier {
  notify(event: MonitoringNotificationEvent): Promise<void>;
}

export interface WebhookMonitoringNotifierOptions {
  url: string;
  secret: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export class CompositeMonitoringNotifier implements MonitoringNotifier {
  constructor(private readonly notifiers: MonitoringNotifier[]) {}

  async notify(event: MonitoringNotificationEvent): Promise<void> {
    for (const notifier of this.notifiers) {
      await notifier.notify(event);
    }
  }
}

export class NoopMonitoringNotifier implements MonitoringNotifier {
  async notify(_event: MonitoringNotificationEvent): Promise<void> {}
}

export class WebhookMonitoringNotifier implements MonitoringNotifier {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: WebhookMonitoringNotifierOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async notify(event: MonitoringNotificationEvent): Promise<void> {
    const body = JSON.stringify(event);
    const response = await this.fetchImpl(this.options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-arkafund-event-id": event.eventId,
        "x-arkafund-signature": signPayload(this.options.secret, body),
        ...this.options.headers,
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Monitoring webhook delivery failed with status ${response.status}`,
      );
    }
  }
}

export function buildMonitoringNotificationEvent(
  transitions: AlertTransition[],
  status: MonitoringStatus,
  sentAt = new Date().toISOString(),
): MonitoringNotificationEvent {
  return {
    eventId: randomUUID(),
    sentAt,
    transitions: transitions.map((transition) => ({
      ...transition,
      alert: { ...transition.alert },
    })),
    status: {
      ...status,
      activeAlerts: status.activeAlerts.map((alert) => ({ ...alert })),
      thresholds: { ...status.thresholds },
    },
  };
}

export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
