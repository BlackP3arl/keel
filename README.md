# Keel

Delivery desk for the project manager who runs the IT roster. It covers projects, a kanban, a timeline with dependencies, a task list, and workload for all 20 people.

One person updates everything. There is no login and no server database. Edits stay in this browser.

## Run locally

```bash
npm install
npm run dev -- --port 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

The dev server listens on `0.0.0.0`. A first visit, with nothing saved in this browser, loads the 20-person IT roster (including Ahmed Salam, CTO) and starts with no projects and no tasks. A desk already saved under `keel.desk.v2` is left as it is.

## Roster

People come from the IT staff list. Each record has a stable id, name, designation, department, and email. Departments are Software Engineering, Data Services, Cloud & Security, and IT.

Project owners and task assignees are chosen from that full list, by name, with department shown so teams are easy to tell apart. Assignments store the person id, not the email, so a later Google sign-in can match the address without moving work. Sign-in is not built.

## Status

Keel does not ask you to type "on track."

- **On hold** when the project is on hold. A past due date does not call it late.
- **Done** when the project is marked done, or every task is done. Progress shows 100% when there are tasks.
- **Off track** when the due date is before today, or the share of tasks finished is more than 20 points behind the share of time between start and due.
- **On track** otherwise.

Progress is done tasks divided by all tasks, or 0 when a project has none. A task that is not done and whose due date is before today is overdue.

Workload treats open work as anything not done. Comfortable is two or fewer open tasks and nothing overdue. Busy is three or four open, or one overdue. Overloaded is five or more open, or two or more overdue.
