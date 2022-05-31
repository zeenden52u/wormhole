use crate::{
    accounts::{
        AuthoritySigner,
        CustodySigner,
        FromCustodyTokenAccount,
        FromCustodyTokenAccountDerivationData,
        MigrationPool,
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
    processors::seeded::{
        invoke_seeded,
        Seeded,
    },
    AccountState::*,
    *,
};

accounts!(MigrateTokens {
    pool: Mut<MigrationPool<'info, { Initialized }>>,
    from_mint: Data<'info, SplMint, { Initialized }>,
    to_mint: Data<'info, SplMint, { Initialized }>,
    to_token_custody: Mut<ToCustodyTokenAccount<'info, { Initialized }>>,
    from_token_custody: Mut<FromCustodyTokenAccount<'info, { Initialized }>>,
    user_from_acc: Mut<Data<'info, SplAccount, { Initialized }>>,
    user_to_acc: Mut<Data<'info, SplAccount, { Initialized }>>,
    custody_signer: CustodySigner<'info>,
    authority_signer: AuthoritySigner<'info>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct MigrateTokensData {
    pub amount: u64,
}

pub fn migrate_tokens(
    ctx: &ExecutionContext,
    accs: &mut MigrateTokens,
    data: MigrateTokensData,
) -> Result<()> {
    if *accs.from_mint.info().key != accs.pool.from {
        return Err(WrongMint.into());
    }
    if *accs.to_mint.info().key != accs.pool.to {
        return Err(WrongMint.into());
    }
    if accs.user_from_acc.mint != accs.pool.from {
        return Err(WrongMint.into());
    }
    if accs.user_to_acc.mint != accs.pool.to {
        return Err(WrongMint.into());
    }
    accs.to_token_custody.verify_derivation(
        ctx.program_id,
        &ToCustodyTokenAccountDerivationData {
            pool: *accs.pool.info().key,
        },
    )?;
    accs.from_token_custody.verify_derivation(
        ctx.program_id,
        &FromCustodyTokenAccountDerivationData {
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

    // Transfer in-tokens in
    let transfer_ix = spl_token::instruction::transfer(
        &spl_token::id(),
        accs.user_from_acc.info().key,
        accs.from_token_custody.info().key,
        accs.authority_signer.key,
        &[],
        data.amount,
    )?;
    invoke_seeded(&transfer_ix, ctx, &accs.authority_signer, None)?;

    // The out amount needs to be decimal adjusted
    let out_amount = if accs.from_mint.decimals > accs.to_mint.decimals {
        data.amount
            .checked_div(10u64.pow((accs.from_mint.decimals - accs.to_mint.decimals) as u32))
            .unwrap()
    } else {
        data.amount
            .checked_mul(10u64.pow((accs.to_mint.decimals - accs.from_mint.decimals) as u32))
            .unwrap()
    };

    // Transfer out-tokens to user
    let transfer_ix = spl_token::instruction::transfer(
        &spl_token::id(),
        accs.to_token_custody.info().key,
        accs.user_to_acc.info().key,
        accs.custody_signer.key,
        &[],
        out_amount,
    )?;
    invoke_seeded(&transfer_ix, ctx, &accs.custody_signer, None)?;

    Ok(())
}
