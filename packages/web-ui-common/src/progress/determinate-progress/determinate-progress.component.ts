import { ChangeDetectionStrategy, Component, OnDestroy, signal, ViewEncapsulation } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { Observable, Subject } from 'rxjs';

import { fadeIn } from '../../effect/fade-in';
import { DotDotDotComponent } from '../dot-dot-dot';

@Component({
  animations: [
    fadeIn({
      duration: '250ms',
      easingFunction: 'cubic-bezier(0.04, 0.54, 0.25, 1)',
      name: 'fade-in'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    '[class.hidden]': '_visible() === false',
    class: 'determinate-progress'
  },
  imports: [DotDotDotComponent, MatRippleModule],
  selector: 'lc-determinate-progress',
  styleUrls: ['./determinate-progress.component.scss'],
  templateUrl: './determinate-progress.component.html'
})
export class DeterminateProgressComponent implements OnDestroy {
  protected readonly _visible = signal(false);
  protected readonly _currentProgress = signal(0);
  protected readonly _description = signal('');

  protected readonly _diameter = 400;
  protected readonly _margin = 20;
  protected readonly _radius = (this._diameter - this._margin * 2) / 2;
  protected readonly _totalRingLength = 1150;

  private readonly _abort = new Subject<void>();
  private readonly _totalProgress = 100;

  constructor(private readonly _confirmationCaptureService: ConfirmationCaptureService) {}

  ngOnDestroy(): void {
    this._abort.complete();
  }

  protected _calculateCurrentRingLength() {
    return (1 - this._currentProgress() / this._totalProgress) * this._totalRingLength;
  }

  async _onAbort() {
    const confirmed = await this._confirmationCaptureService.open({
      content: $localize`Are you sure you want to abort?`
    });

    if (confirmed) {
      this._abort.next();
      this._abort.complete();
    }
  }

  abort() {
    this._abort.next();
    this._abort.complete();
  }

  show() {
    this._visible.set(true);
  }

  hide() {
    this._visible.set(false);
  }

  setDescription(value: string) {
    this._description.set(value);
  }

  setCurrentProgress(value: number) {
    this._currentProgress.set(value);
  }

  whenAbort(): Observable<void> {
    return this._abort.asObservable();
  }
}
