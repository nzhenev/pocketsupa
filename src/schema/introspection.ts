import fs from "fs";
import path from "path";

// MVP: для простых create table/enum/field/foreign key
export type ColumnInfo = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  unique: boolean;
  default?: string;
  references?: { table: string; field: string };
  enumType?: string;
};
export type EnumInfo = { name: string; values: string[] };
export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  primaryKey?: string[];
  foreignKeys?: { field: string; table: string; refField: string }[];
  unique?: string[][];
  raw: string;
};

export type SchemaIntrospection = {
  tables: TableInfo[];
  enums: EnumInfo[];
  others: string[]; // raw not parsed
};

/** Парсит (!!минимально!!) Postgres миграции supabase (*.sql) в json-структуру */
export function introspectSupabaseSchema(migrationsDir: string): SchemaIntrospection {
  // 1. Собираем все *.sql файлы (по alphanum order)
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort()
    .map(f => path.join(migrationsDir, f));
  let sql = files.map(f => fs.readFileSync(f, "utf-8")).join("\n");

  // Убираем комментарии SQL
  sql = sql.replace(/--[^\n]*\n/g, "\n").replace(/\\/g, " ");

  // 2. Парсим ENUMы (create type ...)
  const enums: EnumInfo[] = [];
  const enumRe = /create\s+type\s+([a-z0-9_]+)\s+as\s+enum\s*\(([^)]+)\)/gim;
  let ematch: RegExpExecArray | null;
  while ((ematch = enumRe.exec(sql))) {
    const name = ematch[1];
    const values = ematch[2].split(",").map(x=>x.trim().replace(/'/g,""));
    enums.push({ name, values });
  }

  // 3. Парсим таблицы
  const tables: TableInfo[] = [];
  const tableRe = /create\s+table\s+([a-zA-Z0-9_"]+)\s*\(([^;]+?)\);/gim;
  let tmatch: RegExpExecArray | null;
  while ((tmatch = tableRe.exec(sql))) {
    let tname = tmatch[1].replace(/"/g,"");
    const body = tmatch[2];
    const raw = tmatch[0];

    // 3.1 находим все строки-поля таблицы
    const tableLines = body.split(",").map(x => x.trim()).filter(Boolean);

    // 3.2 ищем поля, PK, уникальные, FK
    const columns: ColumnInfo[] = [];
    const pks: string[] = [];
    const uqs: string[][] = [];
    const fks: { field: string; table: string; refField: string }[] = [];

    for (const line of tableLines) {
      // PRIMARY KEY в отдельной строке
      const pkMatch = line.match(/^primary\s+key\s*\((.+?)\)/i);
      if (pkMatch) {
        pks.push(...pkMatch[1].split(",").map(s=>s.replace(/"/g,"").trim()));
        continue;
      }
      // UNIQUE (...)
      const uniqueMatch = line.match(/^unique\s*\((.+?)\)/i);
      if (uniqueMatch) {
        uqs.push(uniqueMatch[1].split(",").map(s=>s.replace(/"/g,"").trim()));
        continue;
      }
      // constraint ... foreign key ("field") references "table"("field")...
      const fkMatch = line.match(/foreign\s+key\s*\(("?[\w]+"?)\)\s+references\s+("?[\w]+"?)\s*\(("?[\w]+"?)\)/i);
      if (fkMatch) {
        fks.push({ 
          field: fkMatch[1].replace(/"/g,""), 
          table: fkMatch[2].replace(/"/g,""), 
          refField: fkMatch[3].replace(/"/g,""),
        });
        continue;
      }

      // Колонка: name type [mod ...]
      const colMatch = line.match(/^("?[\w]+"?)\s+([a-zA-Z0-9_\[\]]+)(.*)/i);
      if (colMatch) {
        const [_, col, typ, opt] = colMatch;
        const colname = col.replace(/"/g,"");
        const colType = typ.toLowerCase();
        const notNull = /\bnot\s+null\b/i.test(opt);
        const unique = /\bunique\b/i.test(opt);
        const pk = /\bprimary\s+key\b/i.test(opt);
        const defMatch = opt.match(/\bdefault\s+([^ ]+)/i);
        const defVal = defMatch ? defMatch[1].replace(/'/g,"") : undefined;
        // foreign key inline: references
        const refMatch = opt.match(/\breferences\s+("?[\w]+"?)\s*\(("?[\w]+"?)\)/i);
        let references = undefined;
        if (refMatch) references = { table: refMatch[1].replace(/"/g,""), field: refMatch[2].replace(/"/g,"") };
        // enum
        let enumType = undefined;
        if (enums.find(e=>e.name===colType)) enumType = colType;

        columns.push({
          name: colname,
          type: colType,
          notNull,
          primaryKey: pk,
          unique,
          default: defVal,
          references,
          enumType,
        });
        // primary key inline
        if (pk && !pks.includes(colname)) pks.push(colname);
      }
      // FK inline
      // (nothing)
    }
    tables.push({
      name: tname,
      columns,
      primaryKey: pks.length? pks: undefined,
      foreignKeys: fks.length? fks: undefined,
      unique: uqs.length? uqs: undefined,
      raw
    });
  }

  // 4. Соберем всё что не смогли распарсить
  const others: string[] = [];
  // можно добавить сюда все остальное (create functions, alter ...) по желанию

  return { tables, enums, others };
}

// Для автотестов — экспорт как CLI
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('USAGE: node introspection.js path/to/migrations'); process.exit(1);}
  const result = introspectSupabaseSchema(dir);
  console.log(JSON.stringify(result, null, 2));
}
