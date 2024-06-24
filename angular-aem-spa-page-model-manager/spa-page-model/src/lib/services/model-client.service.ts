import { Injectable, Inject, Optional } from '@angular/core';
import { Model } from '../common/model.interface';

@Injectable({
  providedIn: 'root'
})
export class ModelClientService {
  private _apiHost: string | null;

  /**
   * @constructor
   * @param [apiHost] Http host of the API.
   */
  constructor(@Optional() @Inject('API_HOST') apiHost?: string) {
    this._apiHost = apiHost || null;
  }

  /**
   * Returns http host of the API.
   * @returns API host or `null`.
   */
  get apiHost(): string | null {
    return this._apiHost;
  }

  /**
   * Fetches a model using the given resource path.
   * @param modelPath Absolute path to the model.
   * @return Promise to page model object.
   */
  public fetch<M extends Model>(modelPath: string): Promise<M> {
    if (!modelPath) {
      return Promise.reject(new Error(`Fetching model rejected for path: ${modelPath}`));
    }

    const url = `${this._apiHost || ''}${modelPath}`;

    return fetch(url, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error fetching model. Status: ${response.status}`);
        }
        return response.json() as Promise<M>;
      })
      .catch((error) => Promise.reject(error));
  }

  /**
   * Destroys the internal references to avoid memory leaks.
   */
  public destroy(): void {
    this._apiHost = null;
  }
}
