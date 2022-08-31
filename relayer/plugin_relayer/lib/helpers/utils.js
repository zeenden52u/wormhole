"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetaplexData = exports.getMetadataAddress = exports.decodeMetadata = exports.extendBorsh = exports.METADATA_SCHEMA = exports.EditionMarker = exports.Metadata = exports.Creator = exports.Edition = exports.MasterEditionV2 = exports.MasterEditionV1 = exports.Data = exports.METADATA_PROGRAM_ID = exports.MetadataKey = exports.sleep = exports.EDITION = exports.METADATA_PREFIX = exports.EDITION_MARKER_BIT_SIZE = exports.METADATA_REPLACE = void 0;
const web3_js_1 = require("@solana/web3.js");
const borsh_1 = require("borsh");
const borsh_2 = require("borsh");
const solana_1 = require("../utils/solana");
const base58 = require("bs58");
// eslint-disable-next-line
exports.METADATA_REPLACE = new RegExp("\u0000", "g");
exports.EDITION_MARKER_BIT_SIZE = 248;
exports.METADATA_PREFIX = "metadata";
exports.EDITION = "edition";
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
var MetadataKey;
(function (MetadataKey) {
    MetadataKey[MetadataKey["Uninitialized"] = 0] = "Uninitialized";
    MetadataKey[MetadataKey["MetadataV1"] = 4] = "MetadataV1";
    MetadataKey[MetadataKey["EditionV1"] = 1] = "EditionV1";
    MetadataKey[MetadataKey["MasterEditionV1"] = 2] = "MasterEditionV1";
    MetadataKey[MetadataKey["MasterEditionV2"] = 6] = "MasterEditionV2";
    MetadataKey[MetadataKey["EditionMarker"] = 7] = "EditionMarker";
})(MetadataKey = exports.MetadataKey || (exports.MetadataKey = {}));
exports.METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
class Data {
    name;
    symbol;
    uri;
    // sellerFeeBasisPoints: number;
    // creators: Creator[] | null;
    constructor(args) {
        this.name = args.name;
        this.symbol = args.symbol;
        this.uri = args.uri;
        // this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
        // this.creators = args.creators;
    }
}
exports.Data = Data;
class CreateMetadataArgs {
    instruction = 0;
    data;
    isMutable;
    constructor(args) {
        this.data = args.data;
        this.isMutable = args.isMutable;
    }
}
class UpdateMetadataArgs {
    instruction = 1;
    data;
    // Not used by this app, just required for instruction
    updateAuthority;
    primarySaleHappened;
    constructor(args) {
        this.data = args.data ? args.data : null;
        this.updateAuthority = args.updateAuthority ? args.updateAuthority : null;
        this.primarySaleHappened = args.primarySaleHappened;
    }
}
class CreateMasterEditionArgs {
    instruction = 10;
    maxSupply;
    constructor(args) {
        this.maxSupply = args.maxSupply;
    }
}
class MintPrintingTokensArgs {
    instruction = 9;
    supply;
    constructor(args) {
        this.supply = args.supply;
    }
}
class MasterEditionV1 {
    key;
    supply;
    maxSupply;
    /// Can be used to mint tokens that give one-time permission to mint a single limited edition.
    printingMint;
    /// If you don't know how many printing tokens you are going to need, but you do know
    /// you are going to need some amount in the future, you can use a token from this mint.
    /// Coming back to token metadata with one of these tokens allows you to mint (one time)
    /// any number of printing tokens you want. This is used for instance by Auction Manager
    /// with participation NFTs, where we dont know how many people will bid and need participation
    /// printing tokens to redeem, so we give it ONE of these tokens to use after the auction is over,
    /// because when the auction begins we just dont know how many printing tokens we will need,
    /// but at the end we will. At the end it then burns this token with token-metadata to
    /// get the printing tokens it needs to give to bidders. Each bidder then redeems a printing token
    /// to get their limited editions.
    oneTimePrintingAuthorizationMint;
    constructor(args) {
        this.key = MetadataKey.MasterEditionV1;
        this.supply = args.supply;
        this.maxSupply = args.maxSupply;
        this.printingMint = args.printingMint;
        this.oneTimePrintingAuthorizationMint =
            args.oneTimePrintingAuthorizationMint;
    }
}
exports.MasterEditionV1 = MasterEditionV1;
class MasterEditionV2 {
    key;
    supply;
    maxSupply;
    constructor(args) {
        this.key = MetadataKey.MasterEditionV2;
        this.supply = args.supply;
        this.maxSupply = args.maxSupply;
    }
}
exports.MasterEditionV2 = MasterEditionV2;
class Edition {
    key;
    /// Points at MasterEdition struct
    parent;
    /// Starting at 0 for master record, this is incremented for each edition minted.
    edition;
    constructor(args) {
        this.key = MetadataKey.EditionV1;
        this.parent = args.parent;
        this.edition = args.edition;
    }
}
exports.Edition = Edition;
class Creator {
    address;
    verified;
    share;
    constructor(args) {
        this.address = args.address;
        this.verified = args.verified;
        this.share = args.share;
    }
}
exports.Creator = Creator;
class Metadata {
    key;
    updateAuthority;
    mint;
    data;
    primarySaleHappened;
    isMutable;
    editionNonce;
    // set lazy
    masterEdition;
    edition;
    constructor(args) {
        this.key = MetadataKey.MetadataV1;
        this.updateAuthority = args.updateAuthority;
        this.mint = args.mint;
        this.data = args.data;
        this.primarySaleHappened = args.primarySaleHappened;
        this.isMutable = args.isMutable;
        this.editionNonce = args.editionNonce;
    }
    async init() {
        // const edition = await getEdition(this.mint);
        const edition = "0";
        this.edition = edition;
        this.masterEdition = edition;
    }
}
exports.Metadata = Metadata;
class EditionMarker {
    key;
    ledger;
    constructor(args) {
        this.key = MetadataKey.EditionMarker;
        this.ledger = args.ledger;
    }
    editionTaken(edition) {
        const editionOffset = edition % exports.EDITION_MARKER_BIT_SIZE;
        const indexOffset = Math.floor(editionOffset / 8);
        if (indexOffset > 30) {
            throw new Error("bad index for edition");
        }
        const positionInBitsetFromRight = 7 - (editionOffset % 8);
        const mask = Math.pow(2, positionInBitsetFromRight);
        const appliedMask = this.ledger[indexOffset] & mask;
        // eslint-disable-next-line
        return appliedMask != 0;
    }
}
exports.EditionMarker = EditionMarker;
exports.METADATA_SCHEMA = new Map([
    [
        CreateMetadataArgs,
        {
            kind: "struct",
            fields: [
                ["instruction", "u8"],
                ["data", Data],
                ["isMutable", "u8"], // bool
            ],
        },
    ],
    [
        UpdateMetadataArgs,
        {
            kind: "struct",
            fields: [
                ["instruction", "u8"],
                ["data", { kind: "option", type: Data }],
                ["updateAuthority", { kind: "option", type: "pubkeyAsString" }],
                ["primarySaleHappened", { kind: "option", type: "u8" }],
            ],
        },
    ],
    [
        CreateMasterEditionArgs,
        {
            kind: "struct",
            fields: [
                ["instruction", "u8"],
                ["maxSupply", { kind: "option", type: "u64" }],
            ],
        },
    ],
    [
        MintPrintingTokensArgs,
        {
            kind: "struct",
            fields: [
                ["instruction", "u8"],
                ["supply", "u64"],
            ],
        },
    ],
    [
        MasterEditionV1,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["supply", "u64"],
                ["maxSupply", { kind: "option", type: "u64" }],
                ["printingMint", "pubkeyAsString"],
                ["oneTimePrintingAuthorizationMint", "pubkeyAsString"],
            ],
        },
    ],
    [
        MasterEditionV2,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["supply", "u64"],
                ["maxSupply", { kind: "option", type: "u64" }],
            ],
        },
    ],
    [
        Edition,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["parent", "pubkeyAsString"],
                ["edition", "u64"],
            ],
        },
    ],
    [
        Data,
        {
            kind: "struct",
            fields: [
                ["name", "string"],
                ["symbol", "string"],
                ["uri", "string"],
                ["sellerFeeBasisPoints", "u16"],
                ["creators", { kind: "option", type: [Creator] }],
            ],
        },
    ],
    [
        Creator,
        {
            kind: "struct",
            fields: [
                ["address", "pubkeyAsString"],
                ["verified", "u8"],
                ["share", "u8"],
            ],
        },
    ],
    [
        Metadata,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["updateAuthority", "pubkeyAsString"],
                ["mint", "pubkeyAsString"],
                ["data", Data],
                ["primarySaleHappened", "u8"],
                ["isMutable", "u8"], // bool
            ],
        },
    ],
    [
        EditionMarker,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["ledger", [31]],
            ],
        },
    ],
]);
const extendBorsh = () => {
    borsh_2.BinaryReader.prototype.readPubkey = function () {
        const reader = this;
        const array = reader.readFixedArray(32);
        return new web3_js_1.PublicKey(array);
    };
    borsh_2.BinaryWriter.prototype.writePubkey = function (value) {
        const writer = this;
        writer.writeFixedArray(value.toBuffer());
    };
    borsh_2.BinaryReader.prototype.readPubkeyAsString = function () {
        const reader = this;
        const array = reader.readFixedArray(32);
        return base58.encode(array);
    };
    borsh_2.BinaryWriter.prototype.writePubkeyAsString = function (value) {
        const writer = this;
        writer.writeFixedArray(base58.decode(value));
    };
};
exports.extendBorsh = extendBorsh;
(0, exports.extendBorsh)();
const decodeMetadata = (buffer) => {
    const metadata = (0, borsh_1.deserializeUnchecked)(exports.METADATA_SCHEMA, Metadata, buffer);
    metadata.data.name = metadata.data.name.replace(exports.METADATA_REPLACE, "");
    metadata.data.uri = metadata.data.uri.replace(exports.METADATA_REPLACE, "");
    metadata.data.symbol = metadata.data.symbol.replace(exports.METADATA_REPLACE, "");
    return metadata;
};
exports.decodeMetadata = decodeMetadata;
const getMetadataAddress = async (mintKey) => {
    const seeds = [
        Buffer.from("metadata"),
        new web3_js_1.PublicKey(exports.METADATA_PROGRAM_ID).toBuffer(),
        new web3_js_1.PublicKey(mintKey).toBuffer(),
    ];
    return web3_js_1.PublicKey.findProgramAddress(seeds, new web3_js_1.PublicKey(exports.METADATA_PROGRAM_ID));
};
exports.getMetadataAddress = getMetadataAddress;
const getMetaplexData = async (mintAddresses, chainInfo) => {
    const promises = [];
    for (const address of mintAddresses) {
        promises.push((0, exports.getMetadataAddress)(address));
    }
    const metaAddresses = await Promise.all(promises);
    // const connection = new Connection(SOLANA_HOST, "confirmed");
    const connection = new web3_js_1.Connection(chainInfo.nodeUrl, "confirmed");
    const results = await (0, solana_1.getMultipleAccountsRPC)(connection, metaAddresses.map((pair) => pair && pair[0]));
    const output = results.map((account) => {
        if (account === null) {
            return undefined;
        }
        else {
            if (account.data) {
                try {
                    const MetadataParsed = (0, exports.decodeMetadata)(account.data);
                    return MetadataParsed;
                }
                catch (e) {
                    // console.error(e);
                    return undefined;
                }
            }
            else {
                return undefined;
            }
        }
    });
    return output;
};
exports.getMetaplexData = getMetaplexData;
//# sourceMappingURL=utils.js.map