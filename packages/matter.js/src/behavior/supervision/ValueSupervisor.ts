/**
 * @license
 * Copyright 2022-2023 Project CHIP Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AccessControl } from "../AccessControl.js";
import type { Val } from "../state/Val.js";
import type { Transaction } from "../state/transaction/Transaction.js";
import type { ValidationLocation } from "../state/validation/location.js";
import type { RootSupervisor } from "./RootSupervisor.js";
import type { Schema } from "./Schema.js";

/**
 * Value supervisor implements schema-based supervision of a specific value.
 *
 * Supervision functions include:
 *
 *   - Access controls
 *
 *   - Datatype validation
 *
 *   - Managed instance generation
 *
 * Supervision is implemented via schema-driven runtime compilation.  We
 * perform as much logic as possible at startup to minimize overhead during
 * server operation.
 *
 * This means we typically ingest schema, create a compact form of denormalized
 * metadata, and/or generate functions to perform required operations.
 */
export interface ValueSupervisor {
    /**
     * The schema manager that owns this ValueSupervisor.
     */
    readonly owner: RootSupervisor;

    /**
     * The logical schema that controls the value's behavior.
     */
    readonly schema: Schema;

    /**
     * Consolidated access control information for the schema.
     */
    readonly access: AccessControl;

    /**
     * Perform validation.
     */
    readonly validate: ValueSupervisor.Validate;

    /**
     * Create a managed instance of a value.
     */
    readonly manage: ValueSupervisor.Manage;
}

export namespace ValueSupervisor {
    /**
     * Session information required for value management.
     */
    export interface Session extends AccessControl.Session {
        /**
         * The transaction used for isolating state changes associated with this session.
         */
        transaction: Transaction;
    }

    export type Validate = (value: Val, session: Session, location: ValidationLocation) => void;

    export type Manage = (reference: Val.Reference, session: Session) => Val;
}
