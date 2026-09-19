export type CourseDelivery = {
  course_id: string;
  active_learners: number;
  assignments_due_soon: number;
  educator_report_due: boolean;
};

export type DeliveryDecision = {
  priority: "routine" | "deadline";
  requested_sections: string[];
};

export function decideDelivery(input: CourseDelivery): DeliveryDecision {
  const deadlinePressure =
    input.assignments_due_soon > 0 || input.educator_report_due;

  return {
    priority: deadlinePressure ? "deadline" : "routine",
    requested_sections: input.educator_report_due
      ? ["learner_progress_summary", "deadline_actions", "educator_follow_up"]
      : ["learner_progress_summary", "deadline_actions"],
  };
}
