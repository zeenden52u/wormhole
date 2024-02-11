use crate::{
    constants::MINT_AUTHORITY_SEED_PREFIX,
    error::TokenBridgeError,
    legacy::instruction::EmptyArgs,
    state::{LegacyWrappedAsset, RegisteredEmitter},
};
use anchor_lang::prelude::*;
use anchor_spl::token;
use core_bridge_program::sdk as core_bridge;
use wormhole_raw_vaas::token_bridge::TokenBridgeMessage;
use wormhole_solana_vaas::zero_copy::VaaAccount;

#[derive(Accounts)]
pub struct CompleteTransferWrapped<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// Previously needed config account.
    ///
    /// CHECK: This account is unchecked.
    _config: UncheckedAccount<'info>,

    /// VAA account, which may either be the new EncodedVaa account or legacy PostedVaaV1
    /// account.
    ///
    /// CHECK: This account will be read via zero-copy deserialization in the instruction
    /// handler, which will determine which type of VAA account is being used. If this account
    /// is the legacy PostedVaaV1 account, its PDA address will be verified by this zero-copy
    /// reader.
    #[account(owner = core_bridge::id())]
    vaa: AccountInfo<'info>,

    /// Claim account (mut), which acts as replay protection after consuming data from the VAA
    /// account.
    ///
    /// Seeds: [emitter_address, emitter_chain, sequence],
    /// seeds::program = token_bridge_program.
    ///
    /// CHECK: This account is created via [claim_vaa](core_bridge_program::sdk::claim_vaa).
    /// This account can only be created once for this VAA.
    #[account(mut)]
    claim: AccountInfo<'info>,

    /// This account is a foreign token Bridge and is created via the Register Chain governance
    /// decree.
    ///
    /// NOTE: The seeds of this account are insane because they include the emitter address, which
    /// allows registering multiple emitter addresses for the same chain ID. These seeds are not
    /// checked via Anchor macro, but will be checked in the access control function instead.
    ///
    /// See the `require_valid_token_bridge_vaa` instruction handler for more details.
    registered_emitter: Account<'info, core_bridge::legacy::LegacyAnchorized<RegisteredEmitter>>,

    /// Recipient token account. Because we verify the wrapped mint, we can depend on the
    /// Token Program to mint the right tokens to this account because it requires that this mint
    /// equals the wrapped mint.
    #[account(mut)]
    recipient_token: Account<'info, token::TokenAccount>,

    /// CHECK: Payer (relayer) token account. Because we verify the wrapped mint, we can depend on
    /// the Token Program to mint the right tokens to this account because it requires that this
    /// mint equals the wrapped mint.
    #[account(mut)]
    payer_token: Account<'info, token::TokenAccount>,

    /// Wrapped mint (i.e. minted by Token Bridge program).
    ///
    /// CHECK: Because this mint is guaranteed to have a Wrapped Asset account (since this account's
    /// pubkey is a part of the Wrapped Asset's PDA address), we do not need to check that this
    /// mint is one that the Token Bridge program has mint authority for.
    #[account(mut)]
    wrapped_mint: AccountInfo<'info>,

    /// Wrapped asset account, which is deserialized as its legacy representation. The latest
    /// version has an additional field (sequence number), which may not deserialize if wrapped
    /// metadata were not attested again to realloc this account. So we must deserialize this as the
    /// legacy representation.
    #[account(
        seeds = [LegacyWrappedAsset::SEED_PREFIX, wrapped_mint.key().as_ref()],
        bump,
    )]
    wrapped_asset: Account<'info, core_bridge::legacy::LegacyAnchorized<LegacyWrappedAsset>>,

    /// CHECK: This account is the authority that can burn and mint wrapped assets.
    #[account(
        seeds = [MINT_AUTHORITY_SEED_PREFIX],
        bump,
    )]
    mint_authority: AccountInfo<'info>,

    /// Previously needed sysvar.
    ///
    /// CHECK: This account is unchecked.
    _rent: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
    token_program: Program<'info, token::Token>,
}

