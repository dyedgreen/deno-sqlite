const status = {
  sqliteOk:         0,
  sqliteRow:        100,
  sqliteDone:       101,
  transactionLimit: 1000,
  noTransaction:    1001,
};

const types = {
  integer: 1,
  float:   2,
  text:    3,
  null:    5,
};

const values = {
  error: -1,
};

export default { status, types, values };
