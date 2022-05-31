use crate::{
    accounts::{
        CustodySigner,
        FromCustodyTokenAccount,
        FromCustodyTokenAccountDerivationData,
        MigrationPool,
        MigrationPoolDerivationData,
        ShareMint,
        ShareMintDerivationData,
        ToCustodyTokenAccount,
        ToCustodyTokenAccountDerivationData,
    },
    types::SplMint,
};
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use solana_program::program::invoke_signed;
use solitaire::{
    AccountState::*,
    CreationLamports::Exempt,
    *,
};

accounts!(CreatePool {
    payer:              Mut<Signer<Info<'info>>>,
    pool:               Mut<MigrationPool<'info, { Uninitialized }>>,
    from_mint:          Data<'info, SplMint, { Initialized }>,
    to_mint:            Data<'info, SplMint, { Initialized }>,
    from_token_custody: Mut<FromCustodyTokenAccount<'info, { Uninitialized }>>,
    to_token_custody:   Mut<ToCustodyTokenAccount<'info, { Uninitialized }>>,
    pool_mint:          Mut<ShareMint<'info, { Uninitialized }>>,
    custody_signer:     CustodySigner<'info>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct CreatePoolData {}

pub fn create_pool(
    ctx: &ExecutionContext,
    accs: &mut CreatePool,
    _data: CreatePoolData,
) -> Result<()> {
    // Create from custody account
    accs.from_token_custody.create(
        &FromCustodyTokenAccountDerivationData {
            pool: *accs.pool.info().key,
        },
        ctx,
        accs.payer.key,
        Exempt,
    )?;

    let init_ix = spl_token::instruction::initialize_account(
        &spl_token::id(),
        accs.from_token_custody.info().key,
        accs.from_mint.info().key,
        accs.custody_signer.info().key,
    )?;
    invoke_signed(&init_ix, ctx.accounts, &[])?;

    // Create to custody account
    accs.to_token_custody.create(
        &ToCustodyTokenAccountDerivationData {
            pool: *accs.pool.info().key,
        },
        ctx,
        accs.payer.key,
        Exempt,
    )?;

    let init_ix = spl_token::instruction::initialize_account(
        &spl_token::id(),
        accs.to_token_custody.info().key,
        accs.to_mint.info().key,
        accs.custody_signer.info().key,
    )?;
    invoke_signed(&init_ix, ctx.accounts, &[])?;

    // Create to pool mint
    accs.pool_mint.create(
        &ShareMintDerivationData {
            pool: *accs.pool.info().key,
        },
        ctx,
        accs.payer.key,
        Exempt,
    )?;

    let init_ix = spl_token::instruction::initialize_mint(
        &spl_token::id(),
        accs.pool_mint.info().key,
        accs.custody_signer.info().key,
        None,
        accs.from_mint.decimals,
    )?;
    invoke_signed(&init_ix, ctx.accounts, &[])?;

    // Set fields on pool
    accs.pool.from = *accs.from_mint.info().key;
    accs.pool.to = *accs.to_mint.info().key;

    // Create pool
    accs.pool.create(
        &MigrationPoolDerivationData {
            from: *accs.from_mint.info().key,
            to: *accs.to_mint.info().key,
        },
        ctx,
        accs.payer.key,
        Exempt,
    )?;

    Ok(())
}
