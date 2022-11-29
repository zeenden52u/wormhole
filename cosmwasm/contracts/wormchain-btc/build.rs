// use std::{env::var, fs, path::PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {

    vergen::vergen(vergen::Config::default())?;

    Ok(())
}

