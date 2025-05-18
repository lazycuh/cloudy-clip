import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { TruncatedTextComponent } from './truncated-text.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TruncatedTextComponent],
  selector: 'lc-test-bed',
  styles: [
    `
      :host {
        display: block;
        width: 100px;
        position: relative;
      }
    `
  ],
  template: '<lc-truncated-text [content]="content()" /> '
})
class TestBedComponent {
  readonly content = input.required<string>();
}

describe(TruncatedTextComponent.name, () => {
  it('Should truncate in the middle and replace truncated text with 3 dots', async () => {
    await renderComponent(TestBedComponent, { inputs: { content: 'This is a really long text' } });

    expect(screen.queryByText('This is a really long text')).not.toBeInTheDocument();
    expect(screen.getByText(/\. \. \./)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('This is a really long text')).toBeInTheDocument();
  });

  it('Should not truncate text if it is not long enough', async () => {
    await renderComponent(TestBedComponent, { inputs: { content: 'Hi' } });

    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.queryByText(/\. \. \./)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
