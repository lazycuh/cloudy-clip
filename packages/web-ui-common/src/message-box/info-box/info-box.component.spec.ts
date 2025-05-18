/* eslint-disable max-len */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { InfoBoxComponent } from './info-box.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfoBoxComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-info-box>
      <ng-container data-title>This is the title</ng-container>
      <ng-container>This is the content</ng-container>
      <button type="button">This is a button</button>
      <a href="#">This is a link</a>
    </lc-info-box>
  `
})
class TestBedComponent {}

describe(InfoBoxComponent.name, () => {
  it('Render content correctly', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.container.querySelector('path')).toHaveAttribute(
      'd',
      'M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z'
    );
    expect(screen.getByText('This is the title')).toBeInTheDocument();
    expect(screen.getByText('This is the content')).toBeInTheDocument();
    expect(screen.getByText('This is a button')).toBeInTheDocument();
    expect(screen.getByText('This is a link')).toBeInTheDocument();
  });
});
