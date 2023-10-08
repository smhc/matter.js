[@project-chip/matter.js](../README.md) / [Modules](../modules.md) / net/export

# Module: net/export

## Table of contents

### Classes

- [Network](../classes/net_export.Network.md)
- [NetworkError](../classes/net_export.NetworkError.md)
- [NetworkFake](../classes/net_export.NetworkFake.md)
- [SimulatedNetwork](../classes/net_export.SimulatedNetwork.md)
- [UdpChannelFake](../classes/net_export.UdpChannelFake.md)
- [UdpInterface](../classes/net_export.UdpInterface.md)
- [UdpMulticastServer](../classes/net_export.UdpMulticastServer.md)

### Interfaces

- [NetInterface](../interfaces/net_export.NetInterface.md)
- [UdpChannel](../interfaces/net_export.UdpChannel.md)
- [UdpChannelOptions](../interfaces/net_export.UdpChannelOptions.md)
- [UdpMulticastServerOptions](../interfaces/net_export.UdpMulticastServerOptions.md)

### Type Aliases

- [ListenerFunc](net_export.md#listenerfunc)

### Variables

- [FAKE\_INTERFACE\_NAME](net_export.md#fake_interface_name)

### Functions

- [isNetworkInterface](net_export.md#isnetworkinterface)

## Type Aliases

### ListenerFunc

Ƭ **ListenerFunc**: (`netInterface`: `string`, `peerAddress`: `string`, `peerPort`: `number`, `data`: [`ByteArray`](util_export.md#bytearray-1)) => `void`

#### Type declaration

▸ (`netInterface`, `peerAddress`, `peerPort`, `data`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `netInterface` | `string` |
| `peerAddress` | `string` |
| `peerPort` | `number` |
| `data` | [`ByteArray`](util_export.md#bytearray-1) |

##### Returns

`void`

#### Defined in

packages/matter.js/src/net/fake/SimulatedNetwork.ts:12

## Variables

### FAKE\_INTERFACE\_NAME

• `Const` **FAKE\_INTERFACE\_NAME**: ``"fakeInterface"``

#### Defined in

packages/matter.js/src/net/fake/SimulatedNetwork.ts:16

## Functions

### isNetworkInterface

▸ **isNetworkInterface**(`obj`): obj is NetInterface

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | [`TransportInterface`](../interfaces/common_export.TransportInterface.md) \| [`NetInterface`](../interfaces/net_export.NetInterface.md) |

#### Returns

obj is NetInterface

#### Defined in

packages/matter.js/src/net/NetInterface.ts:19