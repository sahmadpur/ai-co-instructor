"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FORMATS: { format: "excel" | "csv" | "html" | "pdf"; label: string }[] = [
  { format: "excel", label: "Excel (.xlsx)" },
  { format: "csv", label: "CSV" },
  { format: "html", label: "HTML" },
  { format: "pdf", label: "PDF (print)" },
];

export function ExportMenu({ runId }: { runId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map(({ format, label }) => {
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
            >
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
