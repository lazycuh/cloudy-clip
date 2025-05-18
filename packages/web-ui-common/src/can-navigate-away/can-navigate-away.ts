/**
 * An interface that components can implement to return whether they can be
 * unmounted when a navigation happens.
 */
export interface CanNavigateAway {
  canNavigateAway(): boolean | Promise<boolean>;
}
