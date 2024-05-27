/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccessLevel } from "../cluster/Cluster.js";
import { ClusterId } from "../datatype/ClusterId.js";
import { FabricIndex } from "../datatype/FabricIndex.js";
import { SubjectId } from "../datatype/SubjectId.js";
import { DataModelPath } from "../endpoint/DataModelPath.js";
import { Access } from "../model/aspects/index.js";
import { ElementTag } from "../model/index.js";
import { ValueModel } from "../model/models/index.js";
import { StatusCode } from "../protocol/interaction/StatusCode.js";
import { InvokeError, ReadError, SchemaImplementationError, WriteError } from "./errors.js";
import { Schema } from "./supervision/Schema.js";

const cache = new WeakMap<Schema, AccessControl>();

/**
 * Enforces access control for a specific schema.
 */
export interface AccessControl {
    /**
     * Operational access control metadata.
     */
    limits: AccessControl.Limits;

    /**
     * Assert read is authorized.
     */
    authorizeRead: AccessControl.Assertion;

    /**
     * Determine if read is authorized.
     */
    mayRead: AccessControl.Verification;

    /**
     * Assert write is authorized.
     */
    authorizeWrite: AccessControl.Assertion;

    /**
     * Determine if write is authorized.
     */
    mayWrite: AccessControl.Verification;

    /**
     * Assert invoke is authorized.
     */
    authorizeInvoke: AccessControl.Assertion;

    /**
     * Determine if invoke is authorized.
     */
    mayInvoke: AccessControl.Verification;
}

/**
 * Obtain an enforcer for specific schema.
 *
 * This is central to security.  Implementation is explicit, all objects are involved are frozen and cache is stored as
 * module-private.
 *
 * Pure function; returned value is cached.
 */
export function AccessControl(schema: Schema) {
    let enforcer = cache.get(schema);
    if (enforcer === undefined) {
        enforcer = enforcerFor(schema);
    }
    return enforcer;
}

export namespace AccessControl {
    /**
     * Operational access control metadata for a schema.
     */
    export interface Limits {
        readonly readable: boolean;
        readonly readLevel: AccessLevel;

        readonly writable: boolean;
        readonly writeLevel: AccessLevel;

        readonly fabricScoped: boolean;
        readonly fabricSensitive: boolean;

        readonly timed: boolean;
    }

    /**
     * A function that asserts access control requirements are met.
     */
    export type Assertion = (session: Session, location: Location) => void;

    /**
     * A function that returns true if access control requirements are met.
     */
    export type Verification = (session: Session, location: Location) => boolean;

    /**
     * Metadata that varies with position in the data model.
     */
    export interface Location {
        /**
         * The diagnostic path to the location.
         */
        path: DataModelPath;

        /**
         * The owning behavior.
         */
        cluster?: ClusterId;

        /**
         * The fabric that owns the data subtree.  Undefined or {@link FabricIndex.NO_FABRIC} disables fabric
         * enforcement.
         */
        owningFabric?: FabricIndex;

        /**
         * The access levels already retrieved for this location. With this subtree elements can access the same
         * access levels without re-evaluating.
         */
        accessLevels?: AccessLevel[];
    }

    /**
     * Authorization metadata that varies with session.
     */
    export interface Session {
        /**
         * Checks if the authorized client has a certain Access Privilege granted.
         */
        authorizedFor(desiredAccessLevel: AccessLevel, location?: Location): boolean;

        /**
         * The fabric of the authorized client.
         */
        readonly fabric?: FabricIndex;

        /**
         * The authenticated {@link SubjectId} for online sessions.
         */
        readonly subject?: SubjectId;

        /**
         * If this is true, fabric-scoped lists are filtered to the accessing
         * fabric.
         */
        readonly fabricFiltered?: boolean;

        /**
         * If this is true a timed transaction is in effect.
         */
        readonly timed?: boolean;

        /**
         * If this is true then data access levels are not enforced.  Datatypes and command-related access controls are
         * active.
         */
        readonly command?: boolean;

