module upgrade::state {
    //use sui::object::{Self};
    //use sui::tx_context::{TxContext};
    //use sui::transfer::{Self};
    //use sui::event::{Self};

    const V: u64 = 3;

    struct Wheat has drop {
        bushels: u64,
    }

    public fun farm_wheat(): Wheat {
        return Wheat {bushels: 100}
    }

    struct Carrot has drop {
        bushels: u64,
    }

    public fun farm_carrts(): Carrot {
        return Carrot {bushels: 50}
    }
}
