module 0x251011524cd0f76881f16e7c2d822f0c1c9510bfd2430ba24e1b3d52796df204::Deploy{
    use 0x1::signer::{Self};
    use 0x1::vector::{Self};
    use 0x1::code::{publish_package_txn};
    use 0x1::string::{Self, String, utf8};
    use 0x1::bcs::{Self};
    //use 0x1::util::address;

    // we assume b represents a valid hex string
    public fun to_hex(b: vector<u8>): String{
        utf8(b)
    }

    public entry fun deployCoin(wormhole: &signer){
        let addr = signer::address_of(wormhole);
        let bytes = bcs::to_bytes(&addr);
        let string: String = utf8(b"module ");
        string::append(&mut string, to_hex(bytes));
        string::append(&mut string, utf8(b"::coin { struct T has key {} }"));

        let metadata_serialized = b"sd";

        let code = vector::empty<vector<u8>>();
        let cur_code = vector::empty<u8>();
        vector::push_back(&mut code, cur_code);

        publish_package_txn(wormhole, metadata_serialized, code);
    }

}