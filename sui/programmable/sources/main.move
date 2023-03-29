module programmable::state {
    use sui::object::{Self};
    use sui::tx_context::{TxContext};
    use sui::transfer::{Self};
    use sui::event::{Self};

    struct A has drop {
        A: u64,
    }

    struct B has copy, drop {
        B: u64
    }

    struct State has key {
        id: object::UID,
        counter: u64,
    }

    fun init(ctx: &mut TxContext){
        transfer::share_object(State {id: object::new(ctx), counter: 0});
    }

    public fun produce_A(state: &mut State): A{
        state.counter = state.counter + 1;
        return A{A: 6}
    }

    public fun consume_A_produce_B(_A: A, state: &mut State): B {
        state.counter = state.counter + 1;
        return B{B:9}
    }

     public fun consume_B_produce_int(_B: B, state: &mut State): u64 {
        state.counter = state.counter + 1;
        event::emit(B{B:100});
        return 42
    }
}
