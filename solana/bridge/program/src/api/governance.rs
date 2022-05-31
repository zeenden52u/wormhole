use solitaire::*;

use solana_program::{
    log::sol_log,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{
        clock::Clock,
        rent::Rent,
    },
};
use solitaire::{
    processors::seeded::Seeded,
    CreationLamports::Exempt,
};

use crate::{
    accounts::{
        Bridge,
        GuardianSet,
        GuardianSetDerivationData,
    },
    error::Error::{
        InvalidFeeRecipient,
        InvalidGovernanceKey,
        InvalidGovernanceWithdrawal,
        InvalidGuardianSetUpgrade,
    },
    types::{
        GovernancePayloadGuardianSetChange,
        GovernancePayloadSetMessageFee,
        GovernancePayloadTransferFees,
        GovernancePayloadUpgrade,
    },
    vaa::ClaimableVAA,
    DeserializePayload,
    PayloadMessage,
    CHAIN_ID_SOLANA,
};

fn verify_governance<'a, T>(vaa: &PayloadMessage<'a, T>) -> Result<()>
where
    T: DeserializePayload,
{
    let expected_emitter = std::env!("EMITTER_ADDRESS");
    let current_emitter = format!("{}", Pubkey::new_from_array(vaa.meta().emitter_address));
    // Fail if the emitter is not the known governance key, or the emitting chain is not Solana.
    if expected_emitter != current_emitter || vaa.meta().emitter_chain != CHAIN_ID_SOLANA {
        Err(InvalidGovernanceKey.into())
    } else {
        Ok(())
    }
}


