import { UploadOptions } from './upload-options';

export function upload<T extends UploadOptions, R extends File[] | File = T['multiple'] extends true ? File[] : File>(
  options: T
) {
  return new Promise<R>(resolve => {
    const inputElement = document.createElement('input');
    inputElement.type = 'file';
    inputElement.accept = options.accept;
    inputElement.multiple = options.multiple;

    inputElement.onchange = () => {
      resolve((options.multiple ? Array.from(inputElement.files ?? []) : inputElement.files?.[0]) as R);

      inputElement.onchange = null;
    };

    inputElement.click();
  });
}
