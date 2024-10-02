/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Time } from "#time/Time.js";
import { Logger } from "../log/Logger.js";
import { createPromise } from "./Promises.js";

const logger = Logger.get("PromiseQueue");

/**
 * A queue that processes promises with a given concurrency and delays after each promise if desired.
 */
export class PromiseQueue {
    readonly #delay: number;
    readonly #queue = new Array<{ func: () => Promise<any>; rejecter: (reason?: any) => void }>();
    readonly #concurrency: number;
    #runningCount = 0;

    constructor(concurrency = 1, delay = 0) {
        this.#concurrency = concurrency;
        this.#delay = delay;
    }

    /**
     * Add a promise to the queue. It returns a promise that ca be awaited.
     */
    add<T>(executor: () => Promise<T>): Promise<T> {
        const { promise, resolver, rejecter } = createPromise<T>();

        logger.debug("Add promise to queue on place", this.#queue.length + 1);
        this.#queue.push({
            func: () =>
                executor()
                    .then(value => {
                        resolver(value);
                    })
                    .catch(reason => {
                        rejecter(reason);
                    }),
            rejecter,
        });
        this.#run();
        return promise;
    }

    /**
     * Run the next promise in the queue.
     */
    #run(): void {
        if (this.#runningCount >= this.#concurrency || this.#queue.length === 0) {
            return;
        }

        logger.debug(
            "Processing promise from queue ... Current queue length:",
            this.#queue.length,
            "Already running:",
            this.#runningCount,
        );
        const { func } = this.#queue.shift() ?? {};
        if (func !== undefined) {
            this.#runningCount++;
            func().finally(async () => {
                logger.debug("Promise processed ... Still running:", this.#runningCount - 1);
                if (this.#delay > 0) {
                    // Keep the queue blocked for the delay time
                    await Time.sleep("Queue delay", this.#delay);
                }
                this.#runningCount--;
                this.#run();
            });
        }
    }

    /**
     * Clear the queue.
     */
    clear(reject: boolean): void {
        if (reject) {
            for (const { rejecter } of this.#queue) {
                rejecter();
            }
        }
        this.#queue.length = 0;
    }

    /**
     * Close the queue and remove all outstanding promises (but do not reject them).
     */
    close(): void {
        this.clear(false);
    }
}