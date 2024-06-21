/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { Model } from './Model';

export class ModelClient {
    private _apiHost: string | null;

    /**
     * @constructor
     * @param [apiHost] Http host of the API.
     */
    constructor(apiHost?: string) {
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
     * Fetches a model using given resource path.
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
