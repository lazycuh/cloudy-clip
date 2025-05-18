import { Injectable } from '@angular/core';
import { NotificationService } from '@lazycuh/angular-notification';

@Injectable({
  providedIn: 'root'
})
export class DownloaderService {
  constructor(private readonly _notificationService: NotificationService) {}

  download(blob: Blob, fileType: 'png' | 'gif') {
    const anchor = document.createElement('a');
    const downloadLink = URL.createObjectURL(blob);
    const fileName = `cloudyclip.com_${new Date().toISOString()}.${fileType}`;

    anchor.href = downloadLink;
    anchor.download = fileName;
    anchor.target = '_blank';
    anchor.click();

    // 30s
    const autoCloseMs = 30_000;

    this._notificationService.open({
      autoCloseMs,
      // eslint-disable-next-line max-len
      content: $localize`If your file was not downloaded, please click <a aria-label='${$localize`Press here to re-download`}' href='${downloadLink}' download='${fileName}'>here</a> to re-download.`
    });

    setTimeout(() => {
      URL.revokeObjectURL(downloadLink);
    }, autoCloseMs);
  }
}
