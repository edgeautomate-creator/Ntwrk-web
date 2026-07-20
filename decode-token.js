const token = process.env.DUPR_API_TOKEN;

const parts = token.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

console.log('Token Payload:');
console.log(JSON.stringify(payload, null, 2));

const issuedAt = new Date(payload.iat * 1000);
const expiresAt = new Date(payload.exp * 1000);
const now = new Date();

console.log('\n⏰ Token Timing:');
console.log('Issued at:  ', issuedAt.toLocaleString());
console.log('Expires at: ', expiresAt.toLocaleString());
console.log('Current time:', now.toLocaleString());

if (now > expiresAt) {
  console.log('\n❌ TOKEN HAS EXPIRED');
  console.log('The token expired', Math.round((now - expiresAt) / 60000), 'minutes ago');
} else {
  console.log('\n✅ Token is still valid');
  console.log('Will expire in', Math.round((expiresAt - now) / 60000), 'minutes');
}
