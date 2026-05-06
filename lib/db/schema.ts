import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  courseId: text("course_id").notNull(),
  courseName: text("course_name").notNull(),
  assignmentId: text("assignment_id").notNull(),
  assignmentTitle: text("assignment_title").notNull(),
  taskDescription: text("task_description"),
  feedbackFocus: text("feedback_focus"),
  status: text("status", {
    enum: ["draft", "generating", "review", "confirmed"],
  }).notNull(),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
});

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  studentEmail: text("student_email"),
  submissionId: text("submission_id"),
  submissionType: text("submission_type", {
    enum: ["text", "gdoc", "pdf", "image", "mixed", "none"],
  }).notNull(),
  submissionPreview: text("submission_preview"),
  aiFeedback: text("ai_feedback"),
  editedFeedback: text("edited_feedback"),
  status: text("status", {
    enum: ["pending", "generating", "generated", "edited", "failed"],
  }).notNull(),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  errorMessage: text("error_message"),
  generatedAt: integer("generated_at", { mode: "timestamp" }),
});

export const apiLogs = sqliteTable("api_logs", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => runs.id),
  feedbackId: text("feedback_id").references(() => feedback.id),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type ApiLog = typeof apiLogs.$inferSelect;
