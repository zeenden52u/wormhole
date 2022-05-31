use crate::{
    accounts::{
        AuthoritySigner,
        ConfigAccount,
        CoreBridge,
        CustodyAccount,
        CustodyAccountDerivationData,
        CustodySigner,
        EmitterAccount,
        MintSigner,
        WrappedDerivationData,
        WrappedMetaDerivationData,
        WrappedMint,
        WrappedTokenMeta,
    },
    messages::{
        PayloadTransfer,
        PayloadTransferWithPayload,
    },
    types::*,
    TokenBridgeError,
    TokenBridgeError::{
        InvalidChain,
        InvalidFee,
        WrongAccountOwner,
    },
};
use bridge::{
    accounts::Bridge,
    api::{
        PostMessage,
        PostMessageData,
    },
    types::ConsistencyLevel,
    vaa::SerializePayload,
    CHAIN_ID_SOLANA,
};
use primitive_types::U256;
use solana_program::{
    account_info::AccountInfo,
    instruction::{
        AccountMeta,
        Instruction,
    },
    program::{
        invoke,
        invoke_signed,
    },
    program_error::ProgramError,
    program_option::COption,
    pubkey::Pubkey,
    sysvar::clock::Clock,
};
use solitaire::{
    processors::seeded::{
        invoke_seeded,
        Seeded,
    },
    AccountState::*,
    CreationLamports::Exempt,
    *,
};
use spl_token::{
    error::TokenError::OwnerMismatch,
    state::{
        Account,
        Mint,
    },
};
use std::ops::{
    Deref,
    DerefMut,
};

pub type TransferNativeWithPayload<'b> = TransferNative<'b>;

accounts!(TransferNative {
    payer:            Mut<Signer<AccountInfo<'info>>>,
    config:           ConfigAccount<'info, { Initialized }>,
    from:             Mut<Data<'info, SplAccount, { Initialized }>>,
    mint:             Mut<Data<'info, SplMint, { Initialized }>>,
    custody:          Mut<CustodyAccount<'info, { MaybeInitialized }>>,
    authority_signer: AuthoritySigner<'info>,
    custody_signer:   CustodySigner<'info>,
    bridge:           Mut<CoreBridge<'info, { Initialized }>>,
    message:          Signer<Mut<Info<'info>>>,
    emitter:          EmitterAccount<'info>,
    sequence:         Mut<Info<'info>>,
    fee_collector:    Mut<Info<'info>>,
    clock:            Sysvar<'info, Clock>,
});

