"use client";

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
  const items = [
    ...(allowAll ? [{ value: "all", label: allLabel }] : []),
    ...developers.map((person) => ({ value: person.id, label: person.name })),
  ];
  const selected = developers.find((person) => person.id === value);

  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Select
        value={value}
        items={items}
        onValueChange={(next) => {
          if (next) onValueChange(next);
        }}
      >
        <SelectTrigger className={full ? "w-full" : "w-full sm:w-56"} data-testid={testId}>
          <SelectValue placeholder="Choose a person" />
        </SelectTrigger>
        <SelectContent>
          {allowAll ? <SelectItem value="all">{allLabel}</SelectItem> : null}
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
          <span className="block">{selected.email}</span>
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
