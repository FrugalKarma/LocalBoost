// Makes the key pair for phone notifications. Run it on your own computer: node scripts/vapid-keys.mjs
// Put both lines in Vercel → Settings → Environment Variables. Do not paste them in chats, code or GitHub.
import { newVapidKeys } from '../lib/webpush.mjs';
const k = newVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
