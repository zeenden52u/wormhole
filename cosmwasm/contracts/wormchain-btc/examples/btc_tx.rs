// extern crate bitcoin;
// extern crate bitcoincore_rpc;

use bitcoincore_rpc::{Auth, Client, RpcApi};
use std::str::FromStr;

use bitcoin::Address;
use bitcoin::util::bip32::{ChildNumber, DerivationPath, ExtendedPrivKey, ExtendedPubKey};
use bitcoin::hashes::hex::FromHex;
use bitcoin::secp256k1::ffi::types::AlignedType;
use bitcoin::secp256k1::Secp256k1;
use bitcoin::PublicKey;

fn main() {
    let seed_hex = "b27d7f9c6d3b7c1a19bb414bf379872d94d0fbed286b9ed0d37b2a822f2e1053";

    // default network as mainnet
    let network = bitcoin::Network::Regtest;
    let seed = Vec::from_hex(seed_hex).unwrap();

    // we need secp256k1 context for key derivation
    let mut buf: Vec<AlignedType> = Vec::new();
    buf.resize(Secp256k1::preallocate_size(), AlignedType::zeroed());
    let secp = Secp256k1::preallocated_new(buf.as_mut_slice()).unwrap();

    // calculate root key from seed
    let root = ExtendedPrivKey::new_master(network, &seed).unwrap();

    // derive child xpub
    let path = DerivationPath::from_str("m/84h/0h/0h").unwrap();
    let child = root.derive_priv(&secp, &path).unwrap();
    let xpub = ExtendedPubKey::from_priv(&secp, &child);

    // generate first receiving address at m/0/0
    // manually creating indexes this time
    let zero = ChildNumber::from_normal_idx(0).unwrap();
    let public_key = xpub.derive_pub(&secp, &vec![zero, zero]).unwrap().public_key;
    let _address = Address::p2wpkh(&PublicKey::new(public_key), network).unwrap();

    let rpc = Client::new("http://127.0.0.1:18334",

    // let rpc = Client::new("http://localhost:8000",
                          Auth::UserPass("user".to_string(),
                                         "password".to_string())).unwrap();
    // let count = rpc.get_block_count().unwrap();
    let best_block_hash = rpc.get_best_block_hash().unwrap();
    println!("best block hash: {}", best_block_hash);
}

