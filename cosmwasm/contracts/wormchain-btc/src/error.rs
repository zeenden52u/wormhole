use cosmwasm_std::StdError;
use thiserror::Error;

use chasm_contract::Error as ChasmError;

#[derive(Error, Debug, PartialEq)]
pub enum Error {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("NotImplemented")]
    NotImplemented {},

    #[error("ChasmError")]
    ChasmError(ChasmError),
}
