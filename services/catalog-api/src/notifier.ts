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

export interface PagerDutyMonitoringNotifierOptions {
  routingKey: string;
  source?: string;
  eventsUrl?: string;
  timeoutMs?: number;
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

/** Delivers monitoring transitions to PagerDuty Events API v2. */
export class PagerDutyMonitoringNotifier implements MonitoringNotifier {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly source: string;
  private readonly eventsUrl: string;

  constructor(private readonly options: PagerDutyMonitoringNotifierOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.source = options.source ?? "catalog.arka.fund";
    this.eventsUrl = options.eventsUrl ?? "https://events.eu.pagerduty.com/v2/enqueue";
  }

  async notify(event: MonitoringNotificationEvent): Promise<void> {
    for (const transition of event.transitions) {
      const response = await this.fetchImpl(this.eventsUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routing_key: this.options.routingKey,
          event_action: transition.action === "triggered" ? "trigger" : "resolve",
          dedup_key: pagerDutyDedupKey(transition.kind),
          payload: {
            summary: `Arka catalog ${transition.action}: ${transition.alert.message}`,
            source: this.source,
            severity: pagerDutySeverity(transition.alert.severity),
            timestamp: event.sentAt,
            component: "catalog-api",
            group: "arka-fund-production",
            class: transition.kind,
            custom_details: {
              event_id: event.eventId,
              alert: transition.alert,
              monitoring_status: event.status,
            },
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(
          `PagerDuty event delivery failed with status ${response.status}`,
        );
      }
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

export function pagerDutyDedupKey(kind: AlertTransition["kind"]): string {
  return `arka-catalog:${kind}`;
}

function pagerDutySeverity(
  severity: MonitoringNotificationEvent["status"]["activeAlerts"][number]["severity"],
): "warning" | "critical" {
  return severity === "critical" ? "critical" : "warning";
}
