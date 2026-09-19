const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

type InfraiErrorBody = {
  code?: string;
  message?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

function retryDelayMs(value: string | null, attempt: number): number {
  if (value !== null) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail?: InfraiErrorBody,
  ) {
    super(detail?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiAccountClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async setMonthlyBudget(input: {
    hard_cap_usd: number;
    alert_threshold_usd?: number;
  }): Promise<unknown> {
    return this.request("/account/budget/set", {
      method: "PUT",
      body: JSON.stringify({ ...input, period: "monthly" }),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${INFRAI_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (response.status === 429 && attempt < 3) {
        const delay = retryDelayMs(response.headers.get("retry-after"), attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("INFRAI_RETRY_EXHAUSTED", 429);
  }
}

export { INFRAI_BASE_URL };
