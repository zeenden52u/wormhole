module wormhole::test_init_coin{
    use 0x1::coin::{Self, FreezeCapability, BurnCapability, MintCapability};
    use 0x1::string::{Self};

    struct Caps<phantom CoinType> has key{
        mint: MintCapability<CoinType>,
        burn: BurnCapability<CoinType>,
        freeze: FreezeCapability<CoinType>,
    }

    //public fun get_caps<CoinType>(caps: &Caps<CoinType>): (&BurnCapability<CoinType>, &FreezeCapability<CoinType>, &MintCapability<CoinType>){
    //    (&caps.burn, &caps.freeze, &caps.mint)
    //}

    public entry fun test_init_coin<CoinType>(sender: &signer){
        let (burn, freeze, mint) = coin::initialize<CoinType>(sender, string::utf8(b"test coin"), string::utf8(b"test symbol"), 5, false);
        coin::register<CoinType>(sender);
        move_to(sender, Caps<CoinType> {mint:mint, burn:burn, freeze: freeze});
    }
}