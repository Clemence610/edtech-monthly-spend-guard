import assert from "node:assert/strict";
import test from "node:test";
import { decideDelivery } from "../src/course_policy.js";

test("an educator report deadline expands the delivery plan", () => {
  const decision = decideDelivery({
    course_id: "privacy-101",
    active_learners: 42,
    assignments_due_soon: 0,
    educator_report_due: true,
  });

  assert.deepEqual(decision, {
    priority: "deadline",
    requested_sections: [
      "learner_progress_summary",
      "deadline_actions",
      "educator_follow_up",
    ],
  });
});
