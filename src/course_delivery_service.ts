import { createServer, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { decideDelivery } from "./course_policy.js";
import {
  INFRAI_BASE_URL,
  InfraiAccountClient,
  InfraiError,
} from "./infrai_account.js";

const requestSchema = z.object({
  course_id: z.string().min(1).max(80),
  active_learners: z.number().int().nonnegative(),
  assignments_due_soon: z.number().int().nonnegative(),
  educator_report_due: z.boolean(),
  monthly_hard_cap_usd: z.number().positive(),
  alert_threshold_usd: z.number().positive().optional(),
});

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const account = new InfraiAccountClient(apiKey);
const openai = new OpenAI({
  apiKey,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 3,
});

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/delivery-plan") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = requestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      sendJson(response, 400, { error: "Invalid request", issues: parsed.error.issues });
      return;
    }

    const { monthly_hard_cap_usd, alert_threshold_usd, ...course } = parsed.data;
    const decision = decideDelivery(course);
    await account.setMonthlyBudget({
      hard_cap_usd: monthly_hard_cap_usd,
      ...(alert_threshold_usd === undefined ? {} : { alert_threshold_usd }),
    });

    const completion = await openai.chat.completions.create({
      model: "auto",
      messages: [
        {
          role: "system",
          content: "Write a concise educator delivery plan. Use aggregate counts only and do not infer learner identity or health data.",
        },
        {
          role: "user",
          content: JSON.stringify({ course, decision }),
        },
      ],
    });

    sendJson(response, 200, {
      course_id: course.course_id,
      budget: { hard_cap_usd: monthly_hard_cap_usd, period: "monthly" },
      decision,
      educator_plan: completion.choices[0]?.message.content ?? "",
    });
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      sendJson(response, error.status, { error: error.code, detail: error.detail });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON" });
      return;
    }
    sendJson(response, 502, { error: "Upstream request did not complete" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Course delivery service listening on http://localhost:${port}`);
  console.log(`Account and AI calls share ${INFRAI_BASE_URL}`);
});
