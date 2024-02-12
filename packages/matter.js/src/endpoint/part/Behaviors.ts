/**
 * @license
 * Copyright 2022-2023 Project CHIP Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Behavior } from "../../behavior/Behavior.js";
import type { ClusterBehavior } from "../../behavior/cluster/ClusterBehavior.js";
import { ActionContext } from "../../behavior/context/ActionContext.js";
import { OfflineContext } from "../../behavior/context/server/OfflineContext.js";
import { DescriptorServer } from "../../behavior/definitions/descriptor/DescriptorServer.js";
import { BehaviorBacking } from "../../behavior/internal/BehaviorBacking.js";
import { Val } from "../../behavior/state/Val.js";
import { Transaction } from "../../behavior/state/transaction/Transaction.js";
import { Lifecycle, UninitializedDependencyError } from "../../common/Lifecycle.js";
import { ImplementationError, InternalError, ReadOnlyError } from "../../common/MatterError.js";
import { Diagnostic } from "../../log/Diagnostic.js";
import { Logger } from "../../log/Logger.js";
import { MaybePromise } from "../../util/Promises.js";
import { BasicSet } from "../../util/Set.js";
import { camelize, describeList } from "../../util/String.js";
import type { Agent } from "../Agent.js";
import type { Part } from "../Part.js";
import { PartInitializer } from "./PartInitializer.js";
import { PartLifecycle } from "./PartLifecycle.js";
import type { SupportedBehaviors } from "./SupportedBehaviors.js";

const logger = Logger.get("Behaviors");

/**
 * This class manages {@link Behavior} instances owned by a {@link Part}.
 */
export class Behaviors {
    #part: Part;
    #supported: SupportedBehaviors;
    #backings: Record<string, BehaviorBacking> = {};
    #options: Record<string, object | undefined>;
    #initializing?: BasicSet<BehaviorBacking>;

    /**
     * The {@link SupportedBehaviors} of the {@link Part}.
     */
    get supported() {
        return this.#supported;
    }

    get status() {
        const status = {} as Record<string, Lifecycle.Status>;
        for (const key in this.#supported) {
            status[key] = this.#backings[key]?.status ?? Lifecycle.Status.Inactive;
        }
        return status;
    }

    get [Diagnostic.value]() {
        return Diagnostic.lifecycleList(this.status);
    }

    constructor(part: Part, supported: SupportedBehaviors, options: Record<string, object | undefined>) {
        if (typeof supported !== "object") {
            throw new ImplementationError('Part "behaviors" option must be an array of Behavior.Type instances');
        }

        this.#part = part;
        this.#supported = supported;
        this.#options = options;

        // DescriptorBehavior is unequivocally mandatory
        if (!this.#supported.descriptor) {
            this.#supported.descriptor = DescriptorServer;
        }

        for (const id in supported) {
            const type = supported[id];
            if (!(type.prototype instanceof Behavior)) {
                throw new ImplementationError(`${part}.${id}" is not a Behavior.Type`);
            }
            if (typeof type.id !== "string") {
                throw new ImplementationError(`${part}.${id} has no ID`);
            }
            this.#augmentPartShortcuts(type);
        }

        this.#part.lifecycle.reset.on(async () => await this.#factoryReset());
    }

    /**
     * Activate any behaviors designated for immediate activation.  Returns a promise iff any behaviors have ongoing
     * initialization.
     */
    initialize(agent: Agent): MaybePromise {
        for (const type of Object.values(this.supported)) {
            if (type.early) {
                this.activate(type, agent);
            }
        }

        // If all behaviors are initialized then we complete synchronously
        const initializing = this.#initializing;
        if (!initializing?.size) {
            return;
        }

        // Return a promise that fulfills once all behaviors complete initialization
        return new Promise<void>(fulfilled => {
            const initializationListener = () => {
                if (initializing.size === 0) {
                    initializing.deleted.off(initializationListener);
                    fulfilled();
                }
            };

            initializing.deleted.on(initializationListener);
        });
    }

    /**
     * Does the {@link Part} support a specified behavior?
     */
    has<T extends Behavior.Type>(type: T) {
        const myType = this.#supported[type.id];
        return myType === type || myType?.supports(type);
    }

