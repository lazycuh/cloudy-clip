import { ApplicationRef, ComponentRef, createComponent, Injectable, Type } from '@angular/core';

import { DeterminateProgressComponent } from './determinate-progress';
import { IndeterminateProgressComponent } from './indeterminate-progress';

type ProgressIndicatorRef = ComponentRef<DeterminateProgressComponent> | ComponentRef<IndeterminateProgressComponent>;

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private _openedProgressIndicators: ProgressIndicatorRef[] = [];

  constructor(private readonly _applicationRef: ApplicationRef) {}

  openIndeterminateProgressIndicator() {
    return new Promise<void>(resolve => {
      this._attachProgressComponent(IndeterminateProgressComponent);

      setTimeout(resolve, 250);
    });
  }

  private _attachProgressComponent<T extends DeterminateProgressComponent | IndeterminateProgressComponent>(
    componentType: Type<T>
  ): ComponentRef<T> {
    const progressIndicatorRef = createComponent(componentType, { environmentInjector: this._applicationRef.injector });

    this._openedProgressIndicators.push(progressIndicatorRef as ProgressIndicatorRef);

    this._applicationRef.attachView(progressIndicatorRef.hostView);
    document.body.appendChild(progressIndicatorRef.location.nativeElement);
    progressIndicatorRef.instance.show();

    return progressIndicatorRef;
  }

  openDeterminateProgressIndicator(description: string) {
    return new Promise<DeterminateProgressComponentRef>(resolve => {
      const progressIndicatorRef = this._attachProgressComponent(DeterminateProgressComponent);
      progressIndicatorRef.instance.setDescription(description);

      setTimeout(() => {
        resolve(new DeterminateProgressComponentRef(progressIndicatorRef.instance));
      }, 250);
    });
  }

  close() {
    for (const progressIndicatorRef of this._openedProgressIndicators) {
      progressIndicatorRef.instance.hide();

      setTimeout(() => {
        this._applicationRef.detachView(progressIndicatorRef.hostView);
        progressIndicatorRef.destroy();
      }, 500);
    }

    this._openedProgressIndicators = [];
  }
}

export class DeterminateProgressComponentRef {
  constructor(private readonly _component: DeterminateProgressComponent) {}

  updateProgress(progress: number) {
    this._component.setCurrentProgress(Math.round(progress));
  }

  updateDescription(value: string) {
    this._component.setDescription(value);
  }

  whenAbort() {
    return this._component.whenAbort();
  }

  abort() {
    this._component.abort();
  }
}
