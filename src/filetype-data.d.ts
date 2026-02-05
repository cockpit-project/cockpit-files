/* SPDX-License-Identifier: LGPL-2.1-or-later */
import type { FileTypeData } from './filetype-lookup.js';

/* This data comes dynamically as JSON from filetype-plugin.ts */
declare const filetype_data: FileTypeData;
export default filetype_data;
