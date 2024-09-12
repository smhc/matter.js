/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { MaybePromise } from "@project-chip/matter.js-general";
import { ValveConfigurationAndControl } from "../../../cluster/definitions/ValveConfigurationAndControlCluster.js";

export namespace ValveConfigurationAndControlInterface {
    export interface Base {
        /**
         * This command is used to set the valve to its open position.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 4.6.8.1
         */
        open(request: ValveConfigurationAndControl.OpenRequest): MaybePromise;

        /**
         * This command is used to set the valve to its closed position.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 4.6.8.2
         */
        close(): MaybePromise;
    }
}

export type ValveConfigurationAndControlInterface = {
    components: [{ flags: {}, methods: ValveConfigurationAndControlInterface.Base }]
};
