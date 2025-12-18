import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function dropAllPublicTables() {
  try {
    // Get all tables in public schema
    const tables = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
    `;

    console.log('Found tables:', tables.map(t => t.tablename).join(', '));

    // Drop all tables
    for (const { tablename } of tables) {
      console.log(`Dropping table: ${tablename}`);
      await sql.unsafe(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
    }

    // Get all enums/types
    const types = await sql`
      SELECT typname FROM pg_type
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND typtype = 'e'
    `;

    console.log('Found types:', types.map(t => t.typname).join(', '));

    // Drop all custom types
    for (const { typname } of types) {
      console.log(`Dropping type: ${typname}`);
      await sql.unsafe(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
    }

    console.log('All tables and types dropped successfully');
    await sql.end();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

dropAllPublicTables();
