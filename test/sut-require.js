// http://www.gregjopa.com/2014/02/testing-and-code-coverage-with-node-js-apps/
"use strict";
/*jshint node: true, -W030 */


module.exports = function (path,proxy) {
  var modPath =(process.env.APP_DIR_FOR_CODE_COVERAGE || '../') + path;
  return proxy ? require('proxyquire')(modPath,proxy) : require(modPath);
};