    /**
     * Add behavior support dynamically at runtime.  Typically called via {@link Agent.require}.
     */
    require<T extends Behavior.Type>(type: T, options?: Behavior.Options<T>) {
        if (options) {
            this.#options[type.id] = options;
        }

        if (this.#supported[type.id]) {
            if (!this.has(type)) {
                throw new ImplementationError(
                    `Cannot require ${this.#part}.${type.id} because incompatible implementation already exists`,
                );
            }
            return;
        }

        this.#supported[type.id] = type;

        this.#augmentPartShortcuts(type);

        this.#part.lifecycle.change(PartLifecycle.Change.ServersChanged);

        if (type.early && this.#part.lifecycle.isInstalled) {
            this.#activateLate(type);
        }
    }

    /**
     * Create a behavior synchronously.  Fails if the behavior is not fully initialized.
     */
    createSync(type: Behavior.Type, agent: Agent) {
        const behavior = this.createMaybeAsync(type, agent);

        if (MaybePromise.is(behavior)) {
            throw new ImplementationError(
                `Synchronous access to ${this.#part}.${type.id} is impossible because it is still initializing`,
            );
        }

        return behavior;
    }

    /**
     * True if any behaviors failed to initialized
     */
    get hasCrashed() {
        return Object
            .values(this.#backings)
            .findIndex(behavior => behavior.construction.status === Lifecycle.Status.Crashed) !== -1;
    }

    /**
     * Create a behavior asynchronously.  Waits for the behavior to complete initialization.
     */
    async createAsync(type: Behavior.Type, agent: Agent) {
        return MaybePromise.then(
            () => this.createMaybeAsync(type, agent),
            undefined,
            e => {
                // We log the actual error produced by the backing.  Here we want the error to present as crashed
                // access with a proper stack trace
                const backing = this.#backings[type.id];
                if (!backing) {
                    throw e;
                }
                backing.construction.assert(backing.toString());
            },
        );
    }

    /**
     * Create a behavior, possibly asynchronously.
     *
     * This method returns a {@link Promise} only if await is necessary so the behavior can be used immediately if
     * possible.
     */
    createMaybeAsync(type: Behavior.Type, agent: Agent): MaybePromise<Behavior> {
        this.activate(type, agent);
        let backing = this.#backings[type.id];

        if (!backing.construction.ready) {
            return backing.construction
                .then(() => backing.createBehavior(agent, type))
                .catch(() => {
                    // The backing logs the actual error so here the error should just throw "unavailable due to crash"
                    backing.construction.assert(backing.toString());

                    // Shouldn't get here but catch result type needs to be a behavior
                    return backing.createBehavior(agent, type);
                });
        }

        backing.construction.assert(backing.toString());

        return backing.createBehavior(agent, type);
    }

    /**
     * Activate a behavior.
     *
     * Semantically identical to createAsync() but does not return a {@link Promise} or throw an error.
     *
     * Behaviors that fail initialization will be marked with crashed {@link status}.
     */
    activate(type: Behavior.Type, agent: Agent) {
        let backing = this.#backings[type.id];

        if (!backing) {
            backing = this.#createBacking(type, agent);
        }

        return backing.construction;
    }

    /**
     * Determine if a specified behavior is supported and active.
     */
    isActive(type: Behavior.Type) {
        const backing = this.#backings[type.id];
        return !!backing && backing.type.supports(type);
    }

    /**
     * Destroy all behaviors that are initialized (have backings present).
     */
    async [Symbol.asyncDispose]() {
        const dispose = async (context: ActionContext) => {
            const agent = context.agentFor(this.#part);

            let destroyNow = new Set(Object.keys(this.#backings));
            while (destroyNow.size) {
                for (const key in this.#backings) {
                    const dependencies = this.#backings[key].type.dependencies;

                    if (!dependencies) {
                        continue;
                    }

                    for (const type of dependencies) {
                        destroyNow.delete(type.id);
                    }

                    if (!destroyNow.size) {
                        throw new ImplementationError("Cannot destroy behaviors due to circular dependency");
                    }
                }

                for (const id of destroyNow) {
                    await this.#backings[id].destroy(agent);
                    delete this.#backings[id];
                }

                destroyNow = new Set(Object.keys(this.#backings));
            }

            // Commit any state changes that occurred during destruction
            const transaction = agent.context.transaction;
            if (transaction.status === Transaction.Status.Exclusive) {
                await transaction.commit();
            }
        };

        await OfflineContext.act("dispose-behaviors", dispose, { unversionedVolatiles: true });
    }

    /**
     * Ensure a set of behavior requirements are met.  Throws an error detailing missing requirements.
     */
    validateRequirements(requirements?: SupportedBehaviors) {
        if (!requirements) {
            return;
        }

        const missing = Array<string>();
        for (const requirement of Object.values(requirements)) {
            let name = camelize(requirement.name, true);

            if (this.#part.behaviors.has(requirement)) {
                continue;
            }

            // For ClusterBehaviors, accept any behavior that supports the cluster.  Could confirm features too but
            // doesn't currently
            const cluster = (requirement as ClusterBehavior.Type).cluster;
            if (cluster) {
                const other = this.#part.behaviors.supported[requirement.id];

                if ((other as ClusterBehavior.Type | undefined)?.cluster?.id === cluster.id) {
                    continue;
                }

                name = `${name} (0x${cluster.id.toString(16)})`;
            }

            missing.push(name);
        }

        if (missing.length) {
            throw new ImplementationError(
                `${this.#part} is missing required behaviors: ${describeList("and", ...missing)}`,
            );
        }
    }

    /**
     * Obtain default values for a behavior.  This is state values as present when the behavior is first initialized for
     * a new part.
     */
    defaultsFor(type: Behavior.Type) {
        const options = this.#options[type.id];
        let defaults: Val.Struct | undefined;
        if (options) {
            for (const key in type.defaults) {
                if (key in options) {
                    if (!defaults) {
                        defaults = {};
                    }
                    defaults[key] = (options as Val.Struct)[key];
                }
            }
        }
        return defaults;
    }

    #activateLate(type: Behavior.Type) {
        OfflineContext.act("behavior-late-activation", context => this.activate(type, context.agentFor(this.#part)), {
            unversionedVolatiles: true,
        });
    }

    /**
     * Obtain a backing for a part shortcut.
     */
    #backingFor(container: string, type: Behavior.Type) {
        if (this.#part.construction.status !== Lifecycle.Status.Initializing) {
            this.#part.construction.assert(`Cannot access ${this.#part}.${type.id} because part is`);
        }

        let backing = this.#backings[type.id];
        if (!backing) {
            try {
                this.#activateLate(type);
            } catch (e) {
                logger.warn(`Cannot initialize ${container}.${type.id} until node is initialized: ${e}`);
                throw new UninitializedDependencyError(
                    `${container}.${type.id}`,
                    "is not available until node is initialized, you may await node.construction to avoid this error",
                );
            }
            backing = this.#backings[type.id];
            if (backing === undefined) {
                throw new InternalError(`Behavior ${this.#part}.${type.id} late activation did not create backing`);
            }
        }
        return backing;
    }

    #createBacking(type: Behavior.Type, agent: Agent) {
        // Ensure the type is supported.  If it is, we instantiate with our type rather than the specified type because
        // our type might be an extension
        const myType = this.#getBehaviorType(type);
        if (!myType) {
            throw new ImplementationError(`Request for unsupported behavior ${this.#part}.${type.id}}`);
        }

        const backing = this.#part.env.get(PartInitializer).createBacking(this.#part, myType);
        this.#backings[type.id] = backing;

        this.#initializeBacking(backing, agent);

        return backing;
    }

    #initializeBacking(backing: BehaviorBacking, agent: Agent) {
        backing.initialize(agent);

        // Initialize backing state
        if (!backing.construction.ready) {
            if (!this.#initializing) {
                this.#initializing = new BasicSet();
            }
            this.#initializing.add(backing);

            backing.construction.finally(() => {
                this.#initializing?.delete(backing);
            });
        }

        return backing;
    }

    #getBehaviorType(type: Behavior.Type) {
        const myType = this.#supported[type.id];

        if (myType === undefined) {
            return myType;
        }

        if (typeof myType !== "function" || !(myType.prototype instanceof Behavior)) {
            throw new ImplementationError(`Endpoint behavior "${type.id}" implementation is not a Behavior`);
        }

        return myType;
    }

    #augmentPartShortcuts(type: Behavior.Type) {
        Object.defineProperty(this.#part.state, type.id, {
            get: () => {
                return this.#backingFor("state", type).stateView;
            },

            set() {
                throw new ReadOnlyError();
            },

            enumerable: true,
        });

        Object.defineProperty(this.#part.events, type.id, {
            get: () => {
                return this.#backingFor("events", type).events;
            },

            set() {
                throw new ReadOnlyError();
            },

            enumerable: true,
        });
    }

    async #factoryReset() {
        for (const type of Object.values(this.#supported)) {
            try {
                await this.#part.offline(async agent => {
                    const backing = await this.activate(type, agent);
                    await backing.createBehavior(agent, type)[Symbol.asyncDispose]();
                    await backing.factoryReset();
                });
            } catch (e) {
                logger.error(`Error during factory reset of ${this.#part}.${type.id}:`, e);
            }
            delete this.#backings[type.id];
        }
    }
}
