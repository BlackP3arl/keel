"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/labels";
import type { Developer } from "@/lib/types";

const NONE = "__none__";
const UNASSIGNED = "__unassigned__";

export function LabeledSelect({
  label,
  value,
  onValueChange,
  options,
  testId,
  full = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  testId?: string;
  full?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Select
        value={value}
        items={options}
        onValueChange={(next) => {
          if (next) onValueChange(next);
        }}
      >
        <SelectTrigger className={full ? "w-full" : "w-full sm:w-auto sm:min-w-48"} data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SearchField({
  value,
  onValueChange,
  placeholder,
  testId,
  label = "Search",
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  testId?: string;
  label?: string;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        data-testid={testId}
        className="w-full sm:w-56"
      />
    </div>
  );
}

export function PersonSelect({
  label,
  value,
  onValueChange,
  developers,
  testId,
  allowAll = false,
  allLabel = "Everyone",
  full = true,
}: {
  label: string;
  value: string;
  onValueChange: (developerId: string) => void;
  developers: Developer[];
  testId?: string;
  allowAll?: boolean;
  allLabel?: string;
  full?: boolean;
}) {
  const known = value === "all" || developers.some((person) => person.id === value);
  const items = [
    ...(allowAll ? [{ value: "all", label: allLabel }] : []),
    ...(!known ? [{ value: UNASSIGNED, label: "Unassigned" }] : []),
    ...developers.map((person) => ({ value: person.id, label: person.name })),
  ];
  const selected = developers.find((person) => person.id === value);

  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Select
        value={known ? value : UNASSIGNED}
        items={items}
        onValueChange={(next) => {
          if (!next) return;
          onValueChange(next === UNASSIGNED ? "" : next);
        }}
      >
        <SelectTrigger className={full ? "w-full" : "w-full sm:w-56"} data-testid={testId}>
          <SelectValue placeholder="Choose a person" />
        </SelectTrigger>
        <SelectContent>
          {allowAll ? <SelectItem value="all">{allLabel}</SelectItem> : null}
          {!known ? <SelectItem value={UNASSIGNED}>Unassigned</SelectItem> : null}
          {DEPARTMENTS.map((department) => {
            const people = developers.filter((person) => person.department === department);
            if (people.length === 0) return null;
            return (
              <SelectGroup key={department}>
                <SelectLabel>{department}</SelectLabel>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    <span className="font-medium">{person.name}</span>
                    <span className="text-muted-foreground">{person.department}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
      {selected ? (
        <p className="text-xs text-muted-foreground">
          {selected.department} · {selected.role}
          {selected.email ? <span className="block">{selected.email}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function AssigneeSearch({
  value,
  onValueChange,
  developers,
}: {
  value: string;
  onValueChange: (developerId: string) => void;
  developers: Developer[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = developers.find((person) => person.id === value);
  const needle = query.trim().toLowerCase();
  const matches = developers.filter((person) => person.name.toLowerCase().includes(needle));

  function choose(developerId: string) {
    onValueChange(developerId);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="grid gap-1.5" data-field="assignee">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Assignee</span>
      <Input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="assignee-results"
        placeholder="Search by name"
        data-testid="task-assignee"
        value={open ? query : (selected?.name ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            const first = matches[0];
            if (first) choose(first.id);
          }
        }}
      />
      {open ? (
        <ul
          id="assignee-results"
          role="listbox"
          data-testid="assignee-results"
          className="max-h-48 overflow-y-auto rounded-lg border border-border bg-popover"
        >
          {matches.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">No one on the roster matches.</li>
          ) : (
            matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={person.id === value}
                  data-testid="assignee-option"
                  data-person-id={person.id}
                  className="flex w-full flex-col items-start px-2.5 py-1.5 text-left hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(person.id)}
                >
                  <span className="text-sm font-medium">{person.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {person.department} · {person.role}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {selected && !open ? (
        <p className="text-xs text-muted-foreground">
          {selected.department} · {selected.role}
          {selected.email ? <span className="block">{selected.email}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function PredecessorSelect({
  label,
  value,
  onValueChange,
  options,
  hint,
  testId,
}: {
  label: string;
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  hint?: string;
  testId?: string;
}) {
  const items = [{ value: NONE, label: "No predecessor" }, ...options];
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Select
        value={value ?? NONE}
        items={items}
        onValueChange={(next) => {
          if (!next) return;
          onValueChange(next === NONE ? null : next);
        }}
      >
        <SelectTrigger className="w-full" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