impl<'a> From<&TransferNative<'a>> for CustodyAccountDerivationData {
    fn from(accs: &TransferNative<'a>) -> Self {
        CustodyAccountDerivationData {
            mint: *accs.mint.info().key,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct TransferNativeData {
    pub nonce: u32,
    pub amount: u64,
    pub fee: u64,
    pub target_address: Address,
    pub target_chain: ChainID,
}

pub fn transfer_native(
    ctx: &ExecutionContext,
    accs: &mut TransferNative,
    data: TransferNativeData,
) -> Result<()> {
    // Prevent transferring to the same chain.
    if data.target_chain == CHAIN_ID_SOLANA {
        return Err(InvalidChain.into());
    }

    let (amount, fee) = verify_and_execute_native_transfers(ctx, accs, data.amount, data.fee)?;

    // Post message
    let payload = PayloadTransfer {
        amount: U256::from(amount),
        token_address: accs.mint.info().key.to_bytes(),
        token_chain: CHAIN_ID_SOLANA,
        to: data.target_address,
        to_chain: data.target_chain,
        fee: U256::from(fee),
    };
    let params = (
        bridge::instruction::Instruction::PostMessage,
        PostMessageData {
            nonce: data.nonce,
            payload: payload.try_to_vec()?,
            consistency_level: ConsistencyLevel::Finalized,
        },
    );

    let ix = Instruction::new_with_bytes(
        accs.config.wormhole_bridge,
        params.try_to_vec()?.as_slice(),
        vec![
            AccountMeta::new(*accs.bridge.info().key, false),
            AccountMeta::new(*accs.message.key, true),
            AccountMeta::new_readonly(*accs.emitter.key, true),
            AccountMeta::new(*accs.sequence.key, false),
            AccountMeta::new(*accs.payer.key, true),
            AccountMeta::new(*accs.fee_collector.key, false),
            AccountMeta::new_readonly(*accs.clock.info().key, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(solana_program::sysvar::rent::ID, false),
        ],
    );
    invoke_seeded(&ix, ctx, &accs.emitter, None)?;

    Ok(())
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct TransferNativeWithPayloadData {
    pub nonce: u32,
    pub amount: u64,
    pub fee: u64,
    pub target_address: Address,
    pub target_chain: ChainID,
    pub payload: Vec<u8>,
}

pub fn transfer_native_with_payload(
    ctx: &ExecutionContext,
    accs: &mut TransferNative,
    data: TransferNativeWithPayloadData,
) -> Result<()> {
    // Prevent transferring to the same chain.
    if data.target_chain == CHAIN_ID_SOLANA {
        return Err(InvalidChain.into());
    }

    let (amount, fee) = verify_and_execute_native_transfers(ctx, accs, data.amount, data.fee)?;

    // Post message
    let payload = PayloadTransferWithPayload {
        amount: U256::from(amount),
        token_address: accs.mint.info().key.to_bytes(),
        token_chain: CHAIN_ID_SOLANA,
        to: data.target_address,
        to_chain: data.target_chain,
        fee: U256::from(fee),
        payload: data.payload,
    };
    let params = (
        bridge::instruction::Instruction::PostMessage,
        PostMessageData {
            nonce: data.nonce,
            payload: payload.try_to_vec()?,
            consistency_level: ConsistencyLevel::Finalized,
        },
    );

    let ix = Instruction::new_with_bytes(
        accs.config.wormhole_bridge,
        params.try_to_vec()?.as_slice(),
        vec![
            AccountMeta::new(*accs.bridge.info().key, false),
            AccountMeta::new(*accs.message.key, true),
            AccountMeta::new_readonly(*accs.emitter.key, true),
            AccountMeta::new(*accs.sequence.key, false),
            AccountMeta::new(*accs.payer.key, true),
            AccountMeta::new(*accs.fee_collector.key, false),
            AccountMeta::new_readonly(*accs.clock.info().key, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(solana_program::sysvar::rent::ID, false),
        ],
    );
    invoke_seeded(&ix, ctx, &accs.emitter, None)?;

    Ok(())
}

pub fn verify_and_execute_native_transfers(
    ctx: &ExecutionContext,
    accs: &mut TransferNative,
    raw_amount: u64,
    raw_fee: u64,
) -> Result<(u64, u64)> {
    // Verify that the custody account is derived correctly
    let derivation_data: CustodyAccountDerivationData = (&*accs).into();
    accs.custody
        .verify_derivation(ctx.program_id, &derivation_data)?;

    // Verify mints
    if accs.from.mint != *accs.mint.info().key {
        return Err(TokenBridgeError::InvalidMint.into());
    }

    // Fee must be less than amount
    if raw_fee > raw_amount {
        return Err(InvalidFee.into());
    }

    // Verify that the token is not a wrapped token
    if let COption::Some(mint_authority) = accs.mint.mint_authority {
        if mint_authority == MintSigner::key(None, ctx.program_id) {
            return Err(TokenBridgeError::TokenNotNative.into());
        }
    }

    if !accs.custody.is_initialized() {
        accs.custody
            .create(&(&*accs).into(), ctx, accs.payer.key, Exempt)?;

        let init_ix = spl_token::instruction::initialize_account(
            &spl_token::id(),
            accs.custody.info().key,
            accs.mint.info().key,
            accs.custody_signer.key,
        )?;
        invoke_signed(&init_ix, ctx.accounts, &[])?;
    }

    let trunc_divisor = 10u64.pow(8.max(accs.mint.decimals as u32) - 8);
    // Truncate to 8 decimals
    let amount: u64 = raw_amount / trunc_divisor;
    let fee: u64 = raw_fee / trunc_divisor;
    // Untruncate the amount to drop the remainder so we don't  "burn" user's funds.
    let amount_trunc: u64 = amount * trunc_divisor;

    // Transfer tokens
    let transfer_ix = spl_token::instruction::transfer(
        &spl_token::id(),
        accs.from.info().key,
        accs.custody.info().key,
        accs.authority_signer.key,
        &[],
        amount_trunc,
    )?;
    invoke_seeded(&transfer_ix, ctx, &accs.authority_signer, None)?;

    // Pay fee
    let transfer_ix = solana_program::system_instruction::transfer(
        accs.payer.key,
        accs.fee_collector.key,
        accs.bridge.config.fee,
    );
    invoke(&transfer_ix, ctx.accounts)?;

    Ok((amount, fee))
}

accounts!(TransferWrapped {
    payer:            Mut<Signer<AccountInfo<'info>>>,
    config:           ConfigAccount<'info, { Initialized }>,
    from:             Mut<Data<'info, SplAccount, { Initialized }>>,
    from_owner:       MaybeMut<Signer<Info<'info>>>,
    mint:             Mut<WrappedMint<'info, { Initialized }>>,
    wrapped_meta:     WrappedTokenMeta<'info, { Initialized }>,
    authority_signer: AuthoritySigner<'info>,
    bridge:           Mut<CoreBridge<'info, { Initialized }>>,
    message:          Signer<Mut<Info<'info>>>,
    emitter:          EmitterAccount<'info>,
    sequence:         Mut<Info<'info>>,
    fee_collector:    Mut<Info<'info>>,
    clock:            Sysvar<'info, Clock>,
});

pub type TransferWrappedWithPayload<'b> = TransferWrapped<'b>;

impl<'a> From<&TransferWrapped<'a>> for WrappedDerivationData {
    fn from(accs: &TransferWrapped<'a>) -> Self {
        WrappedDerivationData {
            token_chain: 1,
            token_address: accs.mint.info().key.to_bytes(),
        }
    }
}

impl<'a> From<&TransferWrapped<'a>> for WrappedMetaDerivationData {
    fn from(accs: &TransferWrapped<'a>) -> Self {
        WrappedMetaDerivationData {
            mint_key: *accs.mint.info().key,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct TransferWrappedData {
    pub nonce: u32,
    pub amount: u64,
    pub fee: u64,
    pub target_address: Address,
    pub target_chain: ChainID,
}

pub fn transfer_wrapped(
    ctx: &ExecutionContext,
    accs: &mut TransferWrapped,
    data: TransferWrappedData,
) -> Result<()> {
    // Prevent transferring to the same chain.
    if data.target_chain == CHAIN_ID_SOLANA {
        return Err(InvalidChain.into());
    }

    verify_and_execute_wrapped_transfers(ctx, accs, data.amount, data.fee)?;

    // Post message
    let payload = PayloadTransfer {
        amount: U256::from(data.amount),
        token_address: accs.wrapped_meta.token_address,
        token_chain: accs.wrapped_meta.chain,
        to: data.target_address,
        to_chain: data.target_chain,
        fee: U256::from(data.fee),
    };
    let params = (
        bridge::instruction::Instruction::PostMessage,
        PostMessageData {
            nonce: data.nonce,
            payload: payload.try_to_vec()?,
            consistency_level: ConsistencyLevel::Finalized,
        },
    );

    let ix = Instruction::new_with_bytes(
        accs.config.wormhole_bridge,
        params.try_to_vec()?.as_slice(),
        vec![
            AccountMeta::new(*accs.bridge.info().key, false),
            AccountMeta::new(*accs.message.key, true),
            AccountMeta::new_readonly(*accs.emitter.key, true),
            AccountMeta::new(*accs.sequence.key, false),
            AccountMeta::new(*accs.payer.key, true),
            AccountMeta::new(*accs.fee_collector.key, false),
            AccountMeta::new_readonly(*accs.clock.info().key, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(solana_program::sysvar::rent::ID, false),
        ],
    );
    invoke_seeded(&ix, ctx, &accs.emitter, None)?;

    Ok(())
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct TransferWrappedWithPayloadData {
    pub nonce: u32,
    pub amount: u64,
    pub fee: u64,
    pub target_address: Address,
    pub target_chain: ChainID,
    pub payload: Vec<u8>,
}

pub fn transfer_wrapped_with_payload(
    ctx: &ExecutionContext,
    accs: &mut TransferWrapped,
    data: TransferWrappedWithPayloadData,
) -> Result<()> {
    // Prevent transferring to the same chain.
    if data.target_chain == CHAIN_ID_SOLANA {
        return Err(InvalidChain.into());
    }

    verify_and_execute_wrapped_transfers(ctx, accs, data.amount, data.fee)?;

    // Post message
    let payload = PayloadTransferWithPayload {
        amount: U256::from(data.amount),
        token_address: accs.wrapped_meta.token_address,
        token_chain: accs.wrapped_meta.chain,
        to: data.target_address,
        to_chain: data.target_chain,
        fee: U256::from(data.fee),
        payload: data.payload,
    };
    let params = (
        bridge::instruction::Instruction::PostMessage,
        PostMessageData {
            nonce: data.nonce,
            payload: payload.try_to_vec()?,
            consistency_level: ConsistencyLevel::Finalized,
        },
    );

    let ix = Instruction::new_with_bytes(
        accs.config.wormhole_bridge,
        params.try_to_vec()?.as_slice(),
        vec![
            AccountMeta::new(*accs.bridge.info().key, false),
            AccountMeta::new(*accs.message.key, true),
            AccountMeta::new_readonly(*accs.emitter.key, true),
            AccountMeta::new(*accs.sequence.key, false),
            AccountMeta::new(*accs.payer.key, true),
            AccountMeta::new(*accs.fee_collector.key, false),
            AccountMeta::new_readonly(*accs.clock.info().key, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(solana_program::sysvar::rent::ID, false),
        ],
    );
    invoke_seeded(&ix, ctx, &accs.emitter, None)?;

    Ok(())
}

pub fn verify_and_execute_wrapped_transfers(
    ctx: &ExecutionContext,
    accs: &mut TransferWrapped,
    amount: u64,
    fee: u64,
) -> Result<()> {
    // Verify that the from account is owned by the from_owner
    if &accs.from.owner != accs.from_owner.key {
        return Err(WrongAccountOwner.into());
    }

    // Verify mints
    if accs.mint.info().key != &accs.from.mint {
        return Err(TokenBridgeError::InvalidMint.into());
    }

    // Fee must be less than amount
    if fee > amount {
        return Err(InvalidFee.into());
    }

    // Verify that meta is correct
    let derivation_data: WrappedMetaDerivationData = (&*accs).into();
    accs.wrapped_meta
        .verify_derivation(ctx.program_id, &derivation_data)?;

    // Burn tokens
    let burn_ix = spl_token::instruction::burn(
        &spl_token::id(),
        accs.from.info().key,
        accs.mint.info().key,
        accs.authority_signer.key,
        &[],
        amount,
    )?;
    invoke_seeded(&burn_ix, ctx, &accs.authority_signer, None)?;

    // Pay fee
    let transfer_ix = solana_program::system_instruction::transfer(
        accs.payer.key,
        accs.fee_collector.key,
        accs.bridge.config.fee,
    );

    invoke(&transfer_ix, ctx.accounts)?;

    Ok(())
}
