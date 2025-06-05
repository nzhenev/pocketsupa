import {
    introspectSupabaseSchema,
    SchemaIntrospection,
    TableInfo,
    EnumInfo,
} from "./introspection";
import fetch from "node-fetch"; // Для Bun будет работать встроенный fetch, импорт не нужен

type PBFieldType =
    | "text"
    | "number"
    | "bool"
    | "select"
    | "relation"
    | "file"
    | "date";

// Mapping из psql типов в PB типы
function pgTypeToPB(
    type: string,
    isEnum: boolean | string = false,
): PBFieldType {
    if (isEnum) return "select";
    switch (type) {
        case "uuid":
        case "text":
        case "varchar":
        case "character varying":
        case "citext":
            return "text";
        case "integer":
        case "int":
        case "serial":
        case "bigint":
        case "smallint":
        case "numeric":
        case "float8":
        case "float4":
        case "double precision":
            return "number";
        case "boolean":
        case "bool":
            return "bool";
        case "date":
        case "timestamp":
        case "timestamptz":
            return "date";
        case "json":
        case "jsonb":
            return "text";
        default:
            return "text";
    }
}

// Формируем PB-поле по supabase column
function columnToPBField(c: any, enums: EnumInfo[]): any {
    const isEnum = !!c.enumType || enums.some((e) => e.name === c.type);
    const pbType = pgTypeToPB(c.type, isEnum);

    const field: any = {
        name: c.name,
        type: pbType,
        required: c.notNull || false,
        unique: c.unique || false,
        options: {},
    };
    if (pbType === "select") {
        const values = enums.find((e) => e.name === (c.enumType || c.type));
        field.options = { values: values ? values.values : [] };
    }
    if (pbType === "relation" && c.references) {
        field.options = { collectionId: c.references.table }; // На самом деле, надо получить id коллекции, пока подставляем имя
    }
    if (pbType === "text" && c.default) {
        field.options = { default: c.default };
    }
    return field;
}

// Проверить существует ли коллекция PB уже
async function pbCollectionExists(
    pbUrl: string,
    token: string,
    name: string,
): Promise<boolean> {
    const r = await fetch(
        `${pbUrl}/api/collections/${encodeURIComponent(name)}`,
        {
            headers: token ? { Authorization: token } : {},
        },
    );
    return r.status === 200;
}

// Создать коллекцию в PB по имени и массиву fields (idempotent)
async function pbCreateCollection(
    pbUrl: string,
    token: string,
    name: string,
    fields: any[],
    options: any = {},
) {
    const body = {
        name,
        type: "base",
        schema: fields,
        options,
    };
    const resp = await fetch(`${pbUrl}/api/collections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Admin ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(
            `PB create collection ${name} failed: ${resp.status} ${err}`,
        );
    }
    return await resp.json();
}

// Основная функция: sync миграции → PB (создает только новые коллекции)
export async function syncSupabaseToPB(
    migrationsDir: string,
    pbUrl: string,
    adminToken: string,
) {
    const schema: SchemaIntrospection = introspectSupabaseSchema(migrationsDir);
    // Сначала получаем все коллекции PB (для non-destructive)
    let existingNames: string[] = [];
    {
        const res = await fetch(`${pbUrl}/api/collections`, {
          headers: adminToken ? { Authorization: `Admin ${adminToken}` } : {},
        });
        if (res.ok) {
            const rjson = await res.json();
            if (Array.isArray(rjson?.collections)) {
                existingNames = rjson.collections.map((c: any) => c.name);
            }
        }
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const table of schema.tables) {
        if (existingNames.includes(table.name)) {
            skipped.push(table.name);
            continue;
        }
        // id поле (uuid) => надо создать PB id/primary, иначе normal
        const pbFields = table.columns
            .filter((col) => col.name !== "id" || !col.primaryKey)
            .map((col) => {
                // detect FK as PB relation
                if (col.references)
                    return {
                        ...columnToPBField(
                            { ...col, type: "text" },
                            schema.enums,
                        ),
                        type: "relation",
                        options: { collectionId: col.references.table },
                    };
                return columnToPBField(col, schema.enums);
            });

        // PB всегда ожидает autoincrement string id — если found PK != id, можно во fields включить с type text + unique
        await pbCreateCollection(pbUrl, adminToken, table.name, pbFields);
        created.push(table.name);
        // Можно добавить ожидание если нужно дождаться ready
    }

    return {
        created,
        skipped,
    };
}

// console.log(require.main);
// CLI запуск
if (require.main === module) {
    const [, , migrationsDir, pbUrl, adminToken] = process.argv;
    console.log(!migrationsDir || !pbUrl || !adminToken);
    if (!migrationsDir || !pbUrl || !adminToken) {
        console.error(
            "Usage: bun run src/schema/syncToPB.ts <migrations_dir> <PB_URL> <ADMIN_TOKEN>",
        );
        process.exit(2);
    }
    syncSupabaseToPB(migrationsDir, pbUrl, adminToken)
        .then((r) => {
            console.log("Sync complete:", r);
            process.exit(0);
        })
        .catch((err) => {
            console.error("Error:", err);
            process.exit(1);
        });
}
