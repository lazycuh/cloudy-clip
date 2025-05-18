const aliasTable = {
  redirectedFromQueryParam: 'rf',
  turnstileTokenHeader: 'X-Cc'
} as const;

if (Object.keys(aliasTable).length !== new Set(Object.values(aliasTable)).size) {
  throw new Error('aliases have duplicates');
}

export function getAliasFor(realName: keyof typeof aliasTable) {
  return aliasTable[realName];
}
