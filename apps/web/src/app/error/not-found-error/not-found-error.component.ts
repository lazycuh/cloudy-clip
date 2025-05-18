import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'not-found-error'
  },
  imports: [RouterLink, MatRipple],
  selector: 'lc-not-found-error',
  styleUrl: './not-found-error.component.scss',
  templateUrl: './not-found-error.component.html'
})
export class NotFoundErrorComponent {}
