//! This macro produces a type that overrides the borsh serialization methods with the ones
//! provided by the solana Pack types. This allows us to support legacy serialization for other
//! on-chain programs that still use Pack types.

#[macro_export]
macro_rules! pack_type {
    ($name:ident, $embed:ty, $owner:expr) => {
        #[repr(transparent)]
        pub struct $name(pub $embed);

        impl BorshDeserialize for $name {
            fn deserialize(buf: &mut &[u8]) -> std::io::Result<Self> {
                let acc = $name(
                    solana_program::program_pack::Pack::unpack(buf)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?,
                );
                // We need to clear the buf to show to Borsh that we've read all data
                *buf = &buf[..0];

                Ok(acc)
            }
        }

        impl BorshSerialize for $name {
            fn serialize<W: std::io::Write>(&self, writer: &mut W) -> std::io::Result<()> {
                let mut data = [0u8; <$embed as solana_program::program_pack::Pack>::LEN];
                solana_program::program_pack::Pack::pack_into_slice(&self.0, &mut data);
                writer.write(&data)?;

                Ok(())
            }
        }

        impl solitaire::processors::seeded::Owned for $name {
            fn owner(&self) -> solitaire::processors::seeded::AccountOwner {
                return $owner;
            }
        }

        impl std::ops::Deref for $name {
            type Target = $embed;
            fn deref(&self) -> &Self::Target {
                unsafe { std::mem::transmute(&self.0) }
            }
        }

        impl std::default::Default for $name {
            fn default() -> Self {
                $name(<$embed>::default())
            }
        }
    };
}
