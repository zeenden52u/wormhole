use crate::{
    accounts::{
        ConfigAccount,
        Endpoint,
        EndpointDerivationData,
    },
    messages::{
        GovernancePayloadUpgrade,
        PayloadGovernanceRegisterChain,
    },
    TokenBridgeError::{
        InvalidChain,
        InvalidGovernanceKey,
    },
};
use bridge::{
    vaa::{
        ClaimableVAA,
        DeserializePayload,
    },
    PayloadMessage,
    CHAIN_ID_SOLANA,
};
use solana_program::{
    account_info::AccountInfo,
    program::invoke_signed,
    pubkey::Pubkey,
    sysvar::{
        clock::Clock,
        rent::Rent,
    },
};
use solitaire::{
    processors::seeded::Seeded,
    AccountState::*,
    CreationLamports::Exempt,
    *,
};

// Confirm that a ClaimableVAA came from the correct chain, signed by the right emitter.
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

accounts!(RegisterChain {
    payer:     Mut<Signer<AccountInfo<'info>>>,
    config:    ConfigAccount<'info, { Initialized }>,
    endpoint:  Mut<Endpoint<'info, { Uninitialized }>>,
    vaa:       PayloadMessage<'info, PayloadGovernanceRegisterChain>,
    vaa_claim: ClaimableVAA<'info>,
});

impl<'a> From<&RegisterChain<'a>> for EndpointDerivationData {
    fn from(accs: &RegisterChain<'a>) -> Self {
        EndpointDerivationData {
            emitter_chain: accs.vaa.chain,
            emitter_address: accs.vaa.endpoint_address,
        }
    }
}

impl<'b> InstructionContext<'b> for RegisterChain<'b> {
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct RegisterChainData {}

pub fn register_chain(
    ctx: &ExecutionContext,
    accs: &mut RegisterChain,
    _data: RegisterChainData,
) -> Result<()> {
    let derivation_data: EndpointDerivationData = (&*accs).into();
    accs.endpoint
        .verify_derivation(ctx.program_id, &derivation_data)?;

    // Claim VAA
    verify_governance(&accs.vaa)?;
    accs.vaa_claim.claim(ctx, accs.payer.key, &accs.vaa)?;

    if accs.vaa.chain == CHAIN_ID_SOLANA {
        return Err(InvalidChain.into());
    }

    // Create endpoint
    accs.endpoint
        .create(&((&*accs).into()), ctx, accs.payer.key, Exempt)?;

    accs.endpoint.chain = accs.vaa.chain;
    accs.endpoint.contract = accs.vaa.endpoint_address;

    Ok(())
}