impl<'info> core_bridge::legacy::ProcessLegacyInstruction<'info, EmptyArgs>
    for CompleteTransferWrapped<'info>
{
    const LOG_IX_NAME: &'static str = "LegacyCompleteTransferWrapped";

    const ANCHOR_IX_FN: fn(Context<Self>, EmptyArgs) -> Result<()> = complete_transfer_wrapped;

    fn order_account_infos<'a>(
        account_infos: &'a [AccountInfo<'info>],
    ) -> Result<Vec<AccountInfo<'info>>> {
        super::order_complete_transfer_account_infos(account_infos)
    }
}

impl<'info> CompleteTransferWrapped<'info> {
    fn constraints(ctx: &Context<Self>) -> Result<()> {
        let (token_chain, token_address) = super::validate_token_transfer_vaa(
            &ctx.accounts.vaa,
            &ctx.accounts.registered_emitter,
            &ctx.accounts.recipient_token,
        )?;

        // For wrapped transfers, this token must have originated from another network.
        //
        // NOTE: This check may be redundant because our wrapped mint PDA should only exist for wrapped assets (i.e.
        // chain ID != 1. But there may be accounts that exist where the chain ID == 1, so we do perform this check as a
        // precaution).
        require_neq!(
            token_chain,
            wormhole_solana_consts::SOLANA_CHAIN,
            TokenBridgeError::NativeAsset
        );

        // Wrapped asset account must agree with the encoded token info.
        let asset = &ctx.accounts.wrapped_asset;
        require!(
            token_chain == asset.token_chain && token_address == asset.token_address,
            TokenBridgeError::InvalidMint
        );

        // Done.
        Ok(())
    }
}

#[access_control(CompleteTransferWrapped::constraints(&ctx))]
fn complete_transfer_wrapped(
    ctx: Context<CompleteTransferWrapped>,
    _args: EmptyArgs,
) -> Result<()> {
    let vaa = VaaAccount::load_unchecked(&ctx.accounts.vaa);

    // Create the claim account to provide replay protection. Because this instruction creates this
    // account every time it is executed, this account cannot be created again with this emitter
    // address, chain and sequence combination.
    core_bridge::claim_vaa(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            core_bridge::ClaimVaa {
                claim: ctx.accounts.claim.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
            },
        ),
        &crate::ID,
        &vaa,
        None,
    )?;

    let transfer = TokenBridgeMessage::try_from(vaa.payload())
        .unwrap()
        .to_transfer_unchecked();

    // We do not have to denormalize wrapped mint amounts because by definition wrapped mints can
    // only have a max of 8 decimals, which is the same as the cap for normalized amounts.
    let mut mint_amount = transfer
        .encoded_amount()
        .0
        .try_into()
        .map_err(|_| TokenBridgeError::U64Overflow)?;
    let relayer_payout = transfer.encoded_relayer_fee().0.try_into().unwrap();

    // Save references to the token accounts to be used later.
    let recipient_token = &ctx.accounts.recipient_token;
    let payer_token = &ctx.accounts.payer_token;

    // Mint authority is who has the authority to mint.
    let mint_authority_seeds = &[MINT_AUTHORITY_SEED_PREFIX, &[ctx.bumps["mint_authority"]]];

    // If there is a payout to the relayer and the relayer's token account differs from the transfer
    // recipient's, we have to make an extra mint.
    if relayer_payout > 0 && recipient_token.key() != payer_token.key() {
        // NOTE: This math operation is safe because the relayer payout is always <= to the
        // total outbound transfer amount.
        mint_amount -= relayer_payout;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.payer_token.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[mint_authority_seeds],
            ),
            relayer_payout,
        )?;
    }

    // If there is any amount left after the relayer payout, finally mint remaining.
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.wrapped_mint.to_account_info(),
                to: ctx.accounts.recipient_token.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[mint_authority_seeds],
        ),
        mint_amount,
    )
}
