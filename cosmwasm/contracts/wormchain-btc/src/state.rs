use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use chasm_types::api::{request::{KeyMeta, ThresholdMeta}};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Cluster {
    pub name: String,
    pub threshold: ThresholdMeta,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema, Default)]
pub struct Key {
    pub meta: KeyMeta,
    #[serde(serialize_with = "chasm_types::base64_serde::serialize", deserialize_with = "chasm_types::base64_serde::deserialize")]
    pub public_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema, Default)]
#[serde(rename_all = "snake_case")]
pub struct EchoRecord {
    pub echo: String,
}