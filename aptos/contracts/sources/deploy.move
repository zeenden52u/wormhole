module 0x251011524cd0f76881f16e7c2d822f0c1c9510bfd2430ba24e1b3d52796df204::Deploy{
    use 0x1::signer::{Self};
    use 0x1::vector::{Self};
    use 0x1::code::{publish_package_txn};
    use 0x1::string::{Self, String, utf8};
    use 0x1::bcs::{Self};
    //use 0x1::util::address;

    fun mysplit(b: u8): (u8, u8){
        let l = b >> 4;
        let r = b & 0xf;
        (l, r)
    }

    public fun to_hex(b: vector<u8>): vector<u8>{
        let ascii = vector::empty<u8>();
        vector::push_back(&mut ascii, 0x30); // 0
        vector::push_back(&mut ascii, 0x31); // 1
        vector::push_back(&mut ascii, 0x32); // 2
        vector::push_back(&mut ascii, 0x33); // 3
        vector::push_back(&mut ascii, 0x34); // 4
        vector::push_back(&mut ascii, 0x35); // 5
        vector::push_back(&mut ascii, 0x36); // 6
        vector::push_back(&mut ascii, 0x37); // 7
        vector::push_back(&mut ascii, 0x38); // 8
        vector::push_back(&mut ascii, 0x39); // 9
        vector::push_back(&mut ascii, 0x61); // a
        vector::push_back(&mut ascii, 0x62); // b
        vector::push_back(&mut ascii, 0x63); // c
        vector::push_back(&mut ascii, 0x64); // d
        vector::push_back(&mut ascii, 0x65); // e
        vector::push_back(&mut ascii, 0x66); // f
        let res = vector::empty<u8>();
        let n = vector::length(&b);
        let i = 0;
        while (i < n){
            let cur = *vector::borrow<u8>(&b, i);
            let (l, r) = mysplit(cur);
            vector::push_back(&mut res, *vector::borrow<u8>(&ascii, (l as u64)));
            vector::push_back(&mut res, *vector::borrow<u8>(&ascii, (r as u64)));
            i = i+1;
        };
        res
    }

    public entry fun deployCoin(wormhole: &signer){
        //TODO: we need to make a modification in metadata_serialized involving modifying the digest and then SHA3-ing it
        let addr = signer::address_of(wormhole);
        let bytes = bcs::to_bytes(&addr);
        let string: String = utf8(b"module ");
        string::append(&mut string, utf8(to_hex(bytes)));
        string::append(&mut string, utf8(b"::coin { struct T has key {} }"));

        let metadata_serialized = b"blah";

        let code = vector::empty<vector<u8>>();
        let cur_code = vector::empty<u8>();
        vector::push_back(&mut code, cur_code);

        publish_package_txn(wormhole, metadata_serialized, code);
    }
}

#[test_only]
module wormhole::ascii_test {
    use 0x1::vector::{Self};
    use 0x1::string::{utf8};
    use 0x251011524cd0f76881f16e7c2d822f0c1c9510bfd2430ba24e1b3d52796df204::Deploy::to_hex;
    #[test]
    fun test_one(){
        let v = vector::empty<u8>();
        vector::push_back(&mut v, 0x12);
        vector::push_back(&mut v, 0x34);
        let b = to_hex(v);
        let s = utf8(b);
        assert!(s==utf8(b"1234"), 0)
    }
}