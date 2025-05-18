export class MenuOption<T> {
  constructor(
    readonly label: string,
    readonly value: T,
    readonly labelWhenSelected?: string
  ) {}
}
