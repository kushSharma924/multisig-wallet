// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {Multisig} from "../src/Multisig.sol";

contract DeployScript is Script {
    function run() external returns (Multisig multisig) {
        // Defaults target Anvil account[0]. Override via env vars for other networks.
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(
                0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
            )
        );

        address[] memory defaultOwners = new address[](3);
        defaultOwners[0] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        defaultOwners[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        defaultOwners[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

        address[] memory owners = vm.envOr("OWNERS", ",", defaultOwners);
        uint256 threshold = vm.envOr("THRESHOLD", uint256(2));

        vm.startBroadcast(deployerPrivateKey);
        multisig = new Multisig(owners, threshold);
        vm.stopBroadcast();

        console2.log("Multisig deployed at:", address(multisig));
        console2.log("Threshold:", threshold);
    }
}
