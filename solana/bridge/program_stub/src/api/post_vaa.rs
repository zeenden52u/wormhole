use solitaire::*;

use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use solana_program::{
    self,
    sysvar::clock::Clock,
};

use bridge::{
    accounts::{
        Bridge,
        GuardianSetDerivationData,
        PostedVAA,
        PostedVAADerivationData,
    },
    instructions::hash_vaa,
    PostVAAData,
    CHAIN_ID_SOLANA,
};
use solitaire::{
    processors::seeded::Seeded,
    AccountState::*,
    CreationLamports::Exempt,
};


impl<'b> InstructionContext<'b> for PostVAA<'b> {
}
accounts!(PostVAA {
    guardian_set:  Info<'info>,
    bridge_info:   Bridge<'info, { Initialized }>,
    signature_set: Info<'info>,
    message:       Mut<PostedVAA<'info, { MaybeInitialized }>>,
    payer:         Mut<Signer<Info<'info>>>,
    clock:         Sysvar<'info, Clock>,
});

#[derive(Default, BorshSerialize, BorshDeserialize)]
pub struct Signature {
    pub index: u8,
    pub r: [u8; 32],
    pub s: [u8; 32],
    pub v: u8,
}

pub type ForeignAddress = [u8; 32];

pub fn post_vaa(ctx: &ExecutionContext, accs: &mut PostVAA, vaa: PostVAAData) -> Result<()> {
    let mut msg_derivation = PostedVAADerivationData {
        payload_hash: hash_vaa(&vaa).to_vec(),
    };

    accs.message
        .verify_derivation(ctx.program_id, &msg_derivation)?;

    // If the VAA originates from another chain we need to create the account and populate all fields
    if !accs.message.is_initialized() {
        accs.message.nonce = vaa.nonce;
        accs.message.emitter_chain = vaa.emitter_chain;
        accs.message.emitter_address = vaa.emitter_address;
        accs.message.sequence = vaa.sequence;
        accs.message.payload = vaa.payload;
        accs.message.consistency_level = vaa.consistency_level;
        accs.message
            .create(&msg_derivation, ctx, accs.payer.key, Exempt)?;
    }

    // Store VAA data in associated message.
    accs.message.vaa_version = vaa.version;
    accs.message.vaa_time = vaa.timestamp;
    accs.message.vaa_signature_account = *accs.signature_set.info().key;

    Ok(())
}
