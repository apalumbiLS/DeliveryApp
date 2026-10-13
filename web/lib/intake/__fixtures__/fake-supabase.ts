/**
 * A stand-in for the Supabase client, covering only the chains the intake
 * pipeline actually uses.
 *
 * **This is a fake, not a database.** It does not enforce RLS, column types, or
 * foreign keys, and it models exactly one unique constraint — the one the
 * pipeline's idempotency depends on. A test passing here proves the pipeline
 * branches correctly; it proves nothing about whether the SQL is valid or the
 * policies permit the write. Those are the migration's job.
 *
 * Imported only by tests.
 */

type Row = Record<string, unknown>;

export type FakeDatabase = Record<string, Row[]>;

type FakeError = { code?: string; message: string } | null;
type Response = { data: unknown; error: FakeError };

export function emptyDatabase(): FakeDatabase {
  return {
    companies: [],
    inbound_emails: [],
    order_intents: [],
    order_items: [],
    orders: [],
    parse_attempts: [],
  };
}

class FakeQuery implements PromiseLike<Response> {
  private filters: [string, unknown][] = [];
  private inFilters: [string, unknown[]][] = [];
  private columns = "*";
  private orderColumn: string | null = null;
  private orderAscending = true;
  private max: number | null = null;
  private singleMode: "maybe" | "exactly" | null = null;
  private operation: "select" | "insert" | "update" = "select";
  /** Always a list: Supabase accepts a single row or an array, and the pipeline
   *  inserts its order items in bulk. */
  private payload: Row[] = [];

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
  ) {}

  insert(row: Row | Row[]) {
    this.operation = "insert";
    this.payload = Array.isArray(row) ? row : [row];
    return this;
  }

  update(row: Row) {
    this.operation = "update";
    this.payload = [row];
    return this;
  }

  select(columns: string) {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  is(column: string, value: unknown) {
    return this.eq(column, value);
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push([column, values]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.max = count;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this.run();
  }

  single() {
    this.singleMode = "exactly";
    return this.run();
  }

  then<R1, R2>(
    onfulfilled?: ((value: Response) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private async run(): Promise<Response> {
    const rows = (this.db[this.table] ??= []);

    if (this.operation === "insert") {
      const created: Row[] = [];

      for (const candidate of this.payload) {
        const row: Row = { id: globalThis.crypto.randomUUID(), ...candidate };

        // The one constraint the pipeline's idempotency relies on. Without it
        // the duplicate path would never be exercised.
        if (
          this.table === "inbound_emails" &&
          rows.some(
            (existing) =>
              existing.mailgun_message_id === row.mailgun_message_id,
          )
        ) {
          return {
            data: null,
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          };
        }

        rows.push(row);
        created.push(row);
      }

      return this.respond(created);
    }

    const matching = rows.filter(
      (row) =>
        this.filters.every(
          ([column, value]) => (row[column] ?? null) === value,
        ) &&
        this.inFilters.every(([column, values]) =>
          values.includes(row[column]),
        ),
    );

    if (this.operation === "update") {
      const patch = this.payload[0] ?? {};
      for (const row of matching) Object.assign(row, patch);
    }

    return this.respond(matching);
  }

  private respond(rows: Row[]): Response {
    let result = rows;

    if (this.orderColumn) {
      const column = this.orderColumn;
      const direction = this.orderAscending ? 1 : -1;
      result = [...result].sort(
        (a, b) =>
          String(a[column] ?? "").localeCompare(String(b[column] ?? "")) *
          direction,
      );
    }

    if (this.max !== null) result = result.slice(0, this.max);

    if (this.singleMode) {
      const row = result[0] ?? null;

      if (!row && this.singleMode === "exactly") {
        return { data: null, error: { message: "no rows returned" } };
      }

      return { data: this.project(row), error: null };
    }

    return { data: result.map((row) => this.project(row)), error: null };
  }

  private project(row: Row | null): Row | null {
    if (!row) return null;
    if (this.columns === "*") return { ...row };

    const wanted = this.columns.split(",").map((column) => column.trim());
    const projected: Row = {};
    for (const column of wanted) projected[column] = row[column];
    return projected;
  }
}

export function fakeSupabase(db: FakeDatabase) {
  return {
    from(table: string) {
      return new FakeQuery(db, table);
    },
  };
}
