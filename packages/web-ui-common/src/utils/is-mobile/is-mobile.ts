export function isMobile() {
  return /iPhone|iPad|iPod|Android|SamsungBrowser|X11; Linux|Mobile/i.test(navigator.userAgent);
}
