/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

import { join_data, StrOrBytes } from 'cockpit/_internal/common.ts';
import { Channel, ChannelPayload, ChannelOptions, BaseChannelOptions } from 'cockpit/channel.ts';

interface PathOptions extends BaseChannelOptions {
    payload?: never;
    binary?: never;
}

interface ReadOptions {
  payload?: never;
  max_read_size?: number;
  path?: string,
}

type ReadReturnType<T extends boolean> = T extends true ? Uint8Array: string;

export class Path {
    filename: string;
    #options: PathOptions;

    constructor(filename: string, options?: PathOptions) {
        this.filename = filename;
        this.#options = options || {};
    }

    // eslint-disable-next-line max-len
    private async _read<T extends boolean>(options: ReadOptions | undefined, binary: T): Promise<{content: ReadReturnType<T>, tag: string }> {
        const global_options = { ...this.#options, path: this.filename };
        const data: StrOrBytes[] = [];
        let channel;

        if (binary) {
            channel = new Channel<Uint8Array>({ ...global_options, ...options, payload: 'fsread1', binary: true });
        } else {
            channel = new Channel<string>({ ...global_options, ...options, payload: 'fsread1' });
        }

        channel.on('data', chunk => {
            data.push(chunk);
        });

        await channel.wait();

        return new Promise((resolve, reject) => {
            channel.on('close', message => {
                if (message.problem) {
                    // TODO: BasicError
                    reject(message.problem);
                } else {
                    // eslint-disable-next-line max-len
                    resolve({ tag: message.tag as string, content: join_data(data, channel.binary) as ReadReturnType<T> });
                }
            });
        });
    }

    read(options?: ReadOptions): Promise<{ content: string, tag: string}> {
        return this._read(options, false);
    }

    read_binary(options?: ReadOptions): Promise<{ content: Uint8Array, tag: string}> {
        return this._read(options, true);
    }
}