impl<'b> InstructionContext<'b> for UpgradeContract<'b> {
}
accounts!(UpgradeContract {
    payer:             Mut<Signer<Info<'info>>>,
    bridge:            Mut<Bridge<'info, { AccountState::Initialized }>>,
    vaa:               PayloadMessage<'info, GovernancePayloadUpgrade>,
    vaa_claim:         ClaimableVAA<'info>,
    upgrade_authority: Derive<Info<'info>, "upgrade">,
    spill:             Mut<Info<'info>>,
    buffer:            Mut<Info<'info>>,
    program_data:      Mut<Info<'info>>,
    own_address:       Mut<Info<'info>>,
    rent:              Sysvar<'info, Rent>,
    clock:             Sysvar<'info, Clock>,
    bpf_loader:        Info<'info>,
    system:            Info<'info>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct UpgradeContractData {}

pub fn upgrade_contract(
    ctx: &ExecutionContext,
    accs: &mut UpgradeContract,
    _data: UpgradeContractData,
) -> Result<()> {
    verify_governance(&accs.vaa)?;
    accs.vaa_claim.claim(ctx, accs.payer.key, &accs.vaa)?;

    let upgrade_ix = solana_program::bpf_loader_upgradeable::upgrade(
        ctx.program_id,
        &accs.vaa.new_contract,
        accs.upgrade_authority.key,
        accs.spill.key,
    );

    let seeds = accs
        .upgrade_authority
        .self_bumped_seeds(None, ctx.program_id);
    let seeds: Vec<&[u8]> = seeds.iter().map(|item| item.as_slice()).collect();
    let seeds = seeds.as_slice();
    invoke_signed(&upgrade_ix, ctx.accounts, &[seeds])?;

    Ok(())
}


impl<'b> InstructionContext<'b> for UpgradeGuardianSet<'b> {
}
accounts!(UpgradeGuardianSet {
    payer:            Mut<Signer<Info<'info>>>,
    bridge:           Mut<Bridge<'info, { AccountState::Initialized }>>,
    vaa:              PayloadMessage<'info, GovernancePayloadGuardianSetChange>,
    vaa_claim:        ClaimableVAA<'info>,
    guardian_set_old: Mut<GuardianSet<'info, { AccountState::Initialized }>>,
    guardian_set_new: Mut<GuardianSet<'info, { AccountState::Uninitialized }>>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct UpgradeGuardianSetData {}

pub fn upgrade_guardian_set(
    ctx: &ExecutionContext,
    accs: &mut UpgradeGuardianSet,
    _data: UpgradeGuardianSetData,
) -> Result<()> {
    // Enforce single increments when upgrading.
    if accs.guardian_set_old.index != accs.vaa.new_guardian_set_index - 1 {
        return Err(InvalidGuardianSetUpgrade.into());
    }

    // Confirm that the version the bridge has active is the previous version.
    if accs.bridge.guardian_set_index != accs.vaa.new_guardian_set_index - 1 {
        return Err(InvalidGuardianSetUpgrade.into());
    }

    verify_governance(&accs.vaa)?;
    accs.guardian_set_old.verify_derivation(
        ctx.program_id,
        &GuardianSetDerivationData {
            index: accs.vaa.new_guardian_set_index - 1,
        },
    )?;
    accs.guardian_set_new.verify_derivation(
        ctx.program_id,
        &GuardianSetDerivationData {
            index: accs.vaa.new_guardian_set_index,
        },
    )?;

    accs.vaa_claim.claim(ctx, accs.payer.key, &accs.vaa)?;

    // Set expiration time for the old set
    accs.guardian_set_old.expiration_time =
        accs.vaa.meta().vaa_time + accs.bridge.config.guardian_set_expiration_time;

    // Initialize new guardian Set
    accs.guardian_set_new.index = accs.vaa.new_guardian_set_index;
    accs.guardian_set_new.creation_time = accs.vaa.meta().vaa_time;
    accs.guardian_set_new.keys = accs.vaa.new_guardian_set.clone();

    // Create new guardian set
    // This is done after populating it to properly allocate space according to key vec length.
    accs.guardian_set_new.create(
        &GuardianSetDerivationData {
            index: accs.guardian_set_new.index,
        },
        ctx,
        accs.payer.key,
        Exempt,
    )?;

    // Set guardian set index
    accs.bridge.guardian_set_index = accs.vaa.new_guardian_set_index;

    Ok(())
}


impl<'b> InstructionContext<'b> for SetFees<'b> {
}
accounts!(SetFees {
    payer:     Mut<Signer<Info<'info>>>,
    bridge:    Mut<Bridge<'info, { AccountState::Initialized }>>,
    vaa:       PayloadMessage<'info, GovernancePayloadSetMessageFee>,
    vaa_claim: ClaimableVAA<'info>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct SetFeesData {}

pub fn set_fees(ctx: &ExecutionContext, accs: &mut SetFees, _data: SetFeesData) -> Result<()> {
    verify_governance(&accs.vaa)?;
    accs.vaa_claim.claim(ctx, accs.payer.key, &accs.vaa)?;
    accs.bridge.config.fee = accs.vaa.fee.as_u64();

    Ok(())
}


impl<'b> InstructionContext<'b> for TransferFees<'b> {
}
accounts!(TransferFees {
    payer:         Mut<Signer<Info<'info>>>,
    bridge:        Bridge<'info, { AccountState::Initialized }>,
    vaa:           PayloadMessage<'info, GovernancePayloadTransferFees>,
    vaa_claim:     ClaimableVAA<'info>,
    fee_collector: Mut<Derive<Info<'info>, "fee_collector">>,
    recipient:     Mut<Info<'info>>,
    rent:          Sysvar<'info, Rent>,
});

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct TransferFeesData {}

pub fn transfer_fees(
    ctx: &ExecutionContext,
    accs: &mut TransferFees,
    _data: TransferFeesData,
) -> Result<()> {
    // Make sure the account loaded to receive funds is equal to the one the VAA requested.
    if accs.vaa.to != accs.recipient.key.to_bytes() {
        return Err(InvalidFeeRecipient.into());
    }

    if accs
        .fee_collector
        .lamports()
        .saturating_sub(accs.vaa.amount.as_u64())
        < accs.rent.minimum_balance(accs.fee_collector.data_len())
    {
        return Err(InvalidGovernanceWithdrawal.into());
    }

    verify_governance(&accs.vaa)?;
    accs.vaa_claim.claim(ctx, accs.payer.key, &accs.vaa)?;

    // Transfer fees
    let transfer_ix = solana_program::system_instruction::transfer(
        accs.fee_collector.key,
        accs.recipient.key,
        accs.vaa.amount.as_u64(),
    );

    let seeds = accs.fee_collector.self_bumped_seeds(None, ctx.program_id);
    let seeds: Vec<&[u8]> = seeds.iter().map(|item| item.as_slice()).collect();
    let seeds = seeds.as_slice();
    invoke_signed(&transfer_ix, ctx.accounts, &[seeds])?;

    Ok(())
}
