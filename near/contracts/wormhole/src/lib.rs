use {
    near_sdk::{
        borsh::{
            self,
            BorshDeserialize,
            BorshSerialize,
        },
        collections::{
            LookupMap,
            UnorderedSet,
        },
        env,
        near_bindgen,
        require,
        AccountId,
        Balance,
        Gas,
        Promise,
        PromiseOrValue,
        PublicKey,
    },
    serde::Serialize,
    wormhole::{
        core::{
            ContractUpgrade,
            CoreAction::{
                self,
                *,
            },
            GuardianSetChange,
            SetMessageFee,
            TransferFees,
        },
        Chain,
        GovAction,
        GuardianSet,
        VAA,
    },
};

#[derive(BorshDeserialize, BorshSerialize)]
pub struct GuardianAddress {
    pub bytes: Vec<u8>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct GuardianSetInfo {
    pub addresses:       Vec<GuardianAddress>,
    pub expiration_time: u64, // Guardian set expiration time
}

impl GuardianSetInfo {
    // Convert to the SDK representation.
    fn to_sdk(&self, index: u32) -> GuardianSet {
        let mut addresses: Vec<[u8; 20]> = vec![];
        for address in self.addresses.iter() {
            addresses.push(address.bytes.as_slice().try_into().unwrap());
        }
        GuardianSet {
            index,
            expires: self.expiration_time as u32,
            addresses,
        }
    }
}

#[must_use]
#[derive(Serialize, Debug, Clone)]
pub struct WormholeEvent {
    standard: String,
    event:    String,
    data:     String,
    nonce:    u32,
    emitter:  String,
    seq:      u64,
    block:    u64,
}

impl WormholeEvent {
    fn to_json_string(&self) -> String {
        // Events cannot fail to serialize so fine to panic on error
        #[allow(clippy::redundant_closure)]
        serde_json::to_string(self)
            .ok()
            .unwrap_or_else(|| env::abort())
    }

    fn to_json_event_string(&self) -> String {
        format!("EVENT_JSON:{}", self.to_json_string())
    }

    /// Logs the event to the host. This is required to ensure that the event is triggered
    /// and to consume the event.
    pub(crate) fn emit(self) {
        near_sdk::env::log_str(&self.to_json_event_string());
    }
}

//#[near_bindgen]
//#[derive(BorshDeserialize, BorshSerialize)]
//pub struct OldWormhole {
//    guardians: LookupMap<u32, GuardianSetInfo>,
//    dups: UnorderedSet<Vec<u8>>,
//    emitters: LookupMap<String, u64>,
//    guardian_set_expirity: u64,
//    guardian_set_index: u32,
//    message_fee: u64,
//    owner_pk: PublicKey,
//    upgrade_hash: Vec<u8>,
//}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Wormhole {
    guardians:             LookupMap<u32, GuardianSetInfo>,
    dups:                  UnorderedSet<[u8; 32]>,
    emitters:              LookupMap<String, u64>,
    guardian_set_expirity: u64,
    guardian_set_index:    u32,
    owner_pk:              PublicKey,
    upgrade_hash:          Vec<u8>,
    message_fee:           u128,
    bank:                  u128,
}

impl Default for Wormhole {
    fn default() -> Self {
        Self {
            guardians:             LookupMap::new(b"gs".to_vec()),
            dups:                  UnorderedSet::new(b"d".to_vec()),
            emitters:              LookupMap::new(b"e".to_vec()),
            guardian_set_index:    u32::MAX,
            guardian_set_expirity: 24 * 60 * 60 * 1_000_000_000, // 24 hours in nanoseconds
            owner_pk:              env::signer_account_pk(),
            upgrade_hash:          b"".to_vec(),
            message_fee:           0,
            bank:                  0,
        }
    }
}

