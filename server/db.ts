import { eq, and, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, conversions, anonymousUsage, templates, InsertConversion, Conversion, Template } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// USER OPERATIONS
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSubscription(
  userId: number,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: 'free' | 'pro' | 'canceled' | 'past_due';
    currentPeriodEnd?: Date | null;
  }
) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// USAGE TRACKING
// ============================================

const FREE_DAILY_LIMIT = 3;

export async function checkUserUsageLimit(userId: number): Promise<{ allowed: boolean; remaining: number; message?: string }> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: FREE_DAILY_LIMIT };

  const user = await getUserById(userId);
  if (!user) return { allowed: false, remaining: 0, message: 'User not found' };

  // Pro users have unlimited conversions
  if (user.subscriptionStatus === 'pro') {
    return { allowed: true, remaining: -1 }; // -1 means unlimited
  }

  // Check if we need to reset daily count
  const today = new Date().toISOString().split('T')[0];
  const lastReset = user.lastUsageResetDate ? new Date(user.lastUsageResetDate).toISOString().split('T')[0] : null;

  if (lastReset !== today) {
    // Reset daily count
    await db.update(users).set({
      conversionsToday: 0,
      lastUsageResetDate: new Date(today),
    }).where(eq(users.id, userId));
    return { allowed: true, remaining: FREE_DAILY_LIMIT };
  }

  const remaining = FREE_DAILY_LIMIT - user.conversionsToday;
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message: `You've reached your daily limit of ${FREE_DAILY_LIMIT} free conversions. Upgrade to Pro for unlimited access.`,
    };
  }

  return { allowed: true, remaining };
}

export async function incrementUserUsage(userId: number) {
  const db = await getDb();
  if (!db) return;

  const today = new Date().toISOString().split('T')[0];

  await db.update(users).set({
    conversionsToday: sql`${users.conversionsToday} + 1`,
    conversionsThisMonth: sql`${users.conversionsThisMonth} + 1`,
    totalConversions: sql`${users.totalConversions} + 1`,
    lastConversionAt: new Date(),
    lastUsageResetDate: new Date(today),
  }).where(eq(users.id, userId));
}

export async function checkAnonymousUsageLimit(ipAddress: string): Promise<{ allowed: boolean; remaining: number; message?: string }> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: FREE_DAILY_LIMIT };

  const today = new Date().toISOString().split('T')[0];

  const result = await db.select()
    .from(anonymousUsage)
    .where(and(
      eq(anonymousUsage.ipAddress, ipAddress),
      eq(anonymousUsage.usageDate, new Date(today))
    ))
    .limit(1);

  if (result.length === 0) {
    return { allowed: true, remaining: FREE_DAILY_LIMIT };
  }

  const remaining = FREE_DAILY_LIMIT - result[0].conversionCount;
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message: `You've used all ${FREE_DAILY_LIMIT} free conversions for today. Sign up for more or come back tomorrow.`,
    };
  }

  return { allowed: true, remaining };
}

export async function incrementAnonymousUsage(ipAddress: string) {
  const db = await getDb();
  if (!db) return;

  const today = new Date().toISOString().split('T')[0];

  // Try to update existing record
  const result = await db.update(anonymousUsage)
    .set({ conversionCount: sql`${anonymousUsage.conversionCount} + 1` })
    .where(and(
      eq(anonymousUsage.ipAddress, ipAddress),
      eq(anonymousUsage.usageDate, new Date(today))
    ));

  // If no record was updated, insert a new one
  // @ts-ignore - checking affected rows
  if (!result[0]?.affectedRows) {
    await db.insert(anonymousUsage).values({
      ipAddress,
      usageDate: new Date(today),
      conversionCount: 1,
    });
  }
}

// ============================================
// CONVERSIONS
// ============================================

export async function createConversion(data: InsertConversion): Promise<Conversion | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(conversions).values({
    ...data,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // @ts-ignore
  const insertId = result[0]?.insertId;
  if (!insertId) return null;

  const [conversion] = await db.select().from(conversions).where(eq(conversions.id, insertId));
  return conversion || null;
}

export async function updateConversion(id: number, data: Partial<InsertConversion>) {
  const db = await getDb();
  if (!db) return;

  await db.update(conversions).set(data).where(eq(conversions.id, id));
}

export async function getConversionById(id: number): Promise<Conversion | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(conversions).where(eq(conversions.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserConversions(userId: number, limit: number = 20): Promise<Conversion[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(conversions)
    .where(eq(conversions.userId, userId))
    .orderBy(desc(conversions.createdAt))
    .limit(limit);
}

// ============================================
// TEMPLATES
// ============================================

export async function getAllTemplates(): Promise<Template[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(templates);
}

export async function getTemplateBySlug(slug: string): Promise<Template | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(templates).where(eq(templates.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function incrementTemplateUsage(slug: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(templates)
    .set({ usageCount: sql`${templates.usageCount} + 1` })
    .where(eq(templates.slug, slug));
}

// Seed default templates
export async function seedTemplates() {
  const db = await getDb();
  if (!db) return;

  const defaultTemplates = [
    {
      name: 'Invoice',
      slug: 'invoice',
      description: 'Standard invoice format with item details, quantities, and totals',
      category: 'finance' as const,
      columnDefinitions: JSON.stringify(['Item', 'Description', 'Quantity', 'Unit Price', 'Total']),
      icon: 'receipt',
      color: '#10B981',
    },
    {
      name: 'Inventory',
      slug: 'inventory',
      description: 'Product inventory with SKU, stock levels, and location',
      category: 'inventory' as const,
      columnDefinitions: JSON.stringify(['SKU', 'Product Name', 'Category', 'Quantity', 'Location', 'Last Updated']),
      icon: 'package',
      color: '#F59E0B',
    },
    {
      name: 'Employee List',
      slug: 'employee-list',
      description: 'Employee directory with contact information',
      category: 'hr' as const,
      columnDefinitions: JSON.stringify(['ID', 'Name', 'Department', 'Email', 'Phone', 'Start Date']),
      icon: 'users',
      color: '#8B5CF6',
    },
    {
      name: 'Expense Report',
      slug: 'expense-report',
      description: 'Track expenses with categories and approval status',
      category: 'finance' as const,
      columnDefinitions: JSON.stringify(['Date', 'Description', 'Category', 'Amount', 'Receipt', 'Status']),
      icon: 'credit-card',
      color: '#EF4444',
    },
    {
      name: 'Sales Report',
      slug: 'sales-report',
      description: 'Sales data with regions, products, and revenue',
      category: 'finance' as const,
      columnDefinitions: JSON.stringify(['Date', 'Region', 'Product', 'Units', 'Revenue', 'Growth']),
      icon: 'trending-up',
      color: '#3B82F6',
    },
    {
      name: 'General Table',
      slug: 'general',
      description: 'Flexible format for any tabular data',
      category: 'general' as const,
      columnDefinitions: JSON.stringify([]),
      icon: 'table',
      color: '#6B7280',
    },
  ];

  for (const template of defaultTemplates) {
    try {
      await db.insert(templates).values(template).onDuplicateKeyUpdate({ set: template });
    } catch (error) {
      // Ignore duplicate key errors
    }
  }
}
