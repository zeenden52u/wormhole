module wormhole::deploy_coin{
    use 0x1::signer::{Self};
    use 0x1::vector::{Self};
    use 0x1::code::{publish_package_txn};
    use 0x1::bcs::{Self};
    //use 0x1::byte_conversions::{Self};
    //use 0x1::hash::{Self};
    //use 0x1::util::address;

    fun mysplit(b: u8): (u8, u8){
        let l = b >> 4;
        let r = b & 0xf;
        (l, r)
    }

    public fun to_hex(b: vector<u8>): vector<u8>{
        let ascii = b"0123456789abcdef";
        let res = vector::empty<u8>();
        let n = vector::length(&b);
        let i = 0;
        while (i < n){
            let cur = *vector::borrow<u8>(&b, i);
            let (l, r) = mysplit(cur);
            assert!((l as u64) <= 16, 0);
            assert!((r as u64) <= 16, 0);
            vector::push_back(&mut res, *vector::borrow<u8>(&ascii, (l as u64)));
            vector::push_back(&mut res, *vector::borrow<u8>(&ascii, (r as u64)));
            i = i+1;
        };
        res
    }

    public entry fun deployCoin(wormhole: &signer){
        //TODO: we need to make a modification in metadata_serialized involving modifying the digest and then SHA3-ing it
        let addr = signer::address_of(wormhole);

        let addr_bytes = bcs::to_bytes(&addr);
        let code = x"a11ceb0b05000000050100020202040706130819200a390500000001080004636f696e01540b64756d6d795f6669656c64";
        let middle= addr_bytes;

        vector::append(&mut code, middle);
        vector::append(&mut code, x"000201020100");

        //let new_source_digest = hash::sha3_256(hash::sha3_256(*string::bytes(&code)));
        //assert!(vector::length(&new_source_digest)==32, 99); // is this supposed to be len 32? I thought it was 64...based on the hexdump. Offset might be wrong then.
        //let metadata_serialized: vector<u8> = x"0b57726170706564436f696e01000000000000000040424133353244384142434533424437373946394533414435334642324136423539423630303844373330353845353335394638303233443739364632313838348e031f8b08000000000002ffb5534b6b1b3110beeb570cf2a5a5b5ad959f09e4505a7a2b3934a50713821eb3b6f0ae2424799b50f2df33726c7209e4e49b66e67b2166365199bddae23df3aa47b801fe37a918d17e0fce733660ca2ef8da17133169383bc46d52161f62e89c79aa0313faa88ad31d72c64677b73f6eaf213a0f276e068d6d4808bd72de6381841daa8c6c6331a2b7e88dc37ccfbec512f2cf4429fe85b427e1ffb075a51aec4a89f97a3aa57277d013f29baa0a1e774ae7d3d390c38400fc2be483b62e55e2eba80f034edbb3f009ff561323e150e11607cac7e199fd22caef623ba72f97a396e37c347937c3f13f2e1de2b5f9518abbb0477fe910a59abc9b61047fe462f9817f0cbe603f26ca51f3408c37adba7a1c488a6d94b50973ae1b37028bc90d68e1d48436851ef24ecd1e88fe89f6b30b4f98e00b7012ed778156fc331b9ddf375c3cca45239a6621e7c68a76b55caf9bb659e2ca48bb96b215a6315784d0ad95f399d04aceb1d133bb90ababa56da598734a71d63b5ed9a3a02b7a013ff3bcf09603000001064465706c6f79cb031f8b08000000000002ff8d52c96eab4010bcfb2b5a1c2c909002c40b19e7e5f2de1fe4ddd12c8d8dc226662631b1f8f7ccb0c5468e146e43757557575751099d2304e7681b0661b88d365c04e97e17c7611aee70cf231147511af0903f990a968a68f318301a6d30648f621bed9f76228d820d21ffb0ceabf6b202f369697b8684c8ec586243c8e515f3b43bdc82efc855f513c82b8106aa35cb33794a6acadfe81113752e9795523559791cdbf8f0da3f7dd02a8d97a58ccbdb710f0f33a655961342856850cac36a84e103814aa90b04060dd606c45249a0f04ef34cc009cf3008e809bd5c0ea92e415589015d4660d8f359c72f1e19e50d36f5da8c4c9779fdbb5b5d3731739ab66f257a6bff5659e97e544d71aa7224b01ebcf5be5be5a8c0ea873f30f93eae9354e9ccf40e3704d62a9486d15b6334f76f776d898bcad1e771034319a43bc59021e7aa7c3a09ad6b2c85bb2ef444f7675fec1cef979c71924d4556c2c5fed75cc17f3851096fd8c2a583ceb1dd6e1417a8a8a08a26129bcc9ceb1385ddd491c25954dab419684a2416b56a9fbfeff6e22ebce0ba49ee724cf175ed04d6da6498990c0f7b59aa3f37b9967d27eff3e5fc7b0bf930b61803d47d01df1b5aced303000000000400000000000000000000000000000000000000000000000000000000000000010e4170746f734672616d65776f726b00000000000000000000000000000000000000000000000000000000000000010b4170746f735374646c696200000000000000000000000000000000000000000000000000000000000000010a4d6f76655374646c696200000000000000000000000000000000000000000000000000000000000000030a4170746f73546f6b656e00";
        let metadata_serialized: vector<u8> = x"0b57726170706564436f696e01000000000000000040433035424637374641463734303832443639354442393334414133353235343246354144423132414533363641334641393032303734434232433731324637399f021f8b08000000000002ffb5923d6bc330108677fd8a43596b3b2db443a04369e9563234a5430845b22e8eb0f58124bb94d2ffde93e3902590c99b4ef77e3c086dbda85bd1e08e5961101e817f06e13daa67a72d670386a89dcdf7cb7259de72d6fb2608855fde75bafec98bda192f92961d72c6169bf5cb7a055e5b98bc1124ee5d4030425b8b0902762822b2ad428f56a1ad35c61d7bf2c9c5d74014df2eb414fc0b8d4eb9e090928fabaaa2f1d0cb92fa2a91c54527649c8e35359424e037107ba974c8c6e3cab801abfd2978d29f6772041cb25ce1407c1cfed81b59de93eab49c8f238f451c4b2e328cef3137c4f1f21ac5c6b568e78648b9e422c3023eeeee1faef47b67139a822c63664f8e7356fe7a1c288ab17fe7806ba0f10200000104636f696e741f8b08000000000002ff0dc0dd0984300c00e0f74e91116a9a26c5396e81246db9e37e8453411177d7ef3bd5f5d3206e28d235e66cac929cd02333d68c899db3172677eb5849ade2d007214dd18b49e1a656c8c6d1a7d70f0e08709b97ffea0b3ce0a933bcdb0ec719ce7001d3468afc6d00000000000400000000000000000000000000000000000000000000000000000000000000010e4170746f734672616d65776f726b00000000000000000000000000000000000000000000000000000000000000010b4170746f735374646c696200000000000000000000000000000000000000000000000000000000000000010a4d6f76655374646c696200000000000000000000000000000000000000000000000000000000000000030a4170746f73546f6b656e00";
        //let metadata_serialized: vector<u8> = bcs::to_bytes(&temp);
        //let metadata_serialized: vector<u8> = *&temp;
        //let metadata_serialized = *&temp;
        // let n = vector::length(&metadata_serialized);
        // // splice out old source digest from metadata and replace with new
        // let metadata_new = x"";
        // let i = 0;
        // while (i < 22){
        //     vector::push_back(&mut metadata_new, *vector::borrow<u8>(&metadata_serialized, i));
        //     i = i + 1;
        // };
        // //assert!(1==0, 100);
        // while (i < 54){
        //     vector::push_back(&mut metadata_new, *vector::borrow<u8>(&new_source_digest, i - 22));
        //     i = i + 1;
        // };
        // while (i < n ){
        //     vector::push_back(&mut metadata_new, *vector::borrow<u8>(&metadata_serialized, i));
        //     i = i + 1;
        // };
        let code_array = vector::empty<vector<u8>>();
        vector::push_back(&mut code_array, code);
        publish_package_txn(wormhole, metadata_serialized, code_array);
    }
}

//#[test_only]
//module wormhole::ascii_test {
//     use 0x1::vector::{Self};
//     use 0x1::string::{utf8};
       //use 0x1::signer::{Self};
       //use wormhole::deploy_coin::{Self};
//     #[test]
//     fun test_one(){
//         let v = vector::empty<u8>();
//         vector::push_back(&mut v, 0x12);
//         vector::push_back(&mut v, 0x34);
//         let b = to_hex(v);
//         let s = utf8(b);
//         assert!(s==utf8(b"1234"), 0);
//     }

//     #[test]
//     fun test_two(){
//         let v = vector::empty<u8>();
//         vector::push_back(&mut v, 0x12);
//         vector::push_back(&mut v, 0x34);
//         vector::push_back(&mut v, 0xaa);
//         let b = to_hex(v);
//         let s = utf8(b);
//         assert!(s==utf8(b"1234aa"), 0)
//     }

    // #[test(wormhole= @0x434)]
    // fun test_deploy(wormhole: signer){
    //     let addr = signer::address_of(&wormhole);
    //     0x1::account::create_account_for_test(addr);
    //     deploy_coin::deployCoin(&wormhole)
    // }
//}
