// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./interfaces/IWormhole.sol";

contract ShutdownStructs {
    struct VoterEntry {
        address key;
        bool enabled;
    }
}

abstract contract ShutdownSwitch {
    function numVotesToDisable() public view returns (uint16) {
        return votesToDisable;
    }

    function enabledFlag() public view returns (bool){
        return enabled;
    }

    event ShutdownVoteCast(address indexed voter, bool votedToEnable, uint16 numVotesToDisable, bool enableFlag);
    event ShutdownStatusChanged(bool enabledFlag, uint16 numVotesToDisable);

    function getWH() public virtual view returns (IWormhole);

    uint16 constant REQUIRED_NO_VOTES = 1;

    ShutdownStructs.VoterEntry[20] voters;
    uint32 guardianSetIndex = 0;
    uint16 votesToDisable = 0;
    bool voterSetInitialized = false;
    bool enabled = true;

    // Called by the voter's client to update their votes.
    function castShutdownVote(bool _enabled) public {
        // This line makes it unable to compute the gas.
        require(isRegisteredVoter(msg.sender), "you are not a registered voter");

        // Our set of voters is the set of guardians. If the guardian set has changed, rebuild our set of voters, setting all votes to enabled.
        uint32 gsi = getWH().getCurrentGuardianSetIndex();
        if ((guardianSetIndex != gsi) || (! voterSetInitialized)) {
            voterSetInitialized = true;
            Structs.GuardianSet memory gs = getWH().getGuardianSet(gsi);
            for (uint idx = 0; (idx < voters.length); idx++) {
                if (idx < gs.keys.length) {
                    voters[idx].key = gs.keys[idx];
                    voters[idx].enabled = true;
                } else {
                    voters[idx].key = address(0);
                    voters[idx].enabled = false;
                }
            }

            guardianSetIndex = gsi;
            votesToDisable = 0;
            enabled = true;
        }

        bool somethingChanged = false;
        uint16 numDisabled = 0;
        for (uint idx = 0; (idx < voters.length); idx++) {
            if (voters[idx].key == address(0)) {
                break;
            }

            if (voters[idx].key == msg.sender) {
                if (voters[idx].enabled != _enabled) {
                    voters[idx].enabled = _enabled;
                    somethingChanged = true;
                }
            }

            if (! voters[idx].enabled) {
                numDisabled++;
            }
        }

        bool newEnabledFlag = (numDisabled < REQUIRED_NO_VOTES);
        if (somethingChanged) {
            emit ShutdownVoteCast(msg.sender, _enabled, numDisabled, newEnabledFlag);
        }

        if (votesToDisable != numDisabled) {
            votesToDisable = numDisabled;
        }

        if (newEnabledFlag != enabled) {
            enabled = newEnabledFlag;
            emit ShutdownStatusChanged(newEnabledFlag, numDisabled);
        }
    }

    function isRegisteredVoter(address voter) public view returns(bool) {
        uint32 gsi = getWH().getCurrentGuardianSetIndex();
        Structs.GuardianSet memory gs = getWH().getGuardianSet(gsi);
        for (uint idx = 0; (idx < gs.keys.length); idx++) {
            if (voter == gs.keys[idx]) {
                return true;
            }
        }

        return false;
    }
}