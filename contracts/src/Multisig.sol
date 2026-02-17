// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Multisig {
    error ThresholdZero();
    error ThresholdExceedsOwners();
    error InvalidOwner();
    error DuplicateOwner();
    error NotOwner();
    error TxDoesNotExist();
    error TxAlreadyExecuted();
    error TxAlreadyApproved();
    error ApprovalsBelowThreshold();
    error TxExecutionFailed();

    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event Submit(
        uint256 indexed txId,
        address indexed owner,
        address indexed to,
        uint256 value,
        bytes data
    );
    event Approve(address indexed owner, uint256 indexed txId);
    event Execute(address indexed owner, uint256 indexed txId);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numApprovals;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approved;

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier txExists(uint256 txId) {
        if (txId >= transactions.length) revert TxDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 txId) {
        if (transactions[txId].executed) revert TxAlreadyExecuted();
        _;
    }

    modifier notApproved(uint256 txId) {
        if (approved[txId][msg.sender]) revert TxAlreadyApproved();
        _;
    }

    constructor(address[] memory _owners, uint256 _threshold) {
        if (_threshold == 0) revert ThresholdZero();
        if (_threshold > _owners.length) revert ThresholdExceedsOwners();

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            if (owner == address(0)) revert InvalidOwner();
            if (isOwner[owner]) revert DuplicateOwner();

            isOwner[owner] = true;
            owners.push(owner);
        }

        threshold = _threshold;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function submit(address to, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (uint256 txId)
    {
        txId = transactions.length;
        transactions.push(
            Transaction({
                to: to,
                value: value,
                data: data,
                executed: false,
                numApprovals: 0
            })
        );

        emit Submit(txId, msg.sender, to, value, data);
    }

    function approve(uint256 txId)
        external
        onlyOwner
        txExists(txId)
        notExecuted(txId)
        notApproved(txId)
    {
        approved[txId][msg.sender] = true;
        transactions[txId].numApprovals += 1;

        emit Approve(msg.sender, txId);
    }

    function execute(uint256 txId)
        external
        onlyOwner
        txExists(txId)
        notExecuted(txId)
    {
        Transaction storage transaction = transactions[txId];

        if (transaction.numApprovals < threshold) revert ApprovalsBelowThreshold();

        transaction.executed = true;

        (bool success,) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        if (!success) revert TxExecutionFailed();

        emit Execute(msg.sender, txId);
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }
}
