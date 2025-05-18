import { Logger } from '@lazycuh/logging';
import { IdbClient } from '@lazycuh/web-ui-common/idb';
import { Extension } from '@tiptap/core';

export interface AutoSavingOptions {
  onFailure: (error: Error) => void;
  onSuccess: () => void;
  schemaVersion: number;
  storeName: string;
}

export const AutoSaving = {
  configure: (options: AutoSavingOptions) => {
    const logger = new Logger(`AutoSaving:${options.storeName}`);
    const autoSaveDelayMs = 1000;
    const key = `${options.storeName}/content`;

    let idbClient: IdbClient<string> | undefined;
    let lastSavedTimeoutHandle = -1;

    return Extension.create({
      name: 'autoSaving',
      async onCreate() {
        try {
          idbClient = await IdbClient.create(options.storeName, options.schemaVersion);
          this.editor.commands.setContent(await idbClient.get(key), false);
        } catch (error) {
          logger.error('failed to create IdbClient', error);
          options.onFailure(error as Error);
        }
      },
      onDestroy() {
        clearTimeout(lastSavedTimeoutHandle);
        idbClient?.close();
      },
      onUpdate() {
        if (!idbClient) {
          return;
        }

        clearTimeout(lastSavedTimeoutHandle);

        lastSavedTimeoutHandle = window.setTimeout(async () => {
          try {
            await idbClient!.upsert(key, this.editor.getHTML());
            options.onSuccess();
          } catch (error) {
            logger.error('failed to save content', error);
            options.onFailure(error as Error);
          }
        }, autoSaveDelayMs);
      }
    });
  }
};
