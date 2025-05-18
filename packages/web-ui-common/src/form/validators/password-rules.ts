export const PASSWORD_RULES = Object.freeze(
  [
    {
      label: $localize`Must be between 8 and 64 characters`,
      validatorName: 'length'
    },
    {
      label: $localize`Must contain at least one number`,
      validatorName: 'number'
    },
    {
      label: $localize`Must contain lowercase and uppercase letters`,
      validatorName: 'casing'
    }
  ].map(Object.freeze)
) as Readonly<Array<{ label: string; validatorName: string }>>;
