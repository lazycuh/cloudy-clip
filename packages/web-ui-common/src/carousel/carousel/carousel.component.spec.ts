/* eslint-disable @angular-eslint/component-class-suffix */
import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../../utils/delay-by';
import { CarouselItemComponent } from '../carousel-item';
import { CarouselStepperDirective } from '../carousel-stepper';

import { CarouselComponent } from './carousel.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CarouselComponent, CarouselItemComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-carousel>
      <lc-carousel-item>Carousel item 1</lc-carousel-item>
      <lc-carousel-item>Carousel item 2</lc-carousel-item>
      <lc-carousel-item>Carousel item 3</lc-carousel-item>
    </lc-carousel>
  `
})
class TestBedComponent {
  carousel = viewChild.required(CarouselComponent);
}

describe(CarouselComponent.name, () => {
  it('Navigate to next carousel item and wrap around when the last item is reached', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');

    renderResult.fixture.componentInstance.carousel().nextCarouselItem();

    await delayBy(16);

    // second item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');

    renderResult.fixture.componentInstance.carousel().nextCarouselItem();

    await delayBy(16);

    // third item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'false');

    renderResult.fixture.componentInstance.carousel().nextCarouselItem();

    await delayBy(16);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Navigate to previous carousel item and wrap around when the first item is reached', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');

    renderResult.fixture.componentInstance.carousel().previousCarouselItem();

    await delayBy(16);

    // third item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'false');

    renderResult.fixture.componentInstance.carousel().previousCarouselItem();

    await delayBy(16);

    // second item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');

    renderResult.fixture.componentInstance.carousel().previousCarouselItem();

    await delayBy(16);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Go to any carousel item', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');

    renderResult.fixture.componentInstance.carousel().switchToCarouselItem(2);

    await delayBy(16);

    // third item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'false');

    renderResult.fixture.componentInstance.carousel().switchToCarouselItem(1);

    await delayBy(16);

    // second item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');

    renderResult.fixture.componentInstance.carousel().switchToCarouselItem(4);

    await delayBy(16);

    // second item is still active because 4 is out of bounds
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 3')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 3')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Can render lazy carousel content', async () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [CarouselComponent, CarouselItemComponent],
      selector: 'lc-test-bed',
      template: `
        <lc-carousel>
          <lc-carousel-item>Carousel item 1</lc-carousel-item>
          <lc-carousel-item [lazy]="true">
            <ng-template>Carousel item 2</ng-template>
          </lc-carousel-item>
        </lc-carousel>
      `
    })
    class TestBedComponentWithLazyContent {
      carousel = viewChild.required(CarouselComponent);
    }

    const renderResult = await renderComponent(TestBedComponentWithLazyContent);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.queryByText('Carousel item 2')).not.toBeInTheDocument();

    renderResult.fixture.componentInstance.carousel().switchToCarouselItem(1);

    await delayBy(16);

    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'false');
  });

  it('Can navigate using carousel steppers', async () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [CarouselComponent, CarouselItemComponent, CarouselStepperDirective],
      selector: 'lc-test-bed',
      template: `
        <lc-carousel>
          <lc-carousel-item>Carousel item 1</lc-carousel-item>
          <lc-carousel-item>Carousel item 2</lc-carousel-item>

          <button
            type="button"
            [lc-carousel-stepper]="-1">
            Previous
          </button>
          <button
            type="button"
            [lc-carousel-stepper]="1">
            Next
          </button>
        </lc-carousel>
      `
    })
    class CarouselStepperTestBedComponent {}

    await renderComponent(CarouselStepperTestBedComponent);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');

    const user = userEvent.setup();
    await user.click(screen.getByText('Next'));

    await delayBy(16);

    // second item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'false');

    await user.click(screen.getByText('Previous'));

    await delayBy(16);

    // first item is active
    expect(screen.getByText('Carousel item 1')).toHaveClass('is-active');
    expect(screen.getByText('Carousel item 1')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Carousel item 2')).toHaveClass('is-inactive');
    expect(screen.getByText('Carousel item 2')).toHaveAttribute('aria-hidden', 'true');
  });
});