        /**
         * If this is true then access levels are not enforced and all values are read/write.  Datatypes are still
         * enforced.
         *
         * Tracks "offline" rather than "online" because this makes the safer mode (full enforcement) the default.
         */
        offline?: boolean;
    }
}

Object.freeze(AccessControl);

function enforcerFor(schema: Schema): AccessControl {
    if (schema.tag === ElementTag.Command) {
        return commandEnforcerFor(schema);
    }
    return dataEnforcerFor(schema);
}

function dataEnforcerFor(schema: Schema): AccessControl {
    const limits = limitsFor(schema);

    let mayRead: AccessControl.Verification = (session, location) => {
        if (session.offline || session.command) {
            return true;
        }

        return session.authorizedFor(limits.readLevel, location);
    };

    let mayWrite: AccessControl.Verification = (session, location) => {
        if (session.offline || session.command) {
            return true;
        }

        return session.authorizedFor(limits.writeLevel, location);
    };

    let authorizeRead: AccessControl.Assertion = (session, location) => {
        if (session.offline || session.command) {
            return;
        }

        if (session.authorizedFor(limits.readLevel, location)) {
            return;
        }

        throw new ReadError(location, "Permission denied", StatusCode.UnsupportedAccess);
    };

    let authorizeWrite: AccessControl.Assertion = (session, location) => {
        if (session.offline || session.command) {
            return;
        }

        if (session.authorizedFor(limits.writeLevel, location)) {
            return;
        }

        throw new WriteError(location, "Permission denied", StatusCode.UnsupportedAccess);
    };

    if (limits.timed) {
        const wrappedAuthorizeWrite = authorizeWrite;
        const wrappedMayWrite = mayWrite;

        authorizeWrite = (session, location) => {
            if (!session.offline && !session.timed) {
                throw new WriteError(
                    location,
                    "Permission denied because interaction is not timed",
                    StatusCode.NeedsTimedInteraction,
                );
            }
            wrappedAuthorizeWrite?.(session, location);
        };

        mayWrite = (session, location) => {
            if (!session.offline && !session.timed) {
                return false;
            }

            return wrappedMayWrite(session, location);
        };
    }

    if (limits.fabricSensitive) {
        const wrappedAuthorizeRead = authorizeRead;
        const wrappedMayRead = mayRead;
        const wrappedAuthorizeWrite = authorizeWrite;
        const wrappedMayWrite = mayWrite;

        authorizeRead = (session, location) => {
            if (session.offline || session.command) {
                return;
            }

            if (session.fabricFiltered) {
                if (session.fabric === undefined) {
                    throw new ReadError(
                        location,
                        "Permission denied: No accessing fabric",
                        StatusCode.UnsupportedAccess,
                    );
                }

                if (location?.owningFabric && location.owningFabric !== session.fabric) {
                    throw new WriteError(
                        location,
                        "Permission denied: Owning/accessing fabric mismatch",
                        StatusCode.UnsupportedAccess,
                    );
                }
            }

            wrappedAuthorizeRead(session, location);
        };

        mayRead = (session, location) => {
            if (session.offline || session.command) {
                return true;
            }

            if (session.fabric === undefined) {
                return false;
            }

            if (session.fabricFiltered && location?.owningFabric && location.owningFabric !== session.fabric) {
                return false;
            }

            return wrappedMayRead(session, location);
        };

        authorizeWrite = (session, location) => {
            if (session.offline || session.command) {
                return;
            }

            if (session.fabric === undefined) {
                throw new WriteError(location, "Permission denied: No accessing fabric", StatusCode.UnsupportedAccess);
            }

            if (location?.owningFabric && location.owningFabric !== session.fabric) {
                throw new WriteError(location, "Permission denied: Owning/accessing fabric mismatch");
            }

            wrappedAuthorizeWrite(session, location);
        };

        mayWrite = (session, location) => {
            if (session.offline || session.command) {
                return true;
            }

            if (session.fabric === undefined) {
                return false;
            }

            if (location?.owningFabric && location.owningFabric !== session.fabric) {
                return false;
            }

            return wrappedMayWrite(session, location);
        };
    }

    if (!limits.readable) {
        authorizeRead = (session, location) => {
            if (session.offline || session.command) {
                return;
            }

            throw new ReadError(location, "Permission defined: Value is write-only");
        };

        mayRead = session => {
            return !!session.offline || !!session.command;
        };
    }

    if (!limits.writable) {
        authorizeWrite = (session, location) => {
            if (session.offline || session.command) {
                return;
            }
            throw new WriteError(location, "Permission denied: Value is read-only");
        };

        mayWrite = session => {
            return !!session.offline || !!session.command;
        };
    }

    return Object.freeze({
        limits,
        authorizeRead,
        mayRead,
        authorizeWrite,
        mayWrite,

        authorizeInvoke(_session: AccessControl.Session, location: AccessControl.Location) {
            throw new SchemaImplementationError(location, "Permission denied: Invoke request but non-command schema");
        },

        mayInvoke() {
            return false;
        },
    } satisfies AccessControl);
}

