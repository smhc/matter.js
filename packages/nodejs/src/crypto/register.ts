/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, NoProviderError, singleton } from "@project-chip/matter.js-general";
import { CryptoNode } from "./CryptoNode.js";

// Check if Crypto singleton is already registered and auto register if not
try {
    Crypto.get();
} catch (error) {
    NoProviderError.accept(error);
    Crypto.get = singleton(() => new CryptoNode());
}