// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPlonkVerifier} from "../ZKVerifierGate.sol";
import {ISwapAdapter} from "../IntentEscrow.sol";

contract MockVerifier is IPlonkVerifier {
    bool public ok = true;
    function set(bool v) external { ok = v; }
    function verifyProof(bytes calldata, uint256[] calldata) external view returns (bool) { return ok; }
}

contract MockAdapter is ISwapAdapter {
    uint256 public lastValue;
    bytes public lastParams;
    uint256 public outFixed = 42;
    function setOut(uint256 v) external { outFixed = v; }
    function execute(bytes calldata params) external payable returns (uint256 outAmount) {
        lastValue = msg.value;
        lastParams = params;
        return outFixed;
    }
}

contract Receiver {
    event Paid(address from, uint256 value, bytes data);
    function ping(bytes calldata data) external payable {
        emit Paid(msg.sender, msg.value, data);
    }
}