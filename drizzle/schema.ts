import { integer, pgEnum, pgTable, text, timestamp, varchar, decimal, json, boolean, date, serial } from "drizzle-orm/pg-core";

// Enums for PostgreSQL
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["free", "pro", "canceled", "past_due"]);
export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);
export const conversionStatusEnum = pgEnum("conversion_status", ["pending", "processing", "review", "completed", "failed"]);
export const templateCategoryEnum = pgEnum("template_category", ["finance", "inventory", "hr", "general"]);

// Users table with subscription and usage tracking
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),

  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("free").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),

  // Usage tracking
  conversionsToday: integer("conversions_today").default(0).notNull(),
  conversionsThisMonth: integer("conversions_this_month").default(0).notNull(),
  totalConversions: integer("total_conversions").default(0).notNull(),
  lastConversionAt: timestamp("last_conversion_at"),
  lastUsageResetDate: date("last_usage_reset_date"),

  // Preferences
  preferredTemplate: varchar("preferred_template", { length: 64 }).default("general"),
  theme: themeEnum("theme").default("system"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Conversions table for tracking PDF conversions
export const conversions = pgTable("conversions", {
  id: serial("id").primaryKey(),

  // User reference (nullable for anonymous users)
  userId: integer("user_id").references(() => users.id),
  anonymousId: varchar("anonymous_id", { length: 64 }),
  ipAddress: varchar("ip_address", { length: 45 }),

  // File info
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  pageCount: integer("page_count"),

  // Processing status
  status: conversionStatusEnum("status").default("pending").notNull(),

  // Results
  extractedTables: json("extracted_tables"),
  tableCount: integer("table_count"),
  rowCount: integer("row_count"),
  processingTimeMs: integer("processing_time_ms"),

  // AI Analysis
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 3, scale: 2 }),
  aiWarnings: json("ai_warnings"),
  detectedIssues: json("detected_issues"),

  // Error handling
  errorCode: varchar("error_code", { length: 64 }),
  errorMessage: text("error_message"),
  errorDetails: json("error_details"),

  // Storage paths
  pdfStoragePath: text("pdf_storage_path"),
  xlsxStoragePath: text("xlsx_storage_path"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export type Conversion = typeof conversions.$inferSelect;
export type InsertConversion = typeof conversions.$inferInsert;

// Anonymous usage tracking for IP-based rate limiting
export const anonymousUsage = pgTable("anonymous_usage", {
  id: serial("id").primaryKey(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  usageDate: date("usage_date").notNull(),
  conversionCount: integer("conversion_count").default(1).notNull(),
});

export type AnonymousUsage = typeof anonymousUsage.$inferSelect;
export type InsertAnonymousUsage = typeof anonymousUsage.$inferInsert;

// Templates table for predefined table formats
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  category: templateCategoryEnum("category"),

  // Template data
  columnDefinitions: json("column_definitions").notNull(),
  sampleData: json("sample_data"),
  formatting: json("formatting"),

  // Metadata
  icon: varchar("icon", { length: 64 }),
  color: varchar("color", { length: 20 }),
  isPremium: boolean("is_premium").default(false),
  usageCount: integer("usage_count").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;
