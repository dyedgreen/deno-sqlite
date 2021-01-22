import { QueryParam } from "./db.ts";

export const toSQL = Symbol("toSQL");

export type SQLInterpolated = QueryParam | SQLExpression | {
  [toSQL](): SQLInterpolated;
};
export class SQLExpression {
  constructor(
    readonly literalSql: string[] = [""],
    readonly sqlParams: QueryParam[] = [],
  ) {
    if (literalSql.length !== sqlParams.length + 1) {
      throw new TypeError("literalSql.length must equal params.length + 1");
    }
  }
}

/**
 * Tag function constructing a SQLExpression with bound interpolated values.
 */
export const SQL = (
  strings: TemplateStringsArray,
  ...values: SQLInterpolated[]
) => {
  const flattened: (
    | { string: string; value?: undefined }
    | { value: QueryParam; string?: undefined }
  )[] = [];

  for (let i = 0; i < strings.length; i++) {
    const string = strings[i];
    flattened.push({ string });

    if (i < values.length) {
      let value = values[i];
      while (
        !(value instanceof SQLExpression) &&
        typeof (value as any)?.[toSQL] === "function"
      ) {
        value = (value as any)?.[toSQL]();
      }
      if (value instanceof SQLExpression) {
        for (let j = 0; j < value.literalSql.length; j++) {
          flattened.push({ string: value.literalSql[j] });

          if (j < value.sqlParams.length) {
            flattened.push({ value: value.sqlParams[j] });
          }
        }
      } else if (typeof value === "object" && value !== null) {
        throw new TypeError(
          "attempted to interpolate unsupported object into SQL",
        );
      } else {
        flattened.push({ value });
      }
    }
  }

  const flattenedStrings = [];
  const flattenedValues = [];

  let stringBuffer = "";
  for (const { string, value } of flattened) {
    if (string !== undefined) {
      stringBuffer += string;
    } else if (value !== undefined) {
      flattenedStrings.push(stringBuffer);
      stringBuffer = "";
      flattenedValues.push(value);
    } else {
      throw new TypeError("flattened[…].string and .value are both undefined");
    }
  }
  flattenedStrings.push(stringBuffer);

  return new SQLExpression(flattenedStrings, flattenedValues);
};

/**
 * Encodes ("escapes") a string as a SQLite identifier in a SQLExpression.
 */
export const encodeIdentifier = (
  identifier: string,
  opts: { allowWeird?: boolean } = {},
): SQLExpression => {
  if (identifier.includes("\x00")) {
    throw new TypeError('identifier included a ␀ ("\\x00") character');
  }

  // We know UTF-8 is being used because that's the only encoding the WASM
  // SQLite build supports.
  const asUtf8 = (new TextEncoder()).encode(identifier);
  const fromUtf8 = (new TextDecoder()).decode(asUtf8);
  if (identifier !== fromUtf8) {
    throw new TypeError(
      "identifier could not be losslessly encoded as UTF-8",
    );
  }

  // In some cases, SQLite may interpret double-quoted and single-quoted strings
  // to be either string literals or identifiers depending on the context. To
  // avoid any potential ambiguity, we use SQLite's other supported quoting
  // characters, although they aren't standard SQL.
  let encoded;
  if (!identifier.includes("]")) {
    // If the identifier doesn't include a closing square bracket, we can just
    // wrap the value in square brackets.
    encoded = `[${identifier}]`;
  } else {
    // Otherwise, wrap it in backticks and double any backticks it contains.
    encoded = "`" + identifier.replace(/`/g, "``") + "`";
  }

  // We quote all identifiers to avoid potential conflict with keywords, but
  // if you're using a name that syntactically *requires* quoting, that's weird.
  // It should be safe, but we disallow it by default to be sure it's not a sign
  // of something unintentional happening.
  const identifierIsWeird = !/^[A-Za-z0-9_]+$/.test(identifier);
  if (identifierIsWeird) {
    if (!opts.allowWeird) {
      throw new TypeError(
        `Weird SQL identifier ${
          JSON.stringify(identifier)
        }, encoded as ${encoded}, is not allowed.`,
      );
    }
  }

  return new SQLExpression([encoded]);
};
