// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {QNNOracle} from "./QNNOracle.sol";

/**
 * @title ReputationSBT
 * @notice SBT con "grade" ligado a identidad (no transferible). Grade se decide por score firmado (2-de-N).
 */
contract ReputationSBT is ERC721, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    QNNOracle public immutable oracle;
    mapping(uint256 => uint8) public grade; // 0=Unrated, 1=A, 2=B, 3=C, 4=D
    mapping(address => uint256) public tokenOf; // 1:1

    event GradeUpdated(uint256 indexed tokenId, uint8 grade, uint256 score);

    constructor(address admin, QNNOracle _oracle) ERC721("5470 Reputation", "SBT5470") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        oracle = _oracle;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://reputation/";
    }

    function _isApprovedOrOwner(address, uint256) internal pure override returns (bool) { return false; }
    function approve(address, uint256) public pure override { revert("SBT: non-transferable"); }
    function setApprovalForAll(address, bool) public pure override { revert("SBT: non-transferable"); }
    function transferFrom(address, address, uint256) public pure override { revert("SBT: non-transferable"); }
    function safeTransferFrom(address, address, uint256) public pure override { revert("SBT: non-transferable"); }
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override { revert("SBT: non-transferable"); }

    function _ensure(address user) internal returns (uint256 id) {
        id = tokenOf[user];
        if (id == 0) {
            id = uint256(uint160(user));
            tokenOf[user] = id;
            _mint(user, id);
        }
    }

    /// @notice Emite/actualiza grade usando un score firmado por el oráculo (p.ej. SVM/LR calibrado).
    function attestWithScore(
        address user,
        QNNOracle.Score calldata s,
        bytes[] calldata sigs
    ) external onlyRole(ISSUER_ROLE) {
        require(s.sender == user, "bad sender");
        require(oracle.verifyScore(s, sigs), "risk sigs invalid");
        uint256 id = _ensure(user);

        // Tiering por score (0..1e6), inspirado en tus matrices (umbrales tunables)
        // A: >= 900k, B: >= 850k, C: >= 750k, D: < 750k
        uint8 g = s.score >= 900_000 ? 1 : s.score >= 850_000 ? 2 : s.score >= 750_000 ? 3 : 4;
        grade[id] = g;
        emit GradeUpdated(id, g, s.score);
    }

    function gradeOf(address user) external view returns (uint8) {
        uint256 id = tokenOf[user];
        return id == 0 ? 0 : grade[id];
    }
}