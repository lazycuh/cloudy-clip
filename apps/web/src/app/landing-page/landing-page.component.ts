import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurvedUnderlineComponent } from '@lazycuh/web-ui-common/curved-underline';
import { fanOut } from '@lazycuh/web-ui-common/effect/fan-out';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

@Component({
  animations: [
    fanOut({
      distanceInPx: 500,
      duration: '1.8s',
      name: 'tagLine'
    }),
    slideUp({
      duration: '1s',
      easingFunction: 'cubic-bezier(0.04, 0.54, 0.25, 1)',
      from: '10%',
      name: 'financialSuccess',
      to: '0'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'landing-page'
  },
  imports: [RouterLink, IconComponent, CurvedUnderlineComponent],
  selector: 'lc-landing-page',
  styleUrl: './landing-page.component.scss',
  templateUrl: './landing-page.component.html'
})
export class LandingPageComponent {}
