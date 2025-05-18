import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ResponseBody } from '@lazycuh/http/src';
import { firstValueFrom, map } from 'rxjs';

import { Task } from './models';

@Injectable()
export class TaskService {
  private readonly _httpClient = inject(HttpClient);

  async getTaskStatus(taskId: string): Promise<Task['status']> {
    const taskResponsePayload = await firstValueFrom(
      this._httpClient
        .get<ResponseBody<Task>>(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`)
        .pipe(map(response => response.payload))
    );

    return taskResponsePayload.status;
  }
}
