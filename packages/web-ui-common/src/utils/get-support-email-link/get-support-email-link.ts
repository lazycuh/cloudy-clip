export function getSupportEmailLink(subject: string, body?: string) {
  // mailto:heretohelp@cloudyclip.com?subject=[Cloudy Clip]
  const supportEmail = atob('bWFpbHRvOmhlcmV0b2hlbHBAdHJhZGV0aW1lbGluZS5jb20/c3ViamVjdD1bVHJhZGUgVGltZWxpbmVd');
  const parts = [`${supportEmail} ${subject}`];

  if (body) {
    parts.push(`body=${body}`);
  }

  return encodeURI(parts.join('&'));
}
