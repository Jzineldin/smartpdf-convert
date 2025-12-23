import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const result = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'conversions' 
    ORDER BY ordinal_position;
  `;
  console.log('Columns in conversions table:');
  result.forEach(r => console.log(' -', r.column_name));
  await sql.end();
}

main();
