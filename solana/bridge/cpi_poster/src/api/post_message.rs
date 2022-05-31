use bridge::types::ConsistencyLevel;
use solana_program::program::invoke;
use solitaire::{
    trace,
    *,
};


impl<'b> InstructionContext<'b> for PostMessage<'b> {
}
accounts!(PostMessage {
    bridge:         Mut<Info<'info>>,
    message:        Signer<Mut<Info<'info>>>,
    emitter:        MaybeMut<Info<'info>>,
    sequence:       Mut<Info<'info>>,
    payer:          Mut<Info<'info>>,
    fee_collector:  Mut<Info<'info>>,
    clock:          Info<'info>,
    bridge_program: Info<'info>,
});

#[derive(BorshDeserialize, BorshSerialize)]
pub struct PostMessageData {
    /// Unique nonce for this message
    pub nonce: u32,

    /// Message payload
    pub payload: Vec<u8>,

    /// Commitment Level required for an attestation to be produced
    pub consistency_level: ConsistencyLevel,
}

pub fn post_message(
    ctx: &ExecutionContext,
    accs: &mut PostMessage,
    data: PostMessageData,
) -> Result<()> {
    let ix = bridge::instructions::post_message(
        *accs.bridge_program.key,
        *accs.payer.key,
        *accs.emitter.key,
        *accs.message.key,
        data.nonce,
        data.payload,
        data.consistency_level,
    )
    .unwrap();
    invoke(&ix, ctx.accounts)?;

    Ok(())
}
