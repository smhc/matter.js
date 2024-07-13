/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { TlvTag, TlvTypeLength } from "./TlvCodec.js";
import { EncodingOptions, TlvReader, TlvSchema, TlvWriter } from "./TlvSchema.js";

export class TlvWrapper<O, T> extends TlvSchema<O> {
    constructor(
        protected readonly underlyingSchema: TlvSchema<T>,
        protected readonly wrap: (object: O) => T,
        private readonly unwrap: (value: T) => O,
    ) {
        super();
    }

    override decodeTlvInternalValue(reader: TlvReader, typeLength: TlvTypeLength): O {
        return this.unwrap(this.underlyingSchema.decodeTlvInternalValue(reader, typeLength));
    }

    override encodeTlvInternal(writer: TlvWriter, value: O, tag?: TlvTag, options?: EncodingOptions): void {
        this.underlyingSchema.encodeTlvInternal(writer, this.wrap(value), tag, options);
    }

    override validate(value: O): void {
        this.underlyingSchema.validate(this.wrap(value));
    }
}
