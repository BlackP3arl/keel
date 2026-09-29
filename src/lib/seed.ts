import type {
  Department,
  DeskState,
  Developer,
  Priority,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
} from "@/lib/types";

function person(
  id: string,
  name: string,
  role: string,
  department: Department,
  email: string,
): Developer {
  return { id, name, role, department, email };
}

/** IT staff list. Ids are stable and are not the email addresses. */
const ahmedSalam = person("ahmed-salam", "Ahmed Salam", "CTO", "IT", "");

const developers: Developer[] = [
  person("sham", "Sham Rahseed", "Information Security Officer", "Cloud & Security", "sham.rasheed@pension.gov.mv"),
  person("thoaha", "Thoaha Hassan", "Security Engineer", "Cloud & Security", "thoaha.hassan@pension.gov.mv"),
  person("liyaaz", "Liyaaz Yoosuf", "Graduate Trainee (GCP)", "Cloud & Security", "liyaaz.yoosuf@pension.gov.mv"),
  person("ali-zahir", "Ali Zahir", "Manager, Cloud and Security", "Cloud & Security", "ali.zahir@pension.gov.mv"),
  person("ulya", "Aishath Ulya Azim", "Data Engineer", "Data Services", "ulya.azim@pension.gov.mv"),
  person("areef", "Ahmed Areef", "DBA", "Data Services", "ahmed.areef@pension.gov.mv"),
  person("shahuza", "Shahuza Abdul Kareem", "Machine Learning Engineer", "Data Services", "shahuza.abdulkareem@pension.gov.mv"),
  person("dhunya", "Dhunya Abdul Hadhy", "Manager, Data Services", "Data Services", "dhunya.abdul@pension.gov.mv"),
  person("basil", "Hassan Basil Shafeeq", "Data Engineer", "Data Services", "basil.shafeeq@pension.gov.mv"),
  person("naif", "Hassan Naif Mohamed", "Lead Software Engineer", "Software Engineering", "naif.mohamed@pension.gov.mv"),
  person("nazeem", "Ahmed Nazeem", "Lead UI/UX Engineer", "Software Engineering", "ahmed.nazeem@pension.gov.mv"),
  person("nashath", "Mohamed Nashath", "Lead Software Engineer", "Software Engineering", "nashath.ahmed@pension.gov.mv"),
  person("maadh", "Maadh Ali Zameer", "Senior Software Engineer", "Software Engineering", "maadh.zameer@pension.gov.mv"),
  person("suhail", "Aboobakuru Suhail", "Software Engineer", "Software Engineering", "aboobakuru.suhail@pension.gov.mv"),
  person("shifan", "Mohamed Shifan", "Manager, Software Engineering", "Software Engineering", "mohamed.shifan@pension.gov.mv"),
  person("niyaaz", "Mohamed Niyaaz", "Lead Software Engineer", "Software Engineering", "mohamed.niyaaz@pension.gov.mv"),
  person("midhath", "Mohamed Midhath Ahmed", "Software Engineer", "Software Engineering", "mohamed.midhath@pension.gov.mv"),
  person("adam", "Adam Waheed", "Lead Software Engineer", "Software Engineering", "adam.waheed@pension.gov.mv"),
  person("mahmood", "Mahmood Waheed", "IT Director", "IT", "mahmood.waheed@pension.gov.mv"),
  ahmedSalam,
];

/** Desks saved before Ahmed Salam was on the roster still load, and gain him. */
export function ensureSeededRoster(current: Developer[]): Developer[] {
  const present = current.some(
    (person) => person.id === ahmedSalam.id || person.name.trim() === ahmedSalam.name,
  );
  if (present) return current;
  return [...current, { ...ahmedSalam }];
}

function project(
  id: string,
  name: string,
  summary: string,
  status: ProjectStatus,
  start: string,
  due: string,
  ownerId: string,
  predecessorProjectId: string | null = null,
): Project {
  return { id, name, summary, status, start, due, ownerId, predecessorProjectId };
}

