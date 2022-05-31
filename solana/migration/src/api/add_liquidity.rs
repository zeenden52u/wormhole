use crate::{
    accounts::{
        AuthoritySigner,
        CustodySigner,
        MigrationPool,
        ShareMint,
        ShareMintDerivationData,
        ToCustodyTokenAccount,
        ToCustodyTokenAccountDerivationData,
    },
    types::{
        SplAccount,
        SplMint,
    },
    MigrationError::WrongMint,
};
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};

use crate::accounts::MigrationPoolDerivationData;
use solitaire::{
    AccountState::*,
    *,
};

accounts!(AddLiquidity {
    pool:             Mut<MigrationPool<'info, { Initialized }>>,
    from_mint:        Data<'info, SplMint, { Initialized }>,
    to_mint:          Data<'info, SplMint, { Initialized }>,
    to_token_custody: Mut<ToCustodyTokenAccount<'info, { Initialized }>>,
    share_mint:       Mut<ShareMint<'info, { Initialized }>>,
    to_lp_acc:        Mut<Data<'info, SplAccount, { Initialized }>>,
    lp_share_acc:     Mut<Data<'info, SplAccount, { Initialized }>>,
    custody_signer:   CustodySigner<'info>,
    authority_signer: AuthoritySigner<'info>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct AddLiquidityData {
    pub amount: u64,
}

pub fn add_liquidity(
    ctx: &ExecutionContext,
    accs: &mut AddLiquidity,
    data: AddLiquidityData,
) -> Result<()> {
    if *accs.from_mint.info().key != accs.pool.from {
        return Err(WrongMint.into());
    }
    if *accs.to_mint.info().key != accs.pool.to {
        return Err(WrongMint.into());
    }
    if accs.lp_share_acc.mint != *accs.share_mint.info().key {
        return Err(WrongMint.into());
    }
    accs.to_token_custody.verify_derivation(
        ctx.program_id,
        &ToCustodyTokenAccountDerivationData {
            pool: *accs.pool.info().key,
        },
    )?;
    accs.share_mint.verify_derivation(
        ctx.program_id,
        &ShareMintDerivationData {
            pool: *accs.pool.info().key,
        },
    )?;
    accs.pool.verify_derivation(
        ctx.program_id,
        &MigrationPoolDerivationData {
            from: accs.pool.from,
            to: accs.pool.to,
        },
    )?;

    let to_tokens_in = if accs.from_mint.decimals > accs.to_mint.decimals {
        data.amount
    } else {
        data.amount
            - (data.amount % 10u64.pow((accs.to_mint.decimals - accs.from_mint.decimals) as u32))
    };

    // Transfer out-tokens in
    let transfer_ix = spl_token::instruction::transfer(
        &spl_token::id(),
        accs.to_lp_acc.info().key,
        accs.to_token_custody.info().key,
        accs.authority_signer.key,
        &[],
        to_tokens_in,
    )?;
    invoke_seeded(&transfer_ix, ctx, &accs.authority_signer, None)?;

    // The share amount should be equal to the amount of from tokens an lp would be getting
    let share_amount = if accs.from_mint.decimals > accs.to_mint.decimals {
        data.amount
            .checked_mul(10u64.pow((accs.from_mint.decimals - accs.to_mint.decimals) as u32))
            .unwrap()
    } else {
        data.amount
            .checked_div(10u64.pow((accs.to_mint.decimals - accs.from_mint.decimals) as u32))
            .unwrap()
    };

    // Mint LP shares
    let mint_ix = spl_token::instruction::mint_to(
        &spl_token::id(),
        accs.share_mint.info().key,
        accs.lp_share_acc.info().key,
        accs.custody_signer.key,
        &[],
        share_amount,
    )?;
    invoke_seeded(&mint_ix, ctx, &accs.custody_signer, None)?;

    Ok(())
}
