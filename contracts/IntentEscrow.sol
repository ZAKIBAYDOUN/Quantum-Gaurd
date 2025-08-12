// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {QNNOracle} from "./QNNOracle.sol";

interface ISwapAdapter {
    function execute(bytes calldata params) external payable returns (uint256 outAmount);
}

contract IntentEscrow is ReentrancyGuard {
    struct Commit {
        address user;
        uint256 value;
        uint64  deadline;
        bool    revealed;
    }

    mapping(bytes32 => Commit) public commits;
    QNNOracle public immutable oracle;
    ISwapAdapter public immutable adapter;

    event Committed(bytes32 indexed cid, address indexed user, uint256 value, uint64 deadline);
    event Revealed(bytes32 indexed cid, uint256 outAmount);

    constructor(QNNOracle _oracle, ISwapAdapter _adapter) {
        oracle = _oracle;
        adapter = _adapter;
    }

    /// @notice commit = keccak256(user, paramsHash, salt, deadline)
    function commit(bytes32 cid, uint64 deadline) external payable nonReentrant {
        require(commits[cid].user == address(0), "exists");
        commits[cid] = Commit({user: msg.sender, value: msg.value, deadline: deadline, revealed: false});
        emit Committed(cid, msg.sender, msg.value, deadline);
    }

    /**
     * @param params datos para el adapter (ej. swap route)
     * @param salt   sal usada en el preimage
     * @param s      payload firmado del oráculo
     * @param sigs   firmas de validadores (>= minSignatures)
     */
    function reveal(bytes calldata params, bytes32 paramsHash, bytes32 salt, QNNOracle.Score calldata s, bytes[] calldata sigs)
        external
        nonReentrant
        returns (uint256 outAmount)
    {
        bytes32 cid = keccak256(abi.encode(msg.sender, paramsHash, salt, s.deadline));
        Commit storage c = commits[cid];
        require(c.user == msg.sender, "not owner");
        require(!c.revealed, "already");
        require(c.deadline == 0 || block.timestamp <= c.deadline, "expired");
        require(oracle.verifyScore(s, sigs), "risk");

        c.revealed = true;
        outAmount = adapter.execute{value: c.value}(params);
        emit Revealed(cid, outAmount);
    }

    function refund(bytes32 cid) external nonReentrant {
        Commit storage c = commits[cid];
        require(c.user == msg.sender, "not owner");
        require(!c.revealed, "revealed");
        require(c.deadline != 0 && block.timestamp > c.deadline, "not expired");
        uint256 v = c.value;
        delete commits[cid];
        (bool ok,) = msg.sender.call{value: v}("");
        require(ok, "refund fail");
    }
}