package keeper

import (
	"fmt"

	"github.com/tendermint/tendermint/libs/log"

	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"
	upgradekeeper "github.com/cosmos/cosmos-sdk/x/upgrade/keeper"
	ibcClientKeeper "github.com/cosmos/ibc-go/v4/modules/core/02-client/keeper"
	"github.com/wormhole-foundation/wormchain/x/wormhole/types"
)

type (
	Keeper struct {
		cdc      codec.BinaryCodec
		storeKey sdk.StoreKey
		memKey   sdk.StoreKey

		accountKeeper   types.AccountKeeper
		bankKeeper      types.BankKeeper
		wasmdKeeper     types.WasmdKeeper
		upgradeKeeper   upgradekeeper.Keeper
		ibcClientKeeper ibcClientKeeper.Keeper

		setWasmd     bool
		setUpgrade   bool
		setIbcClient bool
	}
)

func NewKeeper(
	cdc codec.BinaryCodec,
	storeKey,
	memKey sdk.StoreKey,

	accountKeeper types.AccountKeeper, bankKeeper types.BankKeeper,
) *Keeper {
	return &Keeper{
		cdc:      cdc,
		storeKey: storeKey,
		memKey:   memKey,

		accountKeeper: accountKeeper, bankKeeper: bankKeeper,
	}
}

// This is necessary because x/staking relies on x/wormhole and x/wasmd relies on x/staking,
// So we must either:
// 1. make wormhole depend on staking and replace the modified functions from here.
// 2. add a new module that wraps x/wasmd instead of using x/wormhole.
// 3. (current) set wasmdKeeper late in init and use guards whenever it's referenced.
// Opted for (3) as we only reference in two places.
func (k *Keeper) SetWasmdKeeper(keeper types.WasmdKeeper) {
	k.wasmdKeeper = keeper
	k.setWasmd = true
}

// We need to set UpgradeKeeper after initialization for the same reason as the above.
func (k *Keeper) SetUpgradeKeeper(keeper upgradekeeper.Keeper) {
	k.upgradeKeeper = keeper
	k.setUpgrade = true
}

// We need to set IbcClientKeeper after initialization for the same reason as the above.
func (k *Keeper) SetIbcClientKeeper(keeper ibcClientKeeper.Keeper) {
	k.ibcClientKeeper = keeper
	k.setIbcClient = true
}

func (k Keeper) Logger(ctx sdk.Context) log.Logger {
	return ctx.Logger().With("module", fmt.Sprintf("x/%s", types.ModuleName))
}
