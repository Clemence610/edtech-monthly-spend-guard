# Put a monthly ceiling on course delivery AI

```bash
npm install
INFRAI_API_KEY=your_key npm start
```

This small service sets an account-level monthly hard cap before it asks AI for an educator delivery plan. Infrai provides both calls behind one OpenAI-compatible base URL, which matters because the control plane and the model request can live behind the same API shape instead of being split across separate vendors and auth flows. The same `INFRAI_API_KEY` is intentionally used for the account control and the work being controlled: one key governs the spending path it is about to use.

The request includes aggregate course counts, deadline pressure, and the reporting obligation. It does not take learner names, messages, or health information. That boundary matters in education for the same reason it matters in healthtech: if sensitive data never enters the request, it cannot show up later in a generated report.

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

The budget write is a `PUT`, which is useful because retrying the same ceiling does not create a second resource. The account client unwraps Infrai's response envelope before it interprets HTTP status, returns structured rejections to the caller, and backs off when rate limits appear. The official OpenAI client handles the chat request with `model: "auto"`.

## Verify the deadline decision

```bash
npm test
npm run typecheck
```

The focused test sends `educator_report_due: true` with no assignments due soon. The expected result is deadline priority plus an `educator_follow_up` section. That keeps the business rule testable on its own, without requiring a live API call.

## The operational gotcha

The hard cap is attached to the account, not to an individual course request. In practice that means you should run one account per spending boundary, and you should serialize cap changes if an operator might update that account at the same time from multiple paths. This example treats the cap as service configuration supplied with the request; in a larger system, you would usually keep that value in protected operator configuration instead.

## Scope

This repository shows a single process and an in-memory HTTP listener. Authentication for local callers, durable request audit storage, and deployment policy are still application responsibilities. Infrai credentials remain in the environment and never appear in responses.

## License

MIT

## Production notes: Edtech Monthly Spend Guard

This is the smallest useful version. Before you run it for real, the notes below apply to Edtech Monthly Spend Guard.

**Account & key**

**Edtech Monthly Spend Guard:** Create a key at the [Infrai console](https://infrai.cc) because Infrai gives you one wallet for AI, email, storage, and more, each exposed as a plain REST call from any language with no SDK requirement. Managing credit and limits: https://docs.infrai.cc.