// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Receiver {
    event XSet(uint256 x, address indexed caller);

    uint256 public x;

    function setX(uint256 newX) external {
        x = newX;
        emit XSet(newX, msg.sender);
    }
}
