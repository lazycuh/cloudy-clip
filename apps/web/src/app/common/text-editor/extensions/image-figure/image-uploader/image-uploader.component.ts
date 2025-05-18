import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, viewChild, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { AnchoredFloatingBox } from '@lazycuh/angular-anchored-floating-box';
import { NotificationService } from '@lazycuh/angular-notification';
import { ResponseBody } from '@lazycuh/http/src';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { firstValueFrom } from 'rxjs';

import { upload } from '@common/file';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormComponent, ShortTextFormFieldComponent, MatRipple, AnchoredFloatingBox, IconComponent],
  selector: 'lc-image-uploader',
  styleUrl: './image-uploader.component.scss',
  templateUrl: './image-uploader.component.html'
})
export class ImageUploaderComponent {
  protected readonly _imageLinkForm = new FormGroup({
    imageLink: new FormControl<string>('', { nonNullable: true })
  });

  private readonly _anchredFloatingBox = viewChild.required(AnchoredFloatingBox);
  private readonly _notificationService = inject(NotificationService);
  private readonly _httpClient = inject(HttpClient);

  private _onImageSourceChangeHandler: ((imageSource: string) => void) | undefined;

  open(anchor: HTMLElement) {
    this._anchredFloatingBox().open(anchor);
  }

  registerOnImageSourceChangeHandler(handler: (imageSource: string) => void) {
    this._onImageSourceChangeHandler = handler;
  }

  protected _shouldDisableUseImageLinkButton() {
    return this._imageLinkForm.controls.imageLink.value.trim() === '' || this._imageLinkForm.pristine;
  }

  protected _onUseImageLink(imageLink: string) {
    if (!this._onImageSourceChangeHandler) {
      throw new Error('Image source change handler is not registered.');
    }

    this._onImageSourceChangeHandler(imageLink);
    this._anchredFloatingBox().close();
  }

  protected async _onUploadImage() {
    const uploadedImageFile = await upload({ accept: 'image/*', multiple: false });
    const fiveMB = 5 * 1024 * 1024;

    if (uploadedImageFile.size > fiveMB) {
      this._notificationService.open({
        // eslint-disable-next-line max-len
        content: $localize`Image file <strong>${uploadedImageFile.name}</strong> exceeds the limit of 5MB. Its size is <strong>${this._formatFileSize(uploadedImageFile.size)}</strong>`
      });

      return;
    }

    const responseBody = await firstValueFrom(
      this._httpClient.post<ResponseBody<string>>('/api/media/images', uploadedImageFile)
    );

    this._onUseImageLink(responseBody.payload);
  }

  private _formatFileSize(fileSize: number | string) {
    const sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const kb = 1024;
    const size = typeof fileSize === 'string' ? parseInt(fileSize, 10) : fileSize;

    if (Number.isNaN(size)) {
      return '';
    }

    if (size === 0) {
      return '0B';
    }

    if (size < kb) {
      return `${parseFloat((size / kb).toFixed(1))}${sizeUnits[1]}`;
    }

    const byteConversion = Math.floor(Math.log(size) / Math.log(kb));

    return `${Math.round(size / kb ** byteConversion)}${sizeUnits[byteConversion]}`;
  }
}