function task(
  id: string,
  projectId: string,
  title: string,
  assigneeId: string,
  status: TaskStatus,
  priority: Priority,
  start: string,
  due: string,
  predecessorTaskId: string | null = null,
): Task {
  return { id, projectId, title, assigneeId, status, priority, start, due, predecessorTaskId };
}

const projects: Project[] = [
  project(
    "member",
    "Member Portal",
    "Rebuild the member portal: account home, contribution history, and benefit status.",
    "active",
    "2026-08-03",
    "2026-11-14",
    "shifan",
  ),
  project(
    "contributions",
    "Contribution Reconciliation",
    "Match employer contribution files to member accounts and clear exceptions before month-end close.",
    "active",
    "2026-07-06",
    "2026-09-18",
    "dhunya",
  ),
  project(
    "atlas",
    "Atlas Component Library",
    "Shared UI kit for internal tools: tokens, form controls, and an accessible Storybook.",
    "active",
    "2026-09-07",
    "2026-12-11",
    "nazeem",
  ),
  project(
    "field",
    "Field Visit App",
    "Offline visit sheets for employer inspections. Held until Atlas covers the form patterns the field team needs.",
    "on_hold",
    "2026-06-15",
    "2026-10-30",
    "midhath",
    "atlas",
  ),
  project(
    "observe",
    "Platform Observability",
    "Tracing, deploy markers, and one on-call board for the platform group.",
    "done",
    "2026-03-02",
    "2026-08-21",
    "ali-zahir",
  ),
  project(
    "payments",
    "Benefit Payments API",
    "Replace the legacy payment endpoints for benefit runs, then cut over the disbursement jobs.",
    "active",
    "2026-08-10",
    "2026-10-16",
    "naif",
    "observe",
  ),
];

