// Deno SQLite WASM binding types

type VoidPtr = number;
type StringPtr = number;
type StatementPtr = number;

export interface Wasm {
  memory: WebAssembly.Memory;

  malloc: (size: number) => VoidPtr;
  free: (ptr: VoidPtr) => void;
  str_len: (str: StringPtr) => number;
  seed_rng: (seed: number) => void;
  open: (filename: StringPtr) => number;
  prepare: (sql: StringPtr) => StatementPtr;
  finalize: (stmt: StatementPtr) => number;
  bind_int: (stmt: StatementPtr, idx: number, value: number) => number;
  bind_double: (stmt: StatementPtr, idx: number, value: number) => number;
  bind_text: (stmt: StatementPtr, idx: number, value: StringPtr) => number;
  bind_blob: (
    stmt: StatementPtr,
    idx: number,
    value: VoidPtr,
    size: number,
  ) => number;
  bind_big_int: (stmt: StatementPtr, idx: number, value: StringPtr) => number;
  bind_null: (stmt: StatementPtr, idx: number) => number;
  bind_parameter_index: (stmt: StatementPtr, name: StringPtr) => number;
  step: (stmt: StatementPtr) => number;
  column_count: (stmt: StatementPtr) => number;
  column_type: (stmt: StatementPtr, col: number) => number;
  column_int: (stmt: StatementPtr, col: number) => number;
  column_double: (stmt: StatementPtr, col: number) => number;
  column_text: (stmt: StatementPtr, col: number) => StringPtr;
  column_blob: (stmt: StatementPtr, col: number) => void;
  column_bytes: (stmt: StatementPtr, col: number) => number;
  column_name: (stmt: StatementPtr, col: number) => StringPtr;
  column_origin_name: (stmt: StatementPtr, col: number) => StringPtr;
  column_table_name: (stmt: StatementPtr, col: number) => StringPtr;
}

export default function instantiate(): { exports: Wasm };
