import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { screen } from '@testing-library/angular';
import { beforeEach, describe, expect, it } from 'vitest';

import { delayBy } from '../utils/delay-by';

import { ProgressService } from './progress.service';

describe(ProgressService.name, () => {
  let service: ProgressService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NoopAnimationsModule] });
    service = TestBed.inject(ProgressService);
  });

  it('Open determinate progress bar', async () => {
    const progressIndicator = await service.openDeterminateProgressIndicator('Hello World');

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();

    progressIndicator.updateDescription('New description');
    progressIndicator.updateProgress(50);

    await delayBy(16);

    expect(screen.getByText('New description')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
