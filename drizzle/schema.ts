import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean, date } from "drizzle-orm/mysql-core";

// Users table with subscription and usage tracking
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: text("name"),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // Stripe subscription fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["free", "pro", "canceled", "past_due"]).default("free").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  
  // Usage tracking
  conversionsToday: int("conversionsToday").default(0).notNull(),
  conversionsThisMonth: int("conversionsThisMonth").default(0).notNull(),
  totalConversions: int("totalConversions").default(0).notNull(),
  lastConversionAt: timestamp("lastConversionAt"),
  lastUsageResetDate: date("lastUsageResetDate"),
  
  // Preferences
  preferredTemplate: varchar("preferredTemplate", { length: 64 }).default("general"),
  theme: mysqlEnum("theme", ["light", "dark", "system"]).default("system"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Conversions table for tracking PDF conversions
export const conversions = mysqlTable("conversions", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference (nullable for anonymous users)
  userId: int("userId").references(() => users.id),
  anonymousId: varchar("anonymousId", { length: 64 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  // File info
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  fileSizeBytes: int("fileSizeBytes").notNull(),
  fileHash: varchar("fileHash", { length: 64 }),
  pageCount: int("pageCount"),
  
  // Processing status
  status: mysqlEnum("status", ["pending", "processing", "review", "completed", "failed"]).default("pending").notNull(),
  
  // Results
  extractedTables: json("extractedTables"),
  tableCount: int("tableCount"),
  rowCount: int("rowCount"),
  processingTimeMs: int("processingTimeMs"),
  
  // AI Analysis
  aiConfidenceScore: decimal("aiConfidenceScore", { precision: 3, scale: 2 }),
  aiWarnings: json("aiWarnings"),
  detectedIssues: json("detectedIssues"),
  
  // Error handling
  errorCode: varchar("errorCode", { length: 64 }),
  errorMessage: text("errorMessage"),
  errorDetails: json("errorDetails"),
  
  // Storage paths
  pdfStoragePath: text("pdfStoragePath"),
  xlsxStoragePath: text("xlsxStoragePath"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type Conversion = typeof conversions.$inferSelect;
export type InsertConversion = typeof conversions.$inferInsert;

// Anonymous usage tracking for IP-based rate limiting
export const anonymousUsage = mysqlTable("anonymous_usage", {
  id: int("id").autoincrement().primaryKey(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  usageDate: date("usageDate").notNull(),
  conversionCount: int("conversionCount").default(1).notNull(),
});

export type AnonymousUsage = typeof anonymousUsage.$inferSelect;
export type InsertAnonymousUsage = typeof anonymousUsage.$inferInsert;

// Templates table for predefined table formats
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  category: mysqlEnum("category", ["finance", "inventory", "hr", "general"]),
  
  // Template data
  columnDefinitions: json("columnDefinitions").notNull(),
  sampleData: json("sampleData"),
  formatting: json("formatting"),
  
  // Metadata
  icon: varchar("icon", { length: 64 }),
  color: varchar("color", { length: 20 }),
  isPremium: boolean("isPremium").default(false),
  usageCount: int("usageCount").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;
