const status = {
  sqliteOk:      0,
  sqliteRow:     100,
  sqliteDone:    101,
  stmtLimit:     1000,
  noStmt:        1001,
  databaseLimit: 1002,
  noDatabase:    1003,
};

const types = {
  integer: 1,
  float:   2,
  text:    3,
  blob:    4,
  null:    5,
};

const values = {
  error: -1,
};

export default { status, types, values };
