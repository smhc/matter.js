[@project-chip/matter.js](../README.md) / [Modules](../modules.md) / [cluster/export](../modules/cluster_export.md) / CommandServer

# Class: CommandServer<RequestT, ResponseT\>

[cluster/export](../modules/cluster_export.md).CommandServer

## Type parameters

| Name |
| :------ |
| `RequestT` |
| `ResponseT` |

## Table of contents

### Constructors

- [constructor](cluster_export.CommandServer.md#constructor)

### Properties

- [handler](cluster_export.CommandServer.md#handler)
- [invokeId](cluster_export.CommandServer.md#invokeid)
- [name](cluster_export.CommandServer.md#name)
- [requestSchema](cluster_export.CommandServer.md#requestschema)
- [requiresTimedInteraction](cluster_export.CommandServer.md#requirestimedinteraction)
- [responseId](cluster_export.CommandServer.md#responseid)
- [responseSchema](cluster_export.CommandServer.md#responseschema)

### Methods

- [invoke](cluster_export.CommandServer.md#invoke)

## Constructors

### constructor

• **new CommandServer**<`RequestT`, `ResponseT`\>(`invokeId`, `responseId`, `name`, `requestSchema`, `responseSchema`, `requiresTimedInteraction`, `handler`)

#### Type parameters

| Name |
| :------ |
| `RequestT` |
| `ResponseT` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `invokeId` | [`CommandId`](../modules/datatype_export.md#commandid) |
| `responseId` | [`CommandId`](../modules/datatype_export.md#commandid) |
| `name` | `string` |
| `requestSchema` | [`TlvSchema`](tlv_export.TlvSchema.md)<`RequestT`\> |
| `responseSchema` | [`TlvSchema`](tlv_export.TlvSchema.md)<`ResponseT`\> |
| `requiresTimedInteraction` | `boolean` |
| `handler` | (`request`: `RequestT`, `session`: [`Session`](../interfaces/session_export.Session.md)<[`MatterDevice`](export._internal_.MatterDevice.md)\>, `message`: [`Message`](../interfaces/codec_export.Message.md), `endpoint`: [`Endpoint`](device_export.Endpoint.md)) => `ResponseT` \| `Promise`<`ResponseT`\> |

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:19

## Properties

### handler

• `Protected` `Readonly` **handler**: (`request`: `RequestT`, `session`: [`Session`](../interfaces/session_export.Session.md)<[`MatterDevice`](export._internal_.MatterDevice.md)\>, `message`: [`Message`](../interfaces/codec_export.Message.md), `endpoint`: [`Endpoint`](device_export.Endpoint.md)) => `ResponseT` \| `Promise`<`ResponseT`\>

#### Type declaration

▸ (`request`, `session`, `message`, `endpoint`): `ResponseT` \| `Promise`<`ResponseT`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `request` | `RequestT` |
| `session` | [`Session`](../interfaces/session_export.Session.md)<[`MatterDevice`](export._internal_.MatterDevice.md)\> |
| `message` | [`Message`](../interfaces/codec_export.Message.md) |
| `endpoint` | [`Endpoint`](device_export.Endpoint.md) |

##### Returns

`ResponseT` \| `Promise`<`ResponseT`\>

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:26

___

### invokeId

• `Readonly` **invokeId**: [`CommandId`](../modules/datatype_export.md#commandid)

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:20

___

### name

• `Readonly` **name**: `string`

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:22

___

### requestSchema

• `Readonly` **requestSchema**: [`TlvSchema`](tlv_export.TlvSchema.md)<`RequestT`\>

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:23

___

### requiresTimedInteraction

• `Readonly` **requiresTimedInteraction**: `boolean`

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:25

___

### responseId

• `Readonly` **responseId**: [`CommandId`](../modules/datatype_export.md#commandid)

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:21

___

### responseSchema

• `Readonly` **responseSchema**: [`TlvSchema`](tlv_export.TlvSchema.md)<`ResponseT`\>

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:24

## Methods

### invoke

▸ **invoke**(`session`, `args`, `message`, `endpoint`): `Promise`<{ `clusterCode?`: `number` ; `code`: [`StatusCode`](../enums/protocol_interaction_export.StatusCode.md) ; `response`: [`TlvStream`](../modules/tlv_export.md#tlvstream) ; `responseId`: [`CommandId`](../modules/datatype_export.md#commandid)  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `session` | [`Session`](../interfaces/session_export.Session.md)<[`MatterDevice`](export._internal_.MatterDevice.md)\> |
| `args` | [`TlvStream`](../modules/tlv_export.md#tlvstream) |
| `message` | [`Message`](../interfaces/codec_export.Message.md) |
| `endpoint` | [`Endpoint`](device_export.Endpoint.md) |

#### Returns

`Promise`<{ `clusterCode?`: `number` ; `code`: [`StatusCode`](../enums/protocol_interaction_export.StatusCode.md) ; `response`: [`TlvStream`](../modules/tlv_export.md#tlvstream) ; `responseId`: [`CommandId`](../modules/datatype_export.md#commandid)  }\>

#### Defined in

packages/matter.js/src/cluster/server/CommandServer.ts:34