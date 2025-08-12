// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {QNNOracle} from "./QNNOracle.sol";
import {ReputationSBT} from "./ReputationSBT.sol";

/**
 * @title GasSponsorVault
 * @notice Patrocinador de gas: reembolsa un stipend en ETH a usuarios de bajo riesgo (A/B) para UX tipo "meta-tx" sin AA.
 */
contract GasSponsorVault is AccessControl {
    bytes32 public constant SPONSOR_ROLE = keccak256("SPONSOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    QNNOracle public immutable oracle;
    ReputationSBT public immutable sbt;

    // allowance diaria por grade (wei): A=0.01 ETH, B=0.005 ETH, C/D=0
    uint256[5] public dailyAllowance = [0, 0.01 ether, 0.005 ether, 0, 0];

    struct User {
        uint256 usedToday;   // wei gastado hoy
        uint64  lastReset;   // timestamp último reset (día)
        uint256 totalSpent;  // acumulado histórico
    }

    mapping(address => User) public users;

    event Deposit(address indexed from, uint256 amount);
    event Refund(address indexed user, uint256 amount, uint8 grade);

    constructor(address admin, QNNOracle _oracle, ReputationSBT _sbt) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SPONSOR_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        oracle = _oracle;
        sbt = _sbt;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function setAllowances(uint256[5] calldata newAllowances) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyAllowance = newAllowances;
    }

    function _resetIfNewDay(address user) internal {
        User storage u = users[user];
        uint64 today = uint64(block.timestamp / 1 days);
        if (u.lastReset < today) {
            u.usedToday = 0;
            u.lastReset = today;
        }
    }

    /// @notice Reembolsa gas a usuario con score válido y grade elegible (A/B).
    function sponsorGas(
        address user,
        uint256 gasUsed,
        uint256 gasPrice,
        QNNOracle.Score calldata s,
        bytes[] calldata sigs
    ) external onlyRole(SPONSOR_ROLE) {
        require(s.sender == user, "bad sender");
        require(oracle.verifyScore(s, sigs), "bad score");
        
        uint8 grade = sbt.gradeOf(user);
        require(grade <= 2 && grade > 0, "grade not eligible"); // solo A o B
        
        _resetIfNewDay(user);
        User storage u = users[user];
        
        uint256 refund = gasUsed * gasPrice;
        uint256 available = dailyAllowance[grade] - u.usedToday;
        
        if (refund > available) refund = available;
        require(refund > 0, "no allowance");
        require(address(this).balance >= refund, "insufficient vault");
        
        u.usedToday += refund;
        u.totalSpent += refund;
        
        payable(user).transfer(refund);
        emit Refund(user, refund, grade);
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        payable(to).transfer(amount);
    }

    function getRemainingAllowance(address user) external view returns (uint256) {
        uint8 grade = sbt.gradeOf(user);
        if (grade == 0 || grade > 2) return 0;
        
        User memory u = users[user];
        uint64 today = uint64(block.timestamp / 1 days);
        uint256 used = (u.lastReset < today) ? 0 : u.usedToday;
        
        return dailyAllowance[grade] > used ? dailyAllowance[grade] - used : 0;
    }
}