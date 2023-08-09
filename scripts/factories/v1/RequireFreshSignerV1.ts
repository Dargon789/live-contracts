import type { EtherscanVerificationRequest } from '@0xsequence/solidity-deployer'
import { ContractFactory, ethers } from 'ethers'

export class RequireFreshSignerV1 extends ContractFactory {
  constructor(signer: ethers.Signer) {
    super(
      [
        {
          inputs: [
            {
              internalType: 'contract RequireUtils',
              name: '_requireUtils',
              type: 'address'
            }
          ],
          stateMutability: 'nonpayable',
          type: 'constructor'
        },
        {
          inputs: [],
          name: 'REQUIRE_UTILS',
          outputs: [
            {
              internalType: 'contract RequireUtils',
              name: '',
              type: 'address'
            }
          ],
          stateMutability: 'view',
          type: 'function'
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_signer',
              type: 'address'
            }
          ],
          name: 'requireFreshSigner',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      '0x60a060405234801561001057600080fd5b506040516102aa3803806102aa8339818101604052602081101561003357600080fd5b5051606081901b6001600160601b0319166080526001600160a01b031661023f61006b6000398060a352806101af525061023f6000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80630df0c4191461003b578063cfc63a4914610070575b600080fd5b61006e6004803603602081101561005157600080fd5b503573ffffffffffffffffffffffffffffffffffffffff166100a1565b005b6100786101ad565b6040805173ffffffffffffffffffffffffffffffffffffffff9092168252519081900360200190f35b7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16631cd05dc4826040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561012857600080fd5b505afa15801561013c573d6000803e3d6000fd5b505050506040513d602081101561015257600080fd5b5051156101aa576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260388152602001806101d26038913960400191505060405180910390fd5b50565b7f00000000000000000000000000000000000000000000000000000000000000008156fe5265717569726546726573685369676e6572237265717569726546726573685369676e65723a204455504c4943415445445f5349474e4552a2646970667358221220e659f104be18ad6f797d1c0a2939307f47f1ba93ae17f15e4cdb46b8942173f964736f6c63430007060033',
      signer
    )
  }
}

