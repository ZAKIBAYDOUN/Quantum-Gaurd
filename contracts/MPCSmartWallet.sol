// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {QNNOracle} from "./QNNOracle.sol";

contract MPCSmartWallet is IERC1271, ReentrancyGuard {
    using ECDSA for bytes32;

    address public ownerA;
    address public ownerB;
    QNNOracle public immutable oracle;

    mapping(bytes32 => bool) public executed;      // replay protection
    mapping(address => uint64) public sessionKeys; // key => expiry

    event OwnersUpdated(address A, address B);
    event SessionKey(address key, uint64 expiry);
    event Executed(bytes32 id, bool success);

    constructor(address _a, address _b, QNNOracle _oracle) {
        ownerA = _a; ownerB = _b; oracle = _oracle;
        emit OwnersUpdated(_a, _b);
    }

    modifier onlyAliveSession() {
        if (sessionKeys[msg.sender] != 0) {
            require(block.timestamp <= sessionKeys[msg.sender], "session expired");
        } else {
            require(false, "not session");
        }
        _;
    }

    function setOwners(address _a, address _b) external {
        require(msg.sender == ownerA || msg.sender == ownerB, "auth");
        ownerA = _a; ownerB = _b;
        emit OwnersUpdated(_a, _b);
    }

    function setSessionKey(address key, uint64 expiry) external {
        require(msg.sender == ownerA || msg.sender == ownerB, "auth");
        sessionKeys[key] = expiry;
        emit SessionKey(key, expiry);
    }

    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    /**
     * @dev Ejecuta lote si hay 2 firmas válidas y QNN aprueba el riesgo (opcional).
     * id = keccak256(this, calls, nonce)
     */
    function execute(
        Call[] calldata calls,
        uint256 nonce,
        bytes calldata sigA,
        bytes calldata sigB,
        bool requireRiskCheck,
        QNNOracle.Score calldata s,
        bytes[] calldata sigs
    ) external payable nonReentrant returns (bool[] memory results) {
        bytes32 id = keccak256(abi.encode(address(this), calls, nonce));
        require(!executed[id], "replay");
        bytes32 d = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", id));
        require(d.recover(sigA) == ownerA && d.recover(sigB) == ownerB, "bad sigs");

        if (requireRiskCheck) {
            require(oracle.verifyScore(s, sigs), "risk");
        }

        executed[id] = true;
        results = new bool[](calls.length);
        for (uint256 i; i < calls.length; i++) {
            (bool ok,) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            results[i] = ok;
        }
        emit Executed(id, true);
    }

    /// @dev EIP-1271 (para dApps): válido si lo firman A y B sobre el mismo hash
    function isValidSignature(bytes32 hash, bytes calldata signature) external view override returns (bytes4) {
        require(signature.length == 130, "need 65+65");
        bytes memory sigA = signature[:65];
        bytes memory sigB = signature[65:130];
        bool ok = (hash.recover(sigA) == ownerA) && (hash.recover(sigB) == ownerB);
        return ok ? IERC1271.isValidSignature.selector : bytes4(0);
    }

    receive() external payable {}
}