// Nothing is mutable...
fn parse_and_verify_vaa(storage: &Wormhole, data: &[u8]) -> VAA {
    let vaa = VAA::from_bytes(data).unwrap_or_else(|e| {
        env::panic_str(&format!("Failed to parse VAA: {:?}", e));
    });

    let guardian_set = storage
        .guardians
        .get(&vaa.guardian_set_index)
        .expect("InvalidGuardianSetIndex");

    wormhole_near::verify_vaa(
        &vaa,
        guardian_set.to_sdk(vaa.guardian_set_index),
        env::block_timestamp() as u32,
    )
    .map_err(|err| {
        env::panic_str(&format!("{:?}", err));
    })
    .unwrap();

    vaa
}

fn vaa_update_contract(
    storage: &mut Wormhole,
    action: &ContractUpgrade,
    deposit: Balance,
    refund_to: AccountId,
) -> PromiseOrValue<bool> {
    env::log_str(&format!(
        "portal/{}#{}: vaa_update_contract: {}",
        file!(),
        line!(),
        hex::encode(action.new_contract.as_slice())
    ));

    storage.upgrade_hash = action.new_contract.to_vec();

    if deposit > 0 {
        PromiseOrValue::Promise(Promise::new(refund_to).transfer(deposit))
    } else {
        PromiseOrValue::Value(true)
    }
}

fn vaa_update_guardian_set(
    storage: &mut Wormhole,
    action: &GuardianSetChange,
    mut deposit: Balance,
    refund_to: AccountId,
) -> PromiseOrValue<bool> {
    if storage.guardian_set_index + 1 != action.new_guardian_set_index {
        env::panic_str("InvalidGovernanceSetIndex");
    }

    let current_set = &mut storage
        .guardians
        .get(&storage.guardian_set_index)
        .expect("InvalidPreviousGuardianSetIndex");

    current_set.expiration_time = env::block_timestamp() + storage.guardian_set_expirity;

    let new_set = GuardianSetInfo {
        expiration_time: 0,
        addresses:       action
            .new_guardian_set
            .iter()
            .map(|key| GuardianAddress {
                bytes: key.to_vec(),
            })
            .collect(),
    };

    let storage_used = env::storage_usage();

    storage
        .guardians
        .insert(&action.new_guardian_set_index, &new_set);
    storage.guardian_set_index = action.new_guardian_set_index;

    let required_cost =
        (Balance::from(env::storage_usage() - storage_used)) * env::storage_byte_cost();

    if required_cost > deposit {
        env::panic_str("DepositUnderflowForGuardianSet");
    }
    deposit -= required_cost;

    if deposit > 0 {
        PromiseOrValue::Promise(Promise::new(refund_to).transfer(deposit))
    } else {
        PromiseOrValue::Value(true)
    }
}

fn handle_set_fee(
    storage: &mut Wormhole,
    action: &SetMessageFee,
    deposit: Balance,
    refund_to: AccountId,
) -> PromiseOrValue<bool> {
    storage.message_fee = action.fee.low_u128();

    if deposit > 0 {
        PromiseOrValue::Promise(Promise::new(refund_to).transfer(deposit))
    } else {
        PromiseOrValue::Value(true)
    }
}

fn handle_transfer_fee(
    storage: &mut Wormhole,
    action: &TransferFees,
    deposit: Balance,
) -> PromiseOrValue<bool> {
    let amount = action.amount.low_u128();

    if amount > storage.bank {
        env::panic_str("bankUnderFlow");
    }

    // We only support addresses 32 bytes or shorter...  No, we don't
    // support hash addresses in this governance message
    let address = String::from_utf8_lossy(&action.to);
    let address = address.chars().filter(|&c| c != '\u{0}').collect();
    let d = AccountId::new_unchecked(address);

    if (deposit + amount) > 0 {
        storage.bank -= amount;
        PromiseOrValue::Promise(Promise::new(d).transfer(deposit + amount))
    } else {
        PromiseOrValue::Value(true)
    }
}

