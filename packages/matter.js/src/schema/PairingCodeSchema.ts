/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { UnexpectedDataError } from "../common/MatterError.js";
import { VendorId } from "../datatype/VendorId.js";
import { Verhoeff } from "../math/Verhoeff.js";
import { ByteArray } from "../util/ByteArray.js";
import { Base38 } from "./Base38Schema.js";
import {
    BitField,
    BitFieldEnum,
    BitFlag,
    BitmapSchema,
    ByteArrayBitmapSchema,
    TypeFromBitmapSchema,
} from "./BitmapSchema.js";
import { Schema } from "./Schema.js";

/** See {@link MatterSpecification.v13.Core} § 5.1.3.1 Table 38 */
export enum CommissioningFlowType {
    /** When not commissioned, the device always enters commissioning mode upon power-up. */
    Standard = 0,

    /** User action required to enter commissioning mode. */
    UserIntent = 1,

    /** Interaction with a vendor-specified means is needed before commissioning. */
    Custom = 2,
}

/** See {@link MatterSpecification.v13.Core} § 5.1.3.1 Table 39 */
export const DiscoveryCapabilitiesBitmap = {
    /** Device supports BLE for discovery when not commissioned. */
    ble: BitFlag(1),

    /** Device is already on the IP network. */
    onIpNetwork: BitFlag(2),
};
export const DiscoveryCapabilitiesSchema = BitmapSchema(DiscoveryCapabilitiesBitmap);

/** See {@link MatterSpecification.v13.Core} § 5.1.3.1 Table 38 */
const QrCodeDataSchema = ByteArrayBitmapSchema({
    version: BitField(0, 3),
    vendorId: BitField(3, 16),
    productId: BitField(19, 16),
    flowType: BitFieldEnum<CommissioningFlowType>(35, 2),
    discoveryCapabilities: BitField(37, 8),
    discriminator: BitField(45, 12),
    passcode: BitField(57, 27),
});
export type QrCodeData = TypeFromBitmapSchema<typeof QrCodeDataSchema> & {
    /**
     * See {@link MatterSpecification.v13.Core} § 5.1.5
     * Variable length TLV data. Zero length if TLV is not included. This data is byte-aligned.
     * All elements SHALL be housed within an anonymous top-level structure container.
     */
    tlvData?: ByteArray;
};

const PREFIX = "MT:";

class QrPairingCodeSchema extends Schema<QrCodeData, string> {
    protected encodeInternal(payloadData: QrCodeData): string {
        const { tlvData } = payloadData;
        const data =
            tlvData !== undefined && tlvData.length > 0
                ? ByteArray.concat(QrCodeDataSchema.encode(payloadData), tlvData)
                : QrCodeDataSchema.encode(payloadData);
        return PREFIX + Base38.encode(data);
    }

    protected decodeInternal(encoded: string): QrCodeData {
        if (!encoded.startsWith(PREFIX)) throw new UnexpectedDataError("The pairing code should start with MT:");
        const data = Base38.decode(encoded.slice(PREFIX.length));
        return {
            ...QrCodeDataSchema.decode(data.slice(0, 11)),
            tlvData: data.length > 11 ? data.slice(11) : undefined, // TlvData (if any) is after the fixed-length data
        };
    }
}

export const QrPairingCodeCodec = new QrPairingCodeSchema();

export type ManualPairingData = {
    discriminator?: number;
    shortDiscriminator?: number;
    passcode: number;
    vendorId?: VendorId;
    productId?: number;
};

/** See {@link MatterSpecification.v10.Core} § 5.1.4.1 Table 38/39/40 */
class ManualPairingCodeSchema extends Schema<ManualPairingData, string> {
    protected encodeInternal({ discriminator, passcode, vendorId, productId }: ManualPairingData): string {
        if (discriminator === undefined) throw new UnexpectedDataError("discriminator is required");
        if (discriminator > 4095) throw new UnexpectedDataError("discriminator value must be less than 4096");
        let result = "";
        const hasVendorProductIds = vendorId !== undefined && productId !== undefined;
        result += (discriminator >> 10) | (hasVendorProductIds ? 1 << 2 : 0);
        result += (((discriminator & 0x300) << 6) | (passcode & 0x3fff)).toString().padStart(5, "0");
        result += (passcode >> 14).toString().padStart(4, "0");
        if (hasVendorProductIds) {
            result += vendorId.toString().padStart(5, "0");
            result += productId.toString().padStart(5, "0");
        }
        result += new Verhoeff().computeChecksum(result);
        return result;
    }

    protected decodeInternal(encoded: string): ManualPairingData {
        encoded = encoded.replace(/[^0-9]/g, ""); // we SHALL be robust against other characters
        if (encoded.length !== 11 && encoded.length != 21) {
            throw new UnexpectedDataError("Invalid pairing code");
        }
        if (new Verhoeff().computeChecksum(encoded.slice(0, -1)) !== parseInt(encoded.slice(-1))) {
            throw new UnexpectedDataError("Invalid checksum");
        }
        const hasVendorProductIds = !!(parseInt(encoded[0]) & (1 << 2));
        const shortDiscriminator = ((parseInt(encoded[0]) & 0x03) << 2) | ((parseInt(encoded.slice(1, 6)) >> 14) & 0x3);
        const passcode = (parseInt(encoded.slice(1, 6)) & 0x3fff) | (parseInt(encoded.slice(6, 10)) << 14);
        let vendorId: VendorId | undefined;
        let productId: number | undefined;
        if (hasVendorProductIds) {
            vendorId = VendorId(parseInt(encoded.slice(10, 15)));
            productId = parseInt(encoded.slice(15, 20));
        }
        return { shortDiscriminator, passcode, vendorId, productId };
    }
}

export const ManualPairingCodeCodec = new ManualPairingCodeSchema();
