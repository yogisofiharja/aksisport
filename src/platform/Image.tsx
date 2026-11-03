// React Native's Image sends `source.headers` with network requests, which
// is how every auth-protected image (avatars, receipts, chat photos) gets
// its bearer token. The browser build resolves Image.web.tsx instead —
// react-native-web's Image silently drops `headers`.
export { Image } from 'react-native';
