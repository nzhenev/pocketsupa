import { OPERATORS } from "./constants";
import type {
    FilterFunction,
    Path,
    PathValue,
    QueryBuilder,
    RawQueryObject,
    RestrictedQueryBuilder,
} from "./types";
import { isDateMacro } from "./utils";

export function pbQuery<T, MaxDepth extends number = 6>(): QueryBuilder<
    T,
    MaxDepth
> {
    let query = "";

    const keyCounter = new Map<Path<T, MaxDepth>, number>();
    const valueMap = new Map<string, unknown>();

    const incrementKeyCounter = (key: Path<T, MaxDepth>) => {
        const count = keyCounter.get(key) || 0;
        const newCount = count + 1;
        keyCounter.set(key, newCount);

        return newCount;
    };

    const saveValue = <P extends Path<T, MaxDepth>>(
        key: P,
        value: PathValue<T, P, MaxDepth>,
    ) => {
        const count = incrementKeyCounter(key);
        const newName = `${String(key)}${count}`;
        valueMap.set(newName, value);

        return newName;
    };

    const expression = <P extends Path<T, MaxDepth>>(
        key: P,
        operator: string,
        value: PathValue<T, P, MaxDepth>,
    ) => {
        if (isDateMacro(value)) {
            query += `${String(key)}${operator}${value}`;
        } else {
            const newName = saveValue(key, value);
            query += `${String(key)}${operator}{:${newName}}`;
        }
    };

    type BuilderFunction = <P extends Path<T, MaxDepth>>(
        key: P,
        values: PathValue<T, P, MaxDepth>,
    ) => RestrictedQueryBuilder<T, MaxDepth>;

    const builderFunctions = {} as Record<
        keyof typeof OPERATORS,
        BuilderFunction
    >;
    for (const [name, operator] of Object.entries(OPERATORS)) {
        const key = name as keyof typeof OPERATORS;
        builderFunctions[key] = <P extends Path<T, MaxDepth>>(
            key: P,
            value: PathValue<T, P, MaxDepth>,
        ) => {
            expression(key, operator, value);
            return restrictedQueryBuilder;
        };
    }

    function build(): RawQueryObject;
    function build(filter: FilterFunction): string;
    function build(filter?: FilterFunction): RawQueryObject | string {
        if (typeof filter === "function") {
            return filter(query, Object.fromEntries(valueMap));
        }
        return { raw: query, values: Object.fromEntries(valueMap) };
    }

    const queryBuilder: QueryBuilder<T, MaxDepth> = {
        ...builderFunctions,
        search(keys, value) {
            query += "(";
            const cleanedPaths = keys.filter((key) => key);
            cleanedPaths.forEach((key, index) => {
                expression(key, "~", value);
                query += index < cleanedPaths.length - 1 ? " || " : "";
            });
            query += ")";
            return restrictedQueryBuilder;
        },
        in(key, values) {
            query += "(";
            values.forEach((value, index) => {
                expression(key, "=", value);
                query += index < values.length - 1 ? " || " : "";
            });
            query += ")";
            return restrictedQueryBuilder;
        },
        notIn(key, values) {
            query += "(";
            values.forEach((value, index) => {
                expression(key, "!=", value);
                query += index < values.length - 1 ? " && " : "";
            });
            query += ")";
            return restrictedQueryBuilder;
        },
        between(key, from, to) {
            query += "(";
            expression(key, ">=", from);
            query += " && ";
            expression(key, "<=", to);
            query += ")";
            return restrictedQueryBuilder;
        },
        notBetween(key, from, to) {
            query += "(";
            expression(key, "<", from);
            query += " || ";
            expression(key, ">", to);
            query += ")";
            return restrictedQueryBuilder;
        },
        isNull(key) {
            query += `${String(key)}=''`;
            return restrictedQueryBuilder;
        },
        isNotNull(key) {
            query += `${String(key)}!=''`;
            return restrictedQueryBuilder;
        },
        custom(raw) {
            query += raw;
            return restrictedQueryBuilder;
        },
        group(callback) {
            query += "(";
            callback(queryBuilder);
            query += ")";
            return restrictedQueryBuilder;
        },
        build,
    };

    const restrictedQueryBuilder: RestrictedQueryBuilder<T, MaxDepth> = {
        and() {
            query += " && ";
            return queryBuilder;
        },
        or() {
            query += " || ";
            return queryBuilder;
        },
        build,
    };

    return queryBuilder;
}