#[near_bindgen]
impl Wormhole {
    // I like passing the vaa's as strings around since it will show
    // up better in explorers... I'll let a near sensai talk me out
    // of this...
    pub fn verify_vaa(&self, vaa: String) -> u32 {
        let g1 = env::used_gas();
        let h = hex::decode(vaa).expect("invalidVaa");
        parse_and_verify_vaa(self, &h);
        let g2 = env::used_gas();

        env::log_str(&format!(
            "wormhole/{}#{}: vaa_verify: {}",
            file!(),
            line!(),
            serde_json::to_string(&(g2 - g1)).unwrap()
        ));

        self.guardian_set_index as u32
    }

    #[payable]
    pub fn publish_message(&mut self, data: String, nonce: u32) -> Promise {
        require!(
            env::prepaid_gas() >= Gas(10_000_000_000_000),
            &format!(
                "wormhole/{}#{}: more gas is required {}",
                file!(),
                line!(),
                serde_json::to_string(&env::prepaid_gas()).unwrap()
            )
        );

        if self.message_fee > 0 {
            require!(
                env::attached_deposit() >= self.message_fee,
                "message_fee not provided"
            );
            self.bank += env::attached_deposit();
        }

        let s = env::predecessor_account_id().to_string();

        let mut seq: u64 = 1;
        if self.emitters.contains_key(&s) {
            seq = self.emitters.get(&s).unwrap();
        } else {
            env::log_str(&format!(
                "wormhole/{}#{}: publish_message new emitter {}",
                file!(),
                line!(),
                &s
            ));
        }

        self.emitters.insert(&s, &(seq + 1));

        Self::ext(env::current_account_id()).message_published(
            data,
            nonce,
            hex::encode(env::sha256(s.as_bytes())),
            seq,
        )
    }

    #[private]
    pub fn message_published(
        &mut self,
        data: String,
        nonce: u32,
        emitter: String,
        seq: u64,
    ) -> u64 {
        WormholeEvent {
            standard: "wormhole".to_string(),
            event: "publish".to_string(),
            data,
            nonce,
            emitter,
            seq,
            block: env::block_height(),
        }
        .emit();
        seq
    }

    #[payable]
    pub fn submit_vaa(&mut self, vaa: String) -> PromiseOrValue<bool> {
        let refund_to = env::predecessor_account_id();
        let mut deposit = env::attached_deposit();

        if env::attached_deposit() == 0 {
            env::panic_str("PayForStorage");
        }

        if env::prepaid_gas() < Gas(300_000_000_000_000) {
            env::panic_str("NotEnoughGas");
        }

        let vaa = hex::decode(vaa).expect("InvalidVaa");
        let vaa = parse_and_verify_vaa(self, &vaa);
        let digest = vaa.digest().expect("Digest");

        // Only Accept VAA's from the current guardian set.
        if self.guardian_set_index != vaa.guardian_set_index {
            env::panic_str("InvalidGovernanceSet");
        }

        // Check if VAA with this hash was already accepted
        if self.dups.contains(&digest.hash) {
            env::panic_str("alreadyExecuted");
        }

        let storage_used = env::storage_usage();
        self.dups.insert(&digest.hash);
        let required_cost =
            (Balance::from(env::storage_usage() - storage_used)) * env::storage_byte_cost();

        if required_cost > deposit {
            env::panic_str("DepositUnderflowForDupSuppression");
        }
        deposit -= required_cost;

        match GovAction::<CoreAction>::from_bytes(&vaa.payload, Chain::Near)
            .expect("InvalidAction")
            .action
        {
            ContractUpgrade(a) => vaa_update_contract(self, &a, deposit, refund_to.clone()),
            GuardianSetChange(a) => vaa_update_guardian_set(self, &a, deposit, refund_to.clone()),
            SetMessageFee(a) => handle_set_fee(self, &a, deposit, refund_to.clone()),
            TransferFees(a) => handle_transfer_fee(self, &a, deposit),
        }
    }

