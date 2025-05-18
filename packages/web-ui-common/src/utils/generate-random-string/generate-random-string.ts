export function generateRandomString() {
  return btoa(String(Math.random() + Math.random()))
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
