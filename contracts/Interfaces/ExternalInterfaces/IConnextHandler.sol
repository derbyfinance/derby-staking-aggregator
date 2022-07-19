import {XCallArgs} from "../../libraries/LibConnextStorage.sol";

interface IConnextHandler {
  function xcall(XCallArgs calldata _args) external payable returns (bytes32);
}
  