    pub fn message_fee(&self) -> u128 {
        self.message_fee
    }

    pub fn boot_wormhole(&mut self, gset: u32, addresses: Vec<String>) {
        if self.owner_pk != env::signer_account_pk() {
            env::panic_str("invalidSigner");
        }

        assert!(self.guardian_set_index == u32::MAX);

        let addresses = addresses
            .iter()
            .map(|address| GuardianAddress {
                bytes: hex::decode(address).unwrap(),
            })
            .collect::<Vec<GuardianAddress>>();

        let new_set = GuardianSetInfo {
            addresses,
            expiration_time: 0,
        };

        self.guardians.insert(&gset, &new_set);
        self.guardian_set_index = gset;

        env::log_str(&format!("Booting guardian_set_index {}", gset));
    }

    #[private]
    pub fn update_contract_done(
        &mut self,
        refund_to: near_sdk::AccountId,
        storage_used: u64,
        attached_deposit: u128,
    ) {
        let delta = (env::storage_usage() as i128 - storage_used as i128)
            * env::storage_byte_cost() as i128;
        let refund = attached_deposit as i128 - delta;
        if refund > 0 {
            env::log_str(&format!(
                "wormhole/{}#{}: update_contract_done: refund {} to {}",
                file!(),
                line!(),
                refund,
                refund_to
            ));
            Promise::new(refund_to).transfer(refund as u128);
        }
    }

    #[private]
    fn update_contract_work(&mut self, v: Vec<u8>) -> Promise {
        if env::attached_deposit() == 0 {
            env::panic_str("attach some cash");
        }

        let s = env::sha256(&v);

        env::log_str(&format!(
            "wormhole/{}#{}: update_contract: {}",
            file!(),
            line!(),
            hex::encode(&s)
        ));

        if s.to_vec() != self.upgrade_hash {
            env::panic_str("invalidUpgradeContract");
        }

        Promise::new(env::current_account_id())
            .deploy_contract(v.to_vec())
            .then(Self::ext(env::current_account_id()).update_contract_done(
                env::predecessor_account_id(),
                env::storage_usage(),
                env::attached_deposit(),
            ))
    }

    #[payable]
    pub fn pass(&mut self) -> bool {
        env::log_str(&format!("wormhole::pass {} {}", file!(), line!()));

        return true;
    }

    //    #[init(ignore_state)]
    //    #[payable]
    //    pub fn migrate() -> Self {
    //        if env::attached_deposit() != 1 {
    //            env::panic_str("Need money");
    //        }
    //        let old_state: OldWormhole = env::state_read().expect("failed");
    //        if env::signer_account_pk() != old_state.owner_pk {
    //            env::panic_str("CannotCallMigrate");
    //        }
    //        env::log_str(&format!("wormhole/{}#{}: migrate", file!(), line!(),));
    //        Self {
    //            guardians: old_state.guardians,
    //            dups: old_state.dups,
    //            emitters: old_state.emitters,
    //            guardian_set_index: old_state.guardian_set_index,
    //            guardian_set_expirity: old_state.guardian_set_expirity,
    //            owner_pk: old_state.owner_pk,
    //            upgrade_hash: old_state.upgrade_hash,
    //
    //            message_fee: 0,
    //            bank: 0,
    //        }
    //    }
}

//  let result = await userAccount.functionCall({
//    contractId: config.wormholeAccount,
//    methodName: "update_contract",
//    args: await fs.readFileSync("...."),
//    attachedDeposit: "12500000000000000000000",
//    gas: 300000000000000,
//  });

#[no_mangle]
pub extern "C" fn update_contract() {
    env::setup_panic_hook();
    let mut contract: Wormhole = env::state_read().expect("Contract is not initialized");
    contract.update_contract_work(env::input().unwrap());
}
