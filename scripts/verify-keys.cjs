
const crypto = require('crypto');

function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

const testiqHash = hashApiKey('testiq');
console.log('testiq hash:', testiqHash);

const userKey = '8a857ae2d657ae297171d4d5b5227642e50651673aade86b41898eaed6c86e43';
const userKeyHash = hashApiKey(userKey);
console.log('User key hash:', userKeyHash);