function commandEnforcerFor(schema: Schema): AccessControl {
    const limits = limitsFor(schema);
    const timed = schema.effectiveAccess.timed;
    const fabric = schema.effectiveAccess.fabric;

    return {
        limits,

        authorizeRead(_session, location) {
            throw new SchemaImplementationError(location, "Permission denied: Read request but command schema");
        },

        mayRead() {
            return false;
        },

        authorizeWrite(_session, location) {
            throw new SchemaImplementationError(location, "Permission denied: Write request but command schema");
        },

        mayWrite() {
            return false;
        },

        authorizeInvoke(session, location) {
            if (session.offline) {
                return;
            }

            if (!session.command) {
                throw new InvokeError(location, "Invoke attempt without command context");
            }

            if (timed && !session.timed) {
                throw new InvokeError(
                    location,
                    "Invoke attempt without required timed context",
                    StatusCode.TimedRequestMismatch,
                );
            }

            if (fabric && session.fabric === undefined) {
                throw new WriteError(location, "Permission denied: No accessing fabric", StatusCode.UnsupportedAccess);
            }

            if (session.authorizedFor(limits.writeLevel, location)) {
                return;
            }

            throw new InvokeError(location, "Permission denied", StatusCode.UnsupportedAccess);
        },

        mayInvoke(session, location) {
            if (session.offline) {
                return true;
            }

            if (!session.command) {
                return false;
            }

            if (timed && !session.timed) {
                return false;
            }

            if (fabric && session.fabric === undefined) {
                return false;
            }

            return session.authorizedFor(limits.writeLevel, location);
        },
    };
}

function limitsFor(schema: Schema) {
    const access = schema.effectiveAccess;
    const quality = schema instanceof ValueModel ? schema.effectiveQuality : undefined;

    // Special handling for fixed values - we treat any property owned by a fixed value as also read-only
    let fixed = quality?.fixed;
    for (let s = schema.parent; !fixed && s instanceof ValueModel; s = s.parent) {
        if (s.effectiveQuality.fixed) {
            fixed = true;
        }
    }

    const limits: AccessControl.Limits = Object.freeze({
        readable: access.readable,
        writable: access.writable && !fixed,
        fabricScoped: access.fabric === Access.Fabric.Scoped || access.fabric === Access.Fabric.Sensitive,
        fabricSensitive: access.fabric === Access.Fabric.Sensitive,
        timed: access.timed === true,

        // Official Matter defaults are View for read and Operate for write. However, the schema's effective access
        // should already have these defaults.  Here we just adopt minimum needed rights as a safe fallback access level.
        readLevel: access.readPriv === undefined ? AccessLevel.View : Access.PrivilegeLevel[access.readPriv],
        writeLevel: access.writePriv === undefined ? AccessLevel.Operate : Access.PrivilegeLevel[access.writePriv],
    });

    return limits;
}
