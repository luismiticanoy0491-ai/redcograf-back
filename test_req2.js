const express = require('express');
const app = express();
try {
  const rs = require('./src/routes/separados');
  console.log("KEYS EXPORTED BY separados:", Object.keys(rs));
  console.log("IS FUNCTION?", typeof rs === 'function');
  if (typeof rs !== 'function') {
    if (typeof rs.default === 'function') {
      console.log("ROUTER is inside rs.default!");
    }
  }
} catch (e) {
  console.error("REQUIRE ERROR:", e);
}
process.exit(0);