export const REQUIRE_FRESH_SIGNER_V1_VERIFICATION: Omit<EtherscanVerificationRequest, 'waitForSuccess'> = {
  contractToVerify: 'contracts/modules/utils/libs/RequireFreshSigner.sol:RequireFreshSigner',
  version: 'v0.7.6+commit.7338295f',
  compilerInput: {
    language: 'Solidity',
    sources: {
      'contracts/modules/utils/libs/RequireFreshSigner.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\n\nimport "../RequireUtils.sol";\n\n\ncontract RequireFreshSigner {\n  RequireUtils public immutable REQUIRE_UTILS;\n\n  constructor (RequireUtils _requireUtils) {\n    REQUIRE_UTILS = _requireUtils;\n  }\n\n  function requireFreshSigner(address _signer) external {\n    require(REQUIRE_UTILS.lastSignerUpdate(_signer) == 0, "RequireFreshSigner#requireFreshSigner: DUPLICATED_SIGNER");\n  }\n}\n'
      },
      'contracts/modules/utils/RequireUtils.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\npragma experimental ABIEncoderV2;\n\nimport "../commons/interfaces/IModuleCalls.sol";\nimport "../commons/interfaces/IModuleAuthUpgradable.sol";\nimport "../../interfaces/IERC1271Wallet.sol";\nimport "../../utils/SignatureValidator.sol";\nimport "../../utils/LibBytes.sol";\nimport "../../Wallet.sol";\n\ncontract RequireUtils is SignatureValidator {\n  using LibBytes for bytes;\n\n  uint256 private constant NONCE_BITS = 96;\n  bytes32 private constant NONCE_MASK = bytes32((1 << NONCE_BITS) - 1);\n\n  uint256 private constant FLAG_SIGNATURE = 0;\n  uint256 private constant FLAG_ADDRESS = 1;\n  uint256 private constant FLAG_DYNAMIC_SIGNATURE = 2;\n\n  bytes32 private immutable INIT_CODE_HASH;\n  address private immutable FACTORY;\n\n  struct Member {\n    uint256 weight;\n    address signer;\n  }\n\n  event RequiredConfig(\n    address indexed _wallet,\n    bytes32 indexed _imageHash,\n    uint256 _threshold,\n    bytes _signers\n  );\n\n  event RequiredSigner(\n    address indexed _wallet,\n    address indexed _signer\n  );\n\n  mapping(address => uint256) public lastSignerUpdate;\n  mapping(address => uint256) public lastWalletUpdate;\n  mapping(address => bytes32) public knownImageHashes;\n  mapping(bytes32 => uint256) public lastImageHashUpdate;\n\n  constructor(address _factory, address _mainModule) public {\n    FACTORY = _factory;\n    INIT_CODE_HASH = keccak256(abi.encodePacked(Wallet.creationCode, uint256(_mainModule)));\n  }\n\n  /**\n   * @notice Publishes the current configuration of a Sequence wallets using logs\n   * @dev Used for fast lookup of a wallet configuration based on its image-hash, compatible with updated and counter-factual wallets.\n   *\n   * @param _wallet      Sequence wallet\n   * @param _threshold   Thershold of the current configuration\n   * @param _members     Members of the current configuration\n   * @param _index       True if an index in contract-storage is desired \n   */\n  function publishConfig(\n    address _wallet,\n    uint256 _threshold,\n    Member[] calldata _members,\n    bool _index\n  ) external {\n    // Compute expected imageHash\n    bytes32 imageHash = bytes32(uint256(_threshold));\n    for (uint256 i = 0; i < _members.length; i++) {\n      imageHash = keccak256(abi.encode(imageHash, _members[i].weight, _members[i].signer));\n    }\n\n    // Check against wallet imageHash\n    (bool succeed, bytes memory data) = _wallet.call(abi.encodePacked(IModuleAuthUpgradable(_wallet).imageHash.selector));\n    if (succeed && data.length == 32) {\n      // Check contract defined\n      bytes32 currentImageHash = abi.decode(data, (bytes32));\n      require(currentImageHash == imageHash, "RequireUtils#publishConfig: UNEXPECTED_IMAGE_HASH");\n    } else {\n      // Check counter-factual\n      require(address(\n        uint256(\n          keccak256(\n            abi.encodePacked(\n              byte(0xff),\n              FACTORY,\n              imageHash,\n              INIT_CODE_HASH\n            )\n          )\n        )\n      ) == _wallet, "RequireUtils#publishConfig: UNEXPECTED_COUNTERFACTUAL_IMAGE_HASH");\n\n      // Register known image-hash for counter-factual wallet\n      if (_index) knownImageHashes[_wallet] = imageHash;\n    }\n\n    // Emit event for easy config retrieval\n    emit RequiredConfig(_wallet, imageHash, _threshold, abi.encode(_members));\n\n    if (_index) {\n      // Register last event for given wallet\n      lastWalletUpdate[_wallet] = block.number;\n\n      // Register last event for image-hash\n      lastImageHashUpdate[imageHash] = block.number;\n    }\n  }\n\n  /**\n   * @notice Publishes the configuration and set of signers for a counter-factual Sequence wallets using logs\n   * @dev Used for fast lookup of a wallet based on its signer members, only signing members are included in the logs\n   *   as a mechanism to avoid poisoning of the directory of wallets.\n   *\n   *   Only the initial counter-factual configuration can be published, to publish updated configurations see `publishConfig`.\n   *\n   * @param _wallet      Sequence wallet\n   * @param _hash        Any hash signed by the wallet\n   * @param _sizeMembers Number of members on the counter-factual configuration\n   * @param _signature   Signature for the given hash\n   * @param _index       True if an index in contract-storage is desired \n   */\n  function publishInitialSigners(\n    address _wallet,\n    bytes32 _hash,\n    uint256 _sizeMembers,\n    bytes memory _signature,\n    bool _index\n  ) external {\n    // Decode and index signature\n    (\n      uint16 threshold,  // required threshold signature\n      uint256 rindex     // read index\n    ) = _signature.readFirstUint16();\n\n    // Generate sub-digest\n    bytes32 subDigest; {\n      uint256 chainId; assembly { chainId := chainid() }\n      subDigest = keccak256(\n        abi.encodePacked(\n          "\\x19\\x01",\n          chainId,\n          _wallet,\n          _hash\n        )\n      );\n    }\n\n    // Recover signature\n    bytes32 imageHash = bytes32(uint256(threshold));\n\n    Member[] memory members = new Member[](_sizeMembers);\n    uint256 membersIndex = 0;\n\n    while (rindex < _signature.length) {\n      // Read next item type and addrWeight\n      uint256 flag; uint256 addrWeight; address addr;\n      (flag, addrWeight, rindex) = _signature.readUint8Uint8(rindex);\n\n      if (flag == FLAG_ADDRESS) {\n        // Read plain address\n        (addr, rindex) = _signature.readAddress(rindex);\n      } else if (flag == FLAG_SIGNATURE) {\n        // Read single signature and recover signer\n        bytes memory signature;\n        (signature, rindex) = _signature.readBytes66(rindex);\n        addr = recoverSigner(subDigest, signature);\n\n        // Publish signer\n        _publishSigner(_wallet, addr, _index);\n      } else if (flag == FLAG_DYNAMIC_SIGNATURE) {\n        // Read signer\n        (addr, rindex) = _signature.readAddress(rindex);\n\n        {\n          // Read signature size\n          uint256 size;\n          (size, rindex) = _signature.readUint16(rindex);\n\n          // Read dynamic size signature\n          bytes memory signature;\n          (signature, rindex) = _signature.readBytes(rindex, size);\n          require(isValidSignature(subDigest, addr, signature), "ModuleAuth#_signatureValidation: INVALID_SIGNATURE");\n        }\n\n        // Publish signer\n        _publishSigner(_wallet, addr, _index);\n      } else {\n        revert("RequireUtils#publishInitialSigners: INVALID_SIGNATURE_FLAG");\n      }\n\n      // Store member on array\n      members[membersIndex] = Member(addrWeight, addr);\n      membersIndex++;\n\n      // Write weight and address to image\n      imageHash = keccak256(abi.encode(imageHash, addrWeight, addr));\n    }\n\n    require(membersIndex == _sizeMembers, "RequireUtils#publishInitialSigners: INVALID_MEMBERS_COUNT");\n\n    // Check against counter-factual imageHash\n    require(address(\n      uint256(\n        keccak256(\n          abi.encodePacked(\n            byte(0xff),\n            FACTORY,\n            imageHash,\n            INIT_CODE_HASH\n          )\n        )\n      )\n    ) == _wallet, "RequireUtils#publishInitialSigners: UNEXPECTED_COUNTERFACTUAL_IMAGE_HASH");\n\n    // Emit event for easy config retrieval\n    emit RequiredConfig(_wallet, imageHash, threshold, abi.encode(members));\n\n    if (_index) {\n      // Register last event for given wallet\n      lastWalletUpdate[_wallet] = block.number;\n\n      // Register last event for image-hash\n      lastImageHashUpdate[imageHash] = block.number;\n\n      // Register known image-hash for counter-factual wallet\n      knownImageHashes[_wallet] = imageHash;\n    }\n  }\n\n  /**\n   * @notice Validates that a given expiration hasn\'t expired\n   * @dev Used as an optional transaction on a Sequence batch, to create expirable transactions.\n   *\n   * @param _expiration  Expiration to check\n   */\n  function requireNonExpired(uint256 _expiration) external view {\n    require(block.timestamp < _expiration, "RequireUtils#requireNonExpired: EXPIRED");\n  }\n\n  /**\n   * @notice Validates that a given wallet has reached a given nonce\n   * @dev Used as an optional transaction on a Sequence batch, to define transaction execution order\n   *\n   * @param _wallet Sequence wallet\n   * @param _nonce  Required nonce\n   */\n  function requireMinNonce(address _wallet, uint256 _nonce) external view {\n    (uint256 space, uint256 nonce) = _decodeNonce(_nonce);\n    uint256 currentNonce = IModuleCalls(_wallet).readNonce(space);\n    require(currentNonce >= nonce, "RequireUtils#requireMinNonce: NONCE_BELOW_REQUIRED");\n  }\n\n  /**\n   * @notice Decodes a raw nonce\n   * @dev A raw nonce is encoded using the first 160 bits for the space\n   *  and the last 96 bits for the nonce\n   * @param _rawNonce Nonce to be decoded\n   * @return _space The nonce space of the raw nonce\n   * @return _nonce The nonce of the raw nonce\n   */\n  function _decodeNonce(uint256 _rawNonce) private pure returns (uint256 _space, uint256 _nonce) {\n    _nonce = uint256(bytes32(_rawNonce) & NONCE_MASK);\n    _space = _rawNonce >> NONCE_BITS;\n  }\n\n  /**\n   * @notice Publishes a signer that was validated to sign for a particular wallet\n   * @param _wallet Address of the wallet\n   * @param _signer Address of the signer\n   * @param _index True if an index on contract storage is desired\n   */\n  function _publishSigner(address _wallet, address _signer, bool _index) private {\n    // Required signer event\n    emit RequiredSigner(_wallet, _signer);\n\n    if (_index) {\n      // Register last event for given signer\n      lastSignerUpdate[_signer] = block.number;\n    }\n  }\n}\n'
      },
      'contracts/modules/commons/interfaces/IModuleCalls.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\npragma experimental ABIEncoderV2;\n\n\ninterface IModuleCalls {\n  // Events\n  event NonceChange(uint256 _space, uint256 _newNonce);\n  event TxFailed(bytes32 _tx, bytes _reason);\n  event TxExecuted(bytes32 _tx) anonymous;\n\n  // Transaction structure\n  struct Transaction {\n    bool delegateCall;   // Performs delegatecall\n    bool revertOnError;  // Reverts transaction bundle if tx fails\n    uint256 gasLimit;    // Maximum gas to be forwarded\n    address target;      // Address of the contract to call\n    uint256 value;       // Amount of ETH to pass with the call\n    bytes data;          // calldata to pass\n  }\n\n  /**\n   * @notice Returns the next nonce of the default nonce space\n   * @dev The default nonce space is 0x00\n   * @return The next nonce\n   */\n  function nonce() external view returns (uint256);\n\n  /**\n   * @notice Returns the next nonce of the given nonce space\n   * @param _space Nonce space, each space keeps an independent nonce count\n   * @return The next nonce\n   */\n  function readNonce(uint256 _space) external view returns (uint256);\n\n  /**\n   * @notice Allow wallet owner to execute an action\n   * @param _txs        Transactions to process\n   * @param _nonce      Signature nonce (may contain an encoded space)\n   * @param _signature  Encoded signature\n   */\n  function execute(\n    Transaction[] calldata _txs,\n    uint256 _nonce,\n    bytes calldata _signature\n  ) external;\n\n  /**\n   * @notice Allow wallet to execute an action\n   *   without signing the message\n   * @param _txs  Transactions to execute\n   */\n  function selfExecute(\n    Transaction[] calldata _txs\n  ) external;\n}\n'
      },
      'contracts/modules/commons/interfaces/IModuleAuthUpgradable.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\n\n\ninterface IModuleAuthUpgradable {\n  /**\n   * @notice Updates the signers configuration of the wallet\n   * @param _imageHash New required image hash of the signature\n   */\n  function updateImageHash(bytes32 _imageHash) external;\n\n  /**\n   * @notice Returns the current image hash of the wallet\n   */\n  function imageHash() external view returns (bytes32);\n}\n'
      },
      'contracts/interfaces/IERC1271Wallet.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\n\n\ninterface IERC1271Wallet {\n\n  /**\n   * @notice Verifies whether the provided signature is valid with respect to the provided data\n   * @dev MUST return the correct magic value if the signature provided is valid for the provided data\n   *   > The bytes4 magic value to return when signature is valid is 0x20c13b0b : bytes4(keccak256("isValidSignature(bytes,bytes)")\n   *   > This function MAY modify Ethereum\'s state\n   * @param _data       Arbitrary length data signed on the behalf of address(this)\n   * @param _signature  Signature byte array associated with _data\n   * @return magicValue Magic value 0x20c13b0b if the signature is valid and 0x0 otherwise\n   */\n  function isValidSignature(\n    bytes calldata _data,\n    bytes calldata _signature)\n    external\n    view\n    returns (bytes4 magicValue);\n\n  /**\n   * @notice Verifies whether the provided signature is valid with respect to the provided hash\n   * @dev MUST return the correct magic value if the signature provided is valid for the provided hash\n   *   > The bytes4 magic value to return when signature is valid is 0x20c13b0b : bytes4(keccak256("isValidSignature(bytes,bytes)")\n   *   > This function MAY modify Ethereum\'s state\n   * @param _hash       keccak256 hash that was signed\n   * @param _signature  Signature byte array associated with _data\n   * @return magicValue Magic value 0x20c13b0b if the signature is valid and 0x0 otherwise\n   */\n  function isValidSignature(\n    bytes32 _hash,\n    bytes calldata _signature)\n    external\n    view\n    returns (bytes4 magicValue);\n}'
      },
      'contracts/utils/SignatureValidator.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\n\nimport "../interfaces/IERC1271Wallet.sol";\n\nimport "./LibBytes.sol";\n\n/**\n * @dev Contains logic for signature validation.\n * Signatures from wallet contracts assume ERC-1271 support (https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1271.md)\n * Notes: Methods are strongly inspired by contracts in https://github.com/0xProject/0x-monorepo/blob/development/\n */\ncontract SignatureValidator {\n  using LibBytes for bytes;\n\n  /***********************************|\n  |             Variables             |\n  |__________________________________*/\n\n  // bytes4(keccak256("isValidSignature(bytes,bytes)"))\n  bytes4 constant internal ERC1271_MAGICVALUE = 0x20c13b0b;\n\n  // bytes4(keccak256("isValidSignature(bytes32,bytes)"))\n  bytes4 constant internal ERC1271_MAGICVALUE_BYTES32 = 0x1626ba7e;\n\n  // Allowed signature types.\n  uint256 private constant SIG_TYPE_EIP712 = 1;\n  uint256 private constant SIG_TYPE_ETH_SIGN = 2;\n  uint256 private constant SIG_TYPE_WALLET_BYTES32 = 3;\n\n  /***********************************|\n  |        Signature Functions        |\n  |__________________________________*/\n\n /**\n   * @notice Recover the signer of hash, assuming it\'s an EOA account\n   * @dev Only for SignatureType.EIP712 and SignatureType.EthSign signatures\n   * @param _hash      Hash that was signed\n   *   encoded as (bytes32 r, bytes32 s, uint8 v, ... , SignatureType sigType)\n   */\n  function recoverSigner(\n    bytes32 _hash,\n    bytes memory _signature\n  ) internal pure returns (address signer) {\n    require(_signature.length == 66, "SignatureValidator#recoverSigner: invalid signature length");\n    uint256 signatureType = uint8(_signature[_signature.length - 1]);\n\n    // Variables are not scoped in Solidity.\n    uint8 v = uint8(_signature[64]);\n    bytes32 r = _signature.readBytes32(0);\n    bytes32 s = _signature.readBytes32(32);\n\n    // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature\n    // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines\n    // the valid range for s in (281): 0 < s < secp256k1n \u00f7 2 + 1, and for v in (282): v \u2208 {27, 28}. Most\n    // signatures from current libraries generate a unique signature with an s-value in the lower half order.\n    //\n    // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value\n    // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or\n    // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept\n    // these malleable signatures as well.\n    //\n    // Source OpenZeppelin\n    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol\n\n    if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {\n      revert("SignatureValidator#recoverSigner: invalid signature \'s\' value");\n    }\n\n    if (v != 27 && v != 28) {\n      revert("SignatureValidator#recoverSigner: invalid signature \'v\' value");\n    }\n\n    // Signature using EIP712\n    if (signatureType == SIG_TYPE_EIP712) {\n      signer = ecrecover(_hash, v, r, s);\n\n    // Signed using web3.eth_sign() or Ethers wallet.signMessage()\n    } else if (signatureType == SIG_TYPE_ETH_SIGN) {\n      signer = ecrecover(\n        keccak256(abi.encodePacked("\\x19Ethereum Signed Message:\\n32", _hash)),\n        v,\n        r,\n        s\n      );\n\n    } else {\n      // Anything other signature types are illegal (We do not return false because\n      // the signature may actually be valid, just not in a format\n      // that we currently support. In this case returning false\n      // may lead the caller to incorrectly believe that the\n      // signature was invalid.)\n      revert("SignatureValidator#recoverSigner: UNSUPPORTED_SIGNATURE_TYPE");\n    }\n\n    // Prevent signer from being 0x0\n    require(\n      signer != address(0x0),\n      "SignatureValidator#recoverSigner: INVALID_SIGNER"\n    );\n\n    return signer;\n  }\n\n /**\n   * @notice Returns true if the provided signature is valid for the given signer.\n   * @dev Supports SignatureType.EIP712, SignatureType.EthSign, and ERC1271 signatures\n   * @param _hash      Hash that was signed\n   * @param _signer    Address of the signer candidate\n   * @param _signature Signature byte array\n   */\n  function isValidSignature(\n    bytes32 _hash,\n    address _signer,\n    bytes memory _signature\n  ) internal view returns (bool valid) {\n    uint256 signatureType = uint8(_signature[_signature.length - 1]);\n\n    if (signatureType == SIG_TYPE_EIP712 || signatureType == SIG_TYPE_ETH_SIGN) {\n      // Recover signer and compare with provided\n      valid = recoverSigner(_hash, _signature) == _signer;\n\n    } else if (signatureType == SIG_TYPE_WALLET_BYTES32) {\n      // Remove signature type before calling ERC1271, restore after call\n      uint256 prevSize; assembly { prevSize := mload(_signature) mstore(_signature, sub(prevSize, 1)) }\n      valid = ERC1271_MAGICVALUE_BYTES32 == IERC1271Wallet(_signer).isValidSignature(_hash, _signature);\n      assembly { mstore(_signature, prevSize) }\n\n    } else {\n      // Anything other signature types are illegal (We do not return false because\n      // the signature may actually be valid, just not in a format\n      // that we currently support. In this case returning false\n      // may lead the caller to incorrectly believe that the\n      // signature was invalid.)\n      revert("SignatureValidator#isValidSignature: UNSUPPORTED_SIGNATURE_TYPE");\n    }\n  }\n}\n'
      },
      'contracts/utils/LibBytes.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\n\nlibrary LibBytes {\n  using LibBytes for bytes;\n\n  /***********************************|\n  |        Read Bytes Functions       |\n  |__________________________________*/\n\n  /**\n   * @dev Read firsts uint16 value.\n   * @param data Byte array to be read.\n   * @return a uint16 value of data at index zero.\n   * @return newIndex Updated index after reading the values.\n   */\n  function readFirstUint16(\n    bytes memory data\n  ) internal pure returns (\n    uint16 a,\n    uint256 newIndex\n  ) {\n    assembly {\n      let word := mload(add(32, data))\n      a := shr(240, word)\n      newIndex := 2\n    }\n    require(2 <= data.length, "LibBytes#readFirstUint16: OUT_OF_BOUNDS");\n  }\n\n  /**\n   * @dev Reads consecutive bool (8 bits) and uint8 values.\n   * @param data Byte array to be read.\n   * @param index Index in byte array of uint8 and uint8 values.\n   * @return a uint8 value of data at given index.\n   * @return b uint8 value of data at given index + 8.\n   * @return newIndex Updated index after reading the values.\n   */\n  function readUint8Uint8(\n    bytes memory data,\n    uint256 index\n  ) internal pure returns (\n    uint8 a,\n    uint8 b,\n    uint256 newIndex\n  ) {\n    assembly {\n      let word := mload(add(index, add(32, data)))\n      a := shr(248, word)\n      b := and(shr(240, word), 0xff)\n      newIndex := add(index, 2)\n    }\n    assert(newIndex > index);\n    require(newIndex <= data.length, "LibBytes#readUint8Uint8: OUT_OF_BOUNDS");\n  }\n\n  /**\n   * @dev Reads an address value from a position in a byte array.\n   * @param data Byte array to be read.\n   * @param index Index in byte array of address value.\n   * @return a address value of data at given index.\n   * @return newIndex Updated index after reading the value.\n   */\n  function readAddress(\n    bytes memory data,\n    uint256 index\n  ) internal pure returns (\n    address a,\n    uint256 newIndex\n  ) {\n    assembly {\n      let word := mload(add(index, add(32, data)))\n      a := and(shr(96, word), 0xffffffffffffffffffffffffffffffffffffffff)\n      newIndex := add(index, 20)\n    }\n    assert(newIndex > index);\n    require(newIndex <= data.length, "LibBytes#readAddress: OUT_OF_BOUNDS");\n  }\n\n  /**\n   * @dev Reads 66 bytes from a position in a byte array.\n   * @param data Byte array to be read.\n   * @param index Index in byte array of 66 bytes value.\n   * @return a 66 bytes bytes array value of data at given index.\n   * @return newIndex Updated index after reading the value.\n   */\n  function readBytes66(\n    bytes memory data,\n    uint256 index\n  ) internal pure returns (\n    bytes memory a,\n    uint256 newIndex\n  ) {\n    a = new bytes(66);\n    assembly {\n      let offset := add(32, add(data, index))\n      mstore(add(a, 32), mload(offset))\n      mstore(add(a, 64), mload(add(offset, 32)))\n      mstore(add(a, 66), mload(add(offset, 34)))\n      newIndex := add(index, 66)\n    }\n    assert(newIndex > index);\n    require(newIndex <= data.length, "LibBytes#readBytes66: OUT_OF_BOUNDS");\n  }\n\n  /**\n   * @dev Reads a bytes32 value from a position in a byte array.\n   * @param b Byte array containing a bytes32 value.\n   * @param index Index in byte array of bytes32 value.\n   * @return result bytes32 value from byte array.\n   */\n  function readBytes32(\n    bytes memory b,\n    uint256 index\n  )\n    internal\n    pure\n    returns (bytes32 result)\n  {\n    require(\n      b.length >= index + 32,\n      "LibBytes#readBytes32: GREATER_OR_EQUAL_TO_32_LENGTH_REQUIRED"\n    );\n\n    // Arrays are prefixed by a 256 bit length parameter\n    uint256 pos = index + 32;\n\n    // Read the bytes32 from array memory\n    assembly {\n      result := mload(add(b, pos))\n    }\n    return result;\n  }\n\n  /**\n   * @dev Reads an uint16 value from a position in a byte array.\n   * @param data Byte array to be read.\n   * @param index Index in byte array of uint16 value.\n   * @return a uint16 value of data at given index.\n   * @return newIndex Updated index after reading the value.\n   */\n  function readUint16(\n    bytes memory data,\n    uint256 index\n  ) internal pure returns (uint16 a, uint256 newIndex) {\n    assembly {\n      let word := mload(add(index, add(32, data)))\n      a := and(shr(240, word), 0xffff)\n      newIndex := add(index, 2)\n    }\n    assert(newIndex > index);\n    require(newIndex <= data.length, "LibBytes#readUint16: OUT_OF_BOUNDS");\n  }\n\n  /**\n   * @dev Reads bytes from a position in a byte array.\n   * @param data Byte array to be read.\n   * @param index Index in byte array of bytes value.\n   * @param size Number of bytes to read.\n   * @return a bytes bytes array value of data at given index.\n   * @return newIndex Updated index after reading the value.\n   */\n  function readBytes(\n    bytes memory data,\n    uint256 index,\n    uint256 size\n  ) internal pure returns (bytes memory a, uint256 newIndex) {\n    a = new bytes(size);\n\n    assembly {\n      let offset := add(32, add(data, index))\n\n      let i := 0 let n := 32\n      // Copy each word, except last one\n      for { } lt(n, size) { i := n n := add(n, 32) } {\n        mstore(add(a, n), mload(add(offset, i)))\n      }\n\n      // Load word after new array\n      let suffix := add(a, add(32, size))\n      let suffixWord := mload(suffix)\n\n      // Copy last word, overwrites after array \n      mstore(add(a, n), mload(add(offset, i)))\n\n      // Restore after array\n      mstore(suffix, suffixWord)\n\n      newIndex := add(index, size)\n    }\n\n    assert(newIndex >= index);\n    require(newIndex <= data.length, "LibBytes#readBytes: OUT_OF_BOUNDS");\n  }\n}\n'
      },
      'contracts/Wallet.sol': {
        content:
          '// SPDX-License-Identifier: Apache-2.0\npragma solidity 0.7.6;\n\n/**\n    Minimal upgradeable proxy implementation, delegates all calls to the address\n    defined by the storage slot matching the wallet address.\n\n    Inspired by EIP-1167 Implementation (https://eips.ethereum.org/EIPS/eip-1167)\n\n    deployed code:\n\n        0x00    0x36         0x36      CALLDATASIZE      cds\n        0x01    0x3d         0x3d      RETURNDATASIZE    0 cds\n        0x02    0x3d         0x3d      RETURNDATASIZE    0 0 cds\n        0x03    0x37         0x37      CALLDATACOPY\n        0x04    0x3d         0x3d      RETURNDATASIZE    0\n        0x05    0x3d         0x3d      RETURNDATASIZE    0 0\n        0x06    0x3d         0x3d      RETURNDATASIZE    0 0 0\n        0x07    0x36         0x36      CALLDATASIZE      cds 0 0 0\n        0x08    0x3d         0x3d      RETURNDATASIZE    0 cds 0 0 0\n        0x09    0x30         0x30      ADDRESS           addr 0 cds 0 0 0\n        0x0A    0x54         0x54      SLOAD             imp 0 cds 0 0 0\n        0x0B    0x5a         0x5a      GAS               gas imp 0 cds 0 0 0\n        0x0C    0xf4         0xf4      DELEGATECALL      suc 0\n        0x0D    0x3d         0x3d      RETURNDATASIZE    rds suc 0\n        0x0E    0x82         0x82      DUP3              0 rds suc 0\n        0x0F    0x80         0x80      DUP1              0 0 rds suc 0\n        0x10    0x3e         0x3e      RETURNDATACOPY    suc 0\n        0x11    0x90         0x90      SWAP1             0 suc\n        0x12    0x3d         0x3d      RETURNDATASIZE    rds 0 suc\n        0x13    0x91         0x91      SWAP2             suc 0 rds\n        0x14    0x60 0x18    0x6018    PUSH1             0x18 suc 0 rds\n    /-- 0x16    0x57         0x57      JUMPI             0 rds\n    |   0x17    0xfd         0xfd      REVERT\n    \\-> 0x18    0x5b         0x5b      JUMPDEST          0 rds\n        0x19    0xf3         0xf3      RETURN\n\n    flat deployed code: 0x363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3\n\n    deploy function:\n\n        0x00    0x60 0x3a    0x603a    PUSH1             0x3a\n        0x02    0x60 0x0e    0x600e    PUSH1             0x0e 0x3a\n        0x04    0x3d         0x3d      RETURNDATASIZE    0 0x0e 0x3a\n        0x05    0x39         0x39      CODECOPY\n        0x06    0x60 0x1a    0x601a    PUSH1             0x1a\n        0x08    0x80         0x80      DUP1              0x1a 0x1a\n        0x09    0x51         0x51      MLOAD             imp 0x1a\n        0x0A    0x30         0x30      ADDRESS           addr imp 0x1a\n        0x0B    0x55         0x55      SSTORE            0x1a\n        0x0C    0x3d         0x3d      RETURNDATASIZE    0 0x1a\n        0x0D    0xf3         0xf3      RETURN\n        [...deployed code]\n\n    flat deploy function: 0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3\n*/\nlibrary Wallet {\n  bytes internal constant creationCode = hex"603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3";\n}\n'
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
        details: {
          yul: true
        }
      },
      outputSelection: {
        '*': {
          '*': ['evm.bytecode', 'evm.deployedBytecode', 'abi']
        }
      },
      libraries: {}
    }
  }
}
