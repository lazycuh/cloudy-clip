import { afterNextRender, ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { AngularNodeViewComponent, TiptapDraggableDirective, TiptapNodeViewContentDirective } from 'ngx-tiptap';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: TiptapDraggableDirective }],
  imports: [TiptapNodeViewContentDirective],
  selector: 'lc-figure',
  styleUrl: './figure.component.scss',
  templateUrl: './figure.component.html'
})
export class FigureComponent extends AngularNodeViewComponent {
  protected readonly _isImageSelected = signal(false);
  protected readonly _width = signal('100%');
  protected readonly _height = signal('auto');

  constructor() {
    super();

    afterNextRender({
      write: () => {
        this._width.set(this.node().attrs.width ?? '100%');
        this._height.set(this.node().attrs.height ?? 'auto');
      }
    });
  }

  protected _onImagePressed(event: Event) {
    event.stopPropagation();
    this._isImageSelected.set(!this._isImageSelected());
  }

  protected _onStartResizing(event: PointerEvent) {
    event.stopPropagation();

    const imageContainer = (event.target as HTMLElement).parentElement!;

    document.body.classList.add('is-resizing');
  }
}
