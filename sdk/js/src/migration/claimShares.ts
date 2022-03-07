import { createApproveInstruction } from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { ixFromRust } from "../solana";
import { importMigrationWasm } from "../solana/wasm";

export default async function claimShares(
  connection: Connection,
  payerAddress: string,
  program_id: string,
  from_mint: string,
  to_mint: string,
  output_token_account: string,
  lp_share_token_account: string,
  amount: BigInt
) {
  const { authority_address, claim_shares } = await importMigrationWasm();
  const approvalIx = createApproveInstruction(
    new PublicKey(lp_share_token_account),
    new PublicKey(authority_address(program_id)),
    new PublicKey(payerAddress),
    amount.valueOf()
  );
  const ix = ixFromRust(
    claim_shares(
      program_id,
      from_mint,
      to_mint,
      output_token_account,
      lp_share_token_account,
      amount
    )
  );
  const transaction = new Transaction().add(approvalIx, ix);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}
