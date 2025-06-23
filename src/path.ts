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

import { join_data } from 'cockpit/_internal/common.ts';
import { Channel, ChannelPayload, ChannelOptions, BaseChannelOptions } from 'cockpit/channel.ts';

interface PathOptions extends BaseChannelOptions {
    payload?: never;
}

interface ReadOptions {
  payload?: never;
  max_read_size?: number;
  path?: string,
}

export class Path {
    filename: string;
    #options: PathOptions;

    constructor(filename: string, options?: PathOptions) {
        this.filename = filename;
        this.#options = options || {};
    }

    // eslint-disable-next-line max-len
    async read<P extends ChannelPayload = string>(options: ChannelOptions<P> & ReadOptions): Promise<{ tag: string, content: P }> {
        const data: P[] = [];
        // HACK: jelle is misunderstanding TypeScript here, obviously I can't
        // pass `path: this.filename` to `new Channel` as it is not a valid
        // option, but why does this hack work?
        const global_options = { ...this.#options, path: this.filename };
        const channel = new Channel<P>({ ...global_options, ...options, payload: 'fsread1' });

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
                    // StrOrBytes it not assignable to P
                    resolve({ tag: message.tag as string, content: join_data(data, channel.binary) as P });
                }
            });
        });
    }
}
