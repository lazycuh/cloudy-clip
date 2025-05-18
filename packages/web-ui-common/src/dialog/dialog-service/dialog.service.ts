import { ApplicationRef, ComponentRef, createComponent, Injectable, TemplateRef } from '@angular/core';

import { ButtonSpec } from '../button-spec';
import { DialogTemplateComponent } from '../dialog-template';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private _className = '';
  private _title = '';
  private _content?: TemplateRef<unknown> = undefined;
  private _buttons = [] as ButtonSpec[];
  private _consent?: string;

  private _componentRef!: ComponentRef<DialogTemplateComponent>;

  constructor(private readonly _applicationRef: ApplicationRef) {}

  setClassName(className: string) {
    this._className = className;

    return this;
  }

  setTitle(title: string) {
    this._title = title;

    return this;
  }

  setContent(content: TemplateRef<unknown>) {
    this._content = content;

    return this;
  }

  setConsent(consent: string) {
    this._consent = consent;

    return this;
  }

  nonDismissible() {
    this._componentRef.instance.nonDismissble();

    return this;
  }

  addButton(buttonSpec: Omit<ButtonSpec, 'onClick'> & { onClick?: VoidFunction }) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (buttonSpec.onClick === undefined) {
      buttonSpec.onClick = () => {
        this.close();
      };
    }

    this._buttons.push(buttonSpec as ButtonSpec);

    return this;
  }

  open() {
    if (!this._content) {
      throw new Error('Dialog content is required');
    }

    if (!this._className) {
      throw new Error('Dialog class name is required');
    }

    if (this._buttons.length === 0) {
      throw new Error('At least one dialog action button is required');
    }

    this._componentRef = createComponent(DialogTemplateComponent, {
      environmentInjector: this._applicationRef.injector
    });

    this._componentRef.setInput('className', this._className);
    this._componentRef.setInput('title', this._title);
    this._componentRef.setInput('content', this._content);
    this._componentRef.setInput('buttons', this._buttons);
    this._componentRef.setInput('consent', this._consent);

    let afterClosedListener: VoidFunction[] = [];

    const hostElement = this._componentRef.location.nativeElement as HTMLElement;

    this._componentRef.instance.setOnAfterClosed(() => {
      this._componentRef.destroy();
      this._buttons = [];
      document.body.removeChild(hostElement);

      for (const listener of afterClosedListener) {
        listener();
      }

      afterClosedListener = [];
    });

    this._applicationRef.attachView(this._componentRef.hostView);

    document.body.appendChild(hostElement);

    return {
      addAfterClosedListener: (listener: VoidFunction) => {
        afterClosedListener.push(listener);
      }
    };
  }

  close() {
    this._componentRef.instance.close();
  }
}
