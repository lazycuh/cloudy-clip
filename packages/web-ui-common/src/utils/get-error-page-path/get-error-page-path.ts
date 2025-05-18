export function getErrorPagePath(errorPage: 'unknown' | 'not-found') {
  return `/errors/${errorPage}`;
}
