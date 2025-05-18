import { ChangeDetectionStrategy, Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../../utils/delay-by';

import { DialogService } from './dialog.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'lc-test-bed',
  template: '<ng-template>Hello World</ng-template>'
})
class TestBedComponent {
  templateRef = viewChild.required(TemplateRef, { read: TemplateRef });
}

describe(DialogService.name, () => {
  let testBedComponent: TestBedComponent;
  let service: DialogService;

  beforeEach(async () => {
    const renderResult = await renderComponent(TestBedComponent);
    testBedComponent = renderResult.fixture.componentInstance;

    service = TestBed.inject(DialogService);
  });

  it('Throw if dialog content is missing', () => {
    service
      .setClassName('test-class')
      .setTitle('Test title')
      .addButton({ class: 'test-button-class', label: 'Test button' });

    expect(() => {
      service.open();
    }).toThrow(new Error('Dialog content is required'));
  });

  it('Throw if dialog title is missing', () => {
    service
      .setContent(testBedComponent.templateRef())
      .setClassName('test-class')
      .addButton({ class: 'test-button-class', label: 'Test button' });

    expect(() => {
      service.open();
    }).toThrow(new Error('Dialog title is required'));
  });

  it('Throw if dialog class is missing', () => {
    service
      .setContent(testBedComponent.templateRef())
      .setTitle('Test title')
      .addButton({ class: 'test-button-class', label: 'Test button' });

    expect(() => {
      service.open();
    }).toThrow(new Error('Dialog class name is required'));
  });

  it('Throw if no dialog action is provided', () => {
    service.setContent(testBedComponent.templateRef()).setTitle('Test title').setClassName('test-class');

    expect(() => {
      service.open();
    }).toThrow(new Error('At least one dialog action button is required'));
  });

  it('Show dialog and interact with the dialog action buttons', async () => {
    const confirmButtonActionSpy = vi.fn();

    service
      .setContent(testBedComponent.templateRef())
      .setTitle('Test title')
      .setClassName('test-class')
      .addButton({ class: 'close-button', label: 'Close' })
      .addButton({ class: 'confirm-button', label: 'Confirm', onClick: confirmButtonActionSpy });

    service.open();

    await delayBy(16);

    expect(screen.getByText('Test title')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(screen.getByText('Confirm'));
    expect(confirmButtonActionSpy).toHaveBeenCalledOnce();

    vi.spyOn(service, 'close');

    await user.click(screen.getByText('Close'));

    expect(service.close).toHaveBeenCalledOnce();
  });
});
