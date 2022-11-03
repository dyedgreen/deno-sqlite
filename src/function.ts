import { Wasm } from "../build/sqlite.js";
import { Status, Types } from "./constants.ts";
import { getStr, setArr, setStr } from "./wasm.ts";
import { SqliteError } from "./error.ts";

/**
 * Possible arguments a user-defined SQL function might
 * receive.
 *
 * These correspond to the SQL types `INTEGER` (number,
 * bigint, or boolean), `REAL` (number), `TEXT` (string),
 * `BLOB` (Uint8Array), and `NULL` (null).
 *
 * See `QueryParameter` for more details on how JS values
 * are converted to and from SQL values.
 */
export type SqlFunctionArgument =
  | boolean
  | number
  | bigint
  | string
  | null
  | Uint8Array;

/**
 * Values a user-defined SQL function is allowed to
 * return.
 *
 * These correspond to how `QueryParameter`s are
 * converted when bound to queries. Additionally a
 * user-defined function may return `void` (e.g. as in
 * `return;`), in which case a `NULL` value is returned
 * on the SQL side.
 */
export type SqlFunctionResult =
  | void
  | boolean
  | number
  | bigint
  | string
  | null
  | undefined
  | Date
  | Uint8Array;

export type SqlFunction = (
  ...args: Array<SqlFunctionArgument>
) => SqlFunctionResult;

export function wrapSqlFunction(
  wasm: Wasm,
  name: string,
  func: SqlFunction,
): (argc: number) => void {
  return (argCount: number) => {
    // This logic is similar to how we read rows in `query.ts`
    const args: Array<SqlFunctionArgument> = new Array(argCount);
    for (let argIdx = 0; argIdx < argCount; argIdx++) {
      switch (wasm.argument_type(argIdx)) {
        case Types.Integer:
          args[argIdx] = wasm.argument_int(argIdx);
          break;
        case Types.Float:
          args[argIdx] = wasm.argument_double(argIdx);
          break;
        case Types.Text:
          args[argIdx] = getStr(wasm, wasm.argument_text(argIdx));
          break;
        case Types.Blob: {
          const ptr = wasm.argument_blob(argIdx);
          if (ptr === 0) {
            // Zero pointer results in null
            args[argIdx] = null;
          } else {
            const length = wasm.argument_bytes(argIdx);
            // Slice should copy the bytes, as it makes a shallow copy
            args[argIdx] = new Uint8Array(wasm.memory.buffer, ptr, length)
              .slice();
          }
          break;
        }
        case Types.BigInteger: {
          const ptr = wasm.argument_text(argIdx);
          args[argIdx] = BigInt(getStr(wasm, ptr));
          break;
        }
        default:
          args[argIdx] = null;
          break;
      }
    }

    try {
      let result = func.apply(null, args);
      // This logic is similar to how we bind query parameters in `query.ts`
      switch (typeof result) {
        case "boolean":
          result = result ? 1 : 0;
          // fall through
        case "number":
          if (Number.isSafeInteger(result)) {
            wasm.result_int(result);
          } else {
            wasm.result_double(result);
          }
          break;
        case "bigint":
          // bigint is bound as two 32bit integers and reassembled on the C side
          if (result > 9223372036854775807n || result < -9223372036854775808n) {
            throw new SqliteError(
              `BigInt result ${result} overflows 64 bit integer.`,
            );
          } else {
            const posVal = result >= 0n ? result : -result;
            const sign = result >= 0n ? 1 : -1;
            const upper = Number(BigInt.asUintN(32, posVal >> 32n));
            const lower = Number(BigInt.asUintN(32, posVal));
            wasm.result_big_int(sign, upper, lower);
          }
          break;
        case "string":
          setStr(wasm, result, (ptr) => wasm.result_text(ptr));
          break;
        default:
          if (result instanceof Date) {
            // Dates are allowed and bound to TEXT, formatted `YYYY-MM-DDTHH:MM:SS.SSSZ`
            setStr(wasm, result.toISOString(), (ptr) => wasm.result_text(ptr));
          } else if (result instanceof Uint8Array) {
            // Uint8Arrays are allowed and bound to BLOB
            const size = result.length;
            setArr(wasm, result, (ptr) => wasm.result_blob(ptr, size));
          } else if (result === null || result === undefined) {
            // Both null and undefined result in a NULL entry
            wasm.result_null();
          } else {
            throw new SqliteError(`Can not return ${typeof result}.`);
          }
          break;
      }
    } catch (error) {
      setStr(
        wasm,
        `Error in user defined function '${name}': ${error?.message}`,
        (ptr) => wasm.result_error(ptr, Status.SqliteError),
      );
    }
  };
}
