import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://desafio:desafio@localhost:5432/pedidos';

export const pool = new Pool({ connectionString });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}
