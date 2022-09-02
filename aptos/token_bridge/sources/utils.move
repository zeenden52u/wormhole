module token_bridge::utils{
    use 0x1::hash::{sha3_256};
    use 0x1::type_info::{TypeInfo, account_address, module_name, struct_name};
    use 0x1::bcs::{to_bytes};
    use 0x1::vector::{Self};

    public entry fun hash_type_info(t: &TypeInfo): vector<u8>{
        let addr_bytes = to_bytes(&account_address(t));
        let mod_name = module_name(t);
        let struct_name = struct_name(t);

        let res = vector::empty<u8>();
        vector::append(&mut res, addr_bytes);
        vector::append(&mut res, mod_name);
        vector::append(&mut res, struct_name);

        res = sha3_256(res);
        assert!(vector::length(&res)==32, 0);
        res
    }

}