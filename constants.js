// SQLite and wrapper constants

const status = {
  sqliteOk: 0,
  sqliteRow: 100,
  sqliteDone: 101,
  transactionLimit: 1000,
  noTransaction: 1001,
};

const types = {
  integer: 1,
  float: 2,
  text: 3,
  null: 5,
};

const errorVal = -1;

export {status, types, errorVal};
