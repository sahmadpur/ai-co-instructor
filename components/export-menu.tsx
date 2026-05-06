"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FORMATS: { format: "excel" | "csv" | "html" | "pdf"; label: string; ext: string }[] = [
  { format: "excel", label: "Excel", ext: ".xlsx" },
  { format: "csv", label: "CSV", ext: ".csv" },
  { format: "html", label: "HTML", ext: "page" },
  { format: "pdf", label: "PDF", ext: "print" },
];

export function ExportMenu({ runId }: { runId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em]"
          />
        }
      >
        export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {FORMATS.map(({ format, label, ext }) => {
          const newTab = format === "pdf" || format === "html";
          return (
            <DropdownMenuItem
              key={format}
              render={
                <a
                  href={`/api/export/${runId}/${format}`}
                  target={newTab ? "_blank" : undefined}
                  rel={newTab ? "noopener" : undefined}
                />
              }
              className="flex items-baseline justify-between gap-3"
            >
              <span className="font-display text-base">{label}</span>
              <span className="font-mono-num text-[0.65rem] uppercase tracking-widest text-foreground/55">
                {ext}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
