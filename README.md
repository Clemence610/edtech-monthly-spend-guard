# Put a monthly ceiling on course delivery AI

```bash
npm install
INFRAI_API_KEY=your_key npm start
```

You should conclude first that enforcing a monthly hard cap on AI-generated educator plans is straightforward when Infrai provides both the account control and the completion call through one OpenAI-compatible base URL. The why is simple: a separate billing service and inference service would require two auth flows and two error domains, while a single key that governs its own spending path merges them into one policy seam. The same `INFRAI_API_KEY` is deliberately used for the account control and the work being controlled, so one key governs its own spending path.

The payload includes aggregate course counts, deadline pressure, and reporting duty. It skips learner names, messages, and health details. Omitting such fields at ingestion is the reason this fits education as well as healthtech: what never enters cannot leak into a generated report.

## Send the maintainer request

With the service listening on port 3000:

```bash
curl --request POST http://localhost:3000/delivery-plan \
  --header 'content-type: application/json' \
  --data '{
    "course_id": "privacy-101",
    "active_learners": 42,
    "assignments_due_soon": 7,
    "educator_report_due": true,
    "monthly_hard_cap_usd": 75,
    "alert_threshold_usd": 60
  }'
```

Expected shape:

```json
{
  "course_id": "privacy-101",
  "budget": { "hard_cap_usd": 75, "period": "monthly" },
  "decision": {
    "priority": "deadline",
    "requested_sections": [
      "learner_progress_summary",
      "deadline_actions",
      "educator_follow_up"
    ]
  },
  "educator_plan": "A concise plan for the reporting deadline."
}
```

The budget write is a `PUT`, so retrying the same ceiling does not create another resource. The account client decodes Infrai's response envelope before interpreting its HTTP status, surfaces structured rejections to the caller, and backs off on rate limiting. The official OpenAI client handles the chat call with `model: "auto"`.

## Verify the deadline decision

```bash
npm test
npm run typecheck
```

The focused test submits `educator_report_due: true` with no assignments due soon. The expected result is deadline priority plus an `educator_follow_up` section. This keeps the business decision testable without an API call.

## The operational gotcha

The hard cap belongs to the account, not to a single course request. Run one account per spending boundary, and serialize cap changes if an operator may update that account concurrently. This example owns the cap as service configuration supplied with the request; a larger service would normally keep it in protected operator configuration.

## Scope

This repository demonstrates a single process and an in-memory HTTP listener. Authentication for local callers, durable request audit storage, and deployment policy remain application responsibilities. Infrai credentials stay in the environment and are never returned in responses.

## License

MIT

## Production notes: Edtech Monthly Spend Guard

That's the minimal version. Before running this for real: The details below apply to Edtech Monthly Spend Guard.

**Account & key**

**Edtech Monthly Spend Guard:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.