'use strict';
const native = process._linkedBinding('danmemore_sqlite');
const call = (operation, sql = '', values = []) => JSON.parse(native.call(operation, sql, JSON.stringify(values)));
exports.open = filename => {
  call('open', filename);
  return {
    exec: sql => call('exec', sql),
    prepare: sql => ({
      run: (...values) => call('run', sql, values),
      all: (...values) => call('all', sql, values),
      get: (...values) => call('all', sql, values)[0],
    }),
    close: () => call('close'),
  };
};

