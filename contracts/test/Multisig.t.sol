// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Multisig} from "../src/Multisig.sol";

contract MultisigTest is Test {
    Multisig internal multisig;

    address internal owner1 = makeAddr("owner1");
    address internal owner2 = makeAddr("owner2");
    address internal owner3 = makeAddr("owner3");
    address internal nonOwner = makeAddr("nonOwner");
    address internal receiver = makeAddr("receiver");

    function setUp() public {
        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        multisig = new Multisig(owners, 2);
    }

    function test_DeployRevertsWhenThresholdIsZero() public {
        address[] memory owners = new address[](1);
        owners[0] = owner1;

        vm.expectRevert(Multisig.ThresholdZero.selector);
        new Multisig(owners, 0);
    }

    function test_DeployRevertsWhenThresholdExceedsOwners() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;

        vm.expectRevert(Multisig.ThresholdExceedsOwners.selector);
        new Multisig(owners, 3);
    }

    function test_DeployRevertsWithDuplicateOwners() public {
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner1;

        vm.expectRevert(Multisig.DuplicateOwner.selector);
        new Multisig(owners, 1);
    }

    function test_SubmitCreatesTransaction() public {
        bytes memory data = hex"1234";

        vm.prank(owner1);
        multisig.submit(receiver, 1 ether, data);

        assertEq(multisig.getTransactionCount(), 1);

        (
            address to,
            uint256 value,
            bytes memory txData,
            bool executed,
            uint256 numApprovals
        ) = multisig.transactions(0);

        assertEq(to, receiver);
        assertEq(value, 1 ether);
        assertEq(txData, data);
        assertEq(executed, false);
        assertEq(numApprovals, 0);
    }

    function test_OnlyOwnersCanApprove() public {
        uint256 txId = _submitTx(owner1, receiver, 0, "");

        vm.prank(nonOwner);
        vm.expectRevert(Multisig.NotOwner.selector);
        multisig.approve(txId);
    }

    function test_NoDoubleApprove() public {
        uint256 txId = _submitTx(owner1, receiver, 0, "");

        vm.prank(owner1);
        multisig.approve(txId);

        vm.prank(owner1);
        vm.expectRevert(Multisig.TxAlreadyApproved.selector);
        multisig.approve(txId);
    }

    function test_ExecuteFailsBeforeThreshold() public {
        uint256 txId = _submitTx(owner1, receiver, 0, "");

        vm.prank(owner1);
        multisig.approve(txId);

        vm.prank(owner1);
        vm.expectRevert(Multisig.ApprovalsBelowThreshold.selector);
        multisig.execute(txId);
    }

    function test_ExecuteSucceedsAfterThresholdAndTransfersETH() public {
        vm.deal(owner1, 2 ether);
        vm.prank(owner1);
        (bool sent,) = address(multisig).call{value: 1 ether}("");
        assertTrue(sent);

        uint256 txId = _submitTx(owner1, receiver, 1 ether, "");

        vm.prank(owner1);
        multisig.approve(txId);

        vm.prank(owner2);
        multisig.approve(txId);

        uint256 receiverBalanceBefore = receiver.balance;

        vm.prank(owner3);
        multisig.execute(txId);

        assertEq(receiver.balance, receiverBalanceBefore + 1 ether);

        (, , , bool executed, uint256 numApprovals) = multisig.transactions(txId);
        assertEq(executed, true);
        assertEq(numApprovals, 2);
    }

    function test_ExecuteCannotBeCalledTwice() public {
        vm.deal(owner1, 2 ether);
        vm.prank(owner1);
        (bool sent,) = address(multisig).call{value: 1 ether}("");
        assertTrue(sent);

        uint256 txId = _submitTx(owner1, receiver, 1 ether, "");

        vm.prank(owner1);
        multisig.approve(txId);

        vm.prank(owner2);
        multisig.approve(txId);

        vm.prank(owner1);
        multisig.execute(txId);

        vm.prank(owner2);
        vm.expectRevert(Multisig.TxAlreadyExecuted.selector);
        multisig.execute(txId);
    }

    function _submitTx(
        address submitter,
        address to,
        uint256 value,
        bytes memory data
    ) internal returns (uint256 txId) {
        vm.prank(submitter);
        txId = multisig.submit(to, value, data);
    }
}