const tasks: Task[] = [
  task("mb-ia", "member", "Map the current portal information architecture", "nazeem", "done", "high", "2026-08-03", "2026-08-14"),
  task("mb-home", "member", "Ship the account home layout", "nazeem", "done", "high", "2026-08-17", "2026-09-04", "mb-ia"),
  task("mb-history", "member", "Contribution history API", "naif", "done", "high", "2026-08-10", "2026-08-28"),
  task("mb-status", "member", "Benefit status feed", "nashath", "done", "high", "2026-08-31", "2026-09-18", "mb-history"),
  task("mb-auth", "member", "Session handoff from the legacy login", "naif", "in_progress", "high", "2026-09-08", "2026-10-02", "mb-home"),
  task("mb-qa", "member", "QA account and contribution flows", "shifan", "todo", "medium", "2026-10-05", "2026-10-16", "mb-auth"),
  task("mb-timeline", "member", "Benefit status timeline UI", "nazeem", "todo", "medium", "2026-09-21", "2026-10-23", "mb-status"),
  task("mb-empty", "member", "Empty and error states for account home", "suhail", "todo", "medium", "2026-09-28", "2026-10-20", "mb-home"),
  task("mb-access", "member", "Review portal session and account access", "sham", "in_progress", "high", "2026-09-14", "2026-10-06", "mb-auth"),
  task("mb-launch", "member", "Launch checklist with support", "adam", "backlog", "low", "2026-10-19", "2026-11-06", "mb-qa"),

  task("cr-ingest", "contributions", "Ingest employer contribution files", "basil", "done", "high", "2026-07-06", "2026-07-24"),
  task("cr-rules", "contributions", "Matching rules for wage adjustments", "ulya", "done", "high", "2026-07-20", "2026-08-14", "cr-ingest"),
  task("cr-queue", "contributions", "Exception queue for contribution ops", "areef", "in_progress", "high", "2026-08-17", "2026-09-11", "cr-rules"),
  task("cr-export", "contributions", "Dispute packet export", "shahuza", "todo", "medium", "2026-09-01", "2026-09-16", "cr-queue"),
  task("cr-qa", "contributions", "QA on partial-match cases", "naif", "in_review", "high", "2026-09-08", "2026-09-20", "cr-queue"),
  task("cr-close", "contributions", "Month-end close notes", "dhunya", "backlog", "low", "2026-09-14", "2026-09-18", "cr-qa"),
  task("cr-arrears", "contributions", "Fix repost failures on arrears", "ulya", "todo", "high", "2026-09-02", "2026-09-15", "cr-rules"),
  task("cr-roles", "contributions", "Lock down the exception queue roles", "sham", "todo", "high", "2026-09-01", "2026-09-12", "cr-queue"),

  task("at-tokens", "atlas", "Audit color and type tokens", "nazeem", "done", "medium", "2026-09-07", "2026-09-18"),
  task("at-controls", "atlas", "Button, input, and badge specs", "nazeem", "in_progress", "high", "2026-09-21", "2026-10-09", "at-tokens"),
  task("at-story", "atlas", "Storybook publish pipeline", "liyaaz", "todo", "medium", "2026-09-14", "2026-10-02"),
  task("at-forms", "atlas", "Form layout patterns", "nazeem", "backlog", "medium", "2026-10-12", "2026-11-06", "at-controls"),
  task("at-a11y", "atlas", "Accessibility review", "nashath", "backlog", "high", "2026-11-09", "2026-11-27", "at-forms"),

  task("fv-offline", "field", "Offline queue design", "midhath", "done", "high", "2026-06-15", "2026-07-03"),
  task("fv-sheets", "field", "Visit sheet screens", "midhath", "in_progress", "high", "2026-07-06", "2026-10-09", "fv-offline"),
  task("fv-photo", "field", "Photo capture and sync", "midhath", "todo", "medium", "2026-08-17", "2026-10-23", "fv-sheets"),
  task("fv-sync", "field", "Sync conflict review", "midhath", "in_progress", "medium", "2026-09-01", "2026-10-02", "fv-sheets"),
  task("fv-qa", "field", "Device QA matrix", "niyaaz", "backlog", "medium", "2026-09-21", "2026-10-16", "fv-photo"),

  task("ob-collector", "observe", "Collector sidecar for API services", "thoaha", "done", "high", "2026-03-02", "2026-04-10"),
  task("ob-sample", "observe", "Sampling rules by route", "liyaaz", "done", "medium", "2026-04-13", "2026-05-15", "ob-collector"),
  task("ob-board", "observe", "On-call dashboard", "naif", "done", "high", "2026-05-18", "2026-07-02", "ob-sample"),
  task("ob-slack", "observe", "Slack alert routing", "sham", "done", "medium", "2026-06-01", "2026-07-17", "ob-sample"),
  task("ob-runbook", "observe", "Runbook and handoff", "ali-zahir", "done", "low", "2026-07-20", "2026-08-14", "ob-board"),

  task("bp-map", "payments", "Map legacy payment tables", "areef", "done", "high", "2026-08-10", "2026-08-28"),
  task("bp-snapshot", "payments", "Payment snapshot endpoint", "naif", "in_progress", "high", "2026-08-31", "2026-09-25", "bp-map"),
  task("bp-status", "payments", "Benefit run status endpoint", "nashath", "in_progress", "high", "2026-09-07", "2026-10-02", "bp-map"),
  task("bp-tests", "payments", "Contract tests with the finance team", "maadh", "todo", "medium", "2026-09-28", "2026-10-09", "bp-snapshot"),
  task("bp-cut", "payments", "Cutover and rollback plan", "thoaha", "backlog", "high", "2026-10-05", "2026-10-16", "bp-status"),
  task("bp-ledger", "payments", "Reconcile paid amounts with the ledger", "basil", "todo", "medium", "2026-09-21", "2026-10-08", "bp-map"),
  task("bp-dict", "payments", "Publish the payment data dictionary", "ulya", "in_review", "medium", "2026-09-14", "2026-10-12", "bp-map"),
  task("bp-anomaly", "payments", "Draft an anomaly check for the cutover", "shahuza", "backlog", "medium", "2026-10-01", "2026-10-16", "bp-status"),
  task("bp-sponsor", "payments", "Sponsor check before the payment cutover", "mahmood", "todo", "high", "2026-09-28", "2026-10-10", "bp-cut"),
];

export function seedData(): DeskState {
  return {
    developers: developers.map((item) => ({ ...item })),
    projects: projects.map((item) => ({ ...item })),
    tasks: tasks.map((item) => ({ ...item })),
    comments: [],
  };
}
