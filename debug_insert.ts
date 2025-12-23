import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const result = await sql`
    SELECT column_name, ordinal_position, column_default
    FROM information_schema.columns 
    WHERE table_name = 'conversions' 
    ORDER BY ordinal_position;
  `;
  console.log('Database column order:');
  result.forEach((r) => {
    const hasDefault = r.column_default ? 'yes' : 'no';
    console.log('  ' + r.ordinal_position + ': ' + r.column_name + ' (default: ' + hasDefault + ')');
  });
  await sql.end();
}

main();
