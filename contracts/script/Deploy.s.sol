// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {Multisig} from "../src/Multisig.sol";

contract DeployScript is Script {
    function run() external returns (Multisig multisig) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address[] memory owners = vm.envAddress("OWNERS", ",");
        uint256 threshold = vm.envUint("THRESHOLD");

        vm.startBroadcast(deployerPrivateKey);
        multisig = new Multisig(owners, threshold);
        vm.stopBroadcast();

        console2.log("Multisig deployed at:", address(multisig));
        console2.log("Threshold:", threshold);
    }
}
