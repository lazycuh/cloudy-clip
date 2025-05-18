/* eslint-disable max-len */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { WarningBoxComponent } from './warning-box.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WarningBoxComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-warning-box>
      <ng-container data-title>This is the title</ng-container>
      <ng-container>This is the content</ng-container>
      <button type="button">This is a button</button>
      <a href="#">This is a link</a>
    </lc-warning-box>
  `
})
class TestBedComponent {}

describe(WarningBoxComponent.name, () => {
  it('Render content correctly', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.container.querySelector('path')).toHaveAttribute(
      'd',
      'M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm69-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Zm0-100Z'
    );
    expect(screen.getByText('This is the title')).toBeInTheDocument();
    expect(screen.getByText('This is the content')).toBeInTheDocument();
    expect(screen.getByText('This is a button')).toBeInTheDocument();
    expect(screen.getByText('This is a link')).toBeInTheDocument();
  });
});
