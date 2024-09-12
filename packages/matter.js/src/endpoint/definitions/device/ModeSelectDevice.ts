/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ModeSelectServer as BaseModeSelectServer } from "../../../behavior/definitions/mode-select/ModeSelectServer.js";
import { MutableEndpoint } from "../../type/MutableEndpoint.js";
import { SupportedBehaviors } from "../../properties/SupportedBehaviors.js";
import { Identity } from "@project-chip/matter.js-general";

/**
 * This defines conformance to the Mode Select device type.
 *
 * @see {@link MatterSpecification.v13.Device} § 11.1
 */
export interface ModeSelectDevice extends Identity<typeof ModeSelectDeviceDefinition> {}

export namespace ModeSelectRequirements {
    /**
     * The ModeSelect cluster is required by the Matter specification.
     *
     * We provide this alias to the default implementation {@link ModeSelectServer} for convenience.
     */
    export const ModeSelectServer = BaseModeSelectServer;

    /**
     * An implementation for each server cluster supported by the endpoint per the Matter specification.
     */
    export const server = { mandatory: { ModeSelect: ModeSelectServer } };
}

export const ModeSelectDeviceDefinition = MutableEndpoint({
    name: "ModeSelect",
    deviceType: 0x27,
    deviceRevision: 1,
    requirements: ModeSelectRequirements,
    behaviors: SupportedBehaviors(ModeSelectRequirements.server.mandatory.ModeSelect)
});

export const ModeSelectDevice: ModeSelectDevice = ModeSelectDeviceDefinition;
