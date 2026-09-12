const fs = require('fs');
const key = fs.readFileSync('./zap-delivery-315ca-firebase-adminsdk-fbsvc-5e32126750.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)