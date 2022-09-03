module token_bridge::TokenBridge {
    use 0x1::account::{SignerCapability};
    use 0x1::signer::{Self};
    use deployer::{claim_signer_capability};

    struct TokenBridgeSignerCapabilityStore {
        signer_cap: SignerCapability
    }

    // The only signer who can call init is the signer who used Deployer.move deploy_derived to deploy
    // the token bridge. This is enforced in claim_signer_capability.
    public entry fun init_token_bridge(deployer: &signer){
        let signer_cap = claim_signer_capability(deployer, @token_bridge);

        // store signer cap
        let token_bridge_signer_capability_store = TokenBridgeSignerCapabilityStore{
            signer_cap: signer_cap
        }
        move_to(token_bridge, token_bridge_signer_capability_store);

        // call initialization functions


    }
